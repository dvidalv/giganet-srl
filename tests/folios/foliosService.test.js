import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const { sendEmail } = vi.hoisted(() => {
  process.env.FOLIOS_ALERTAS_TO_EMAIL = "alertas@giganet.test";
  return { sendEmail: vi.fn() };
});
vi.mock("@/api-mail_brevo", () => ({ sendEmail }));

import User from "@/app/models/user";
import FolioContrato from "@/app/models/folioContrato";
import FolioConsumo from "@/app/models/folioConsumo";
import FolioAlerta from "@/app/models/folioAlerta";
import FolioAuditoria from "@/app/models/folioAuditoria";
import {
  RESERVA_VIGENCIA_MS,
  actualizarContrato,
  ajustarConsumo,
  cambiarModalidad,
  configurarAlertaMinima,
  crearContrato,
  estimarConsumoPrevio,
  evaluarAlertas,
  liberarFolio,
  listarAlertas,
  listarPanelFolios,
  obtenerResumenEmpresa,
  recalcularContadores,
  reconciliarReservasPendientes,
  registrarAsignacion,
  registrarResultadoEnvio,
  reintentarEmailsAlertas,
  reservarFolio,
} from "@/lib/folios/foliosService";
import { BLOQUEOS_FOLIOS } from "@/lib/folios/mensajes";
import {
  ADMIN,
  crearEmpresa,
  crearEmpresaLegada,
  detenerMongo,
  horaRD,
  iniciarMongo,
  limpiarColecciones,
} from "./helpers";

const ENERO = horaRD("2026-01-15");

beforeAll(iniciarMongo);
afterAll(detenerMongo);
beforeEach(async () => {
  await limpiarColecciones();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ success: true, messageId: "test" });
});

async function empresaControlada({ cantidad = 100, asignados = 100, inicio = "2026-01-15", vence = "2027-01-15", ahora = ENERO } = {}) {
  const empresaId = await crearEmpresa({ modalidad: "CONTROLADO" });
  const contrato = await crearContrato({
    empresaId,
    cantidadContratada: cantidad,
    fechaInicio: inicio,
    fechaVencimiento: vence,
    asignacionInicial: asignados,
    admin: ADMIN,
    ahora,
  });
  return { empresaId, contrato };
}

async function emitir(empresaId, ncf, ahora = ENERO, aceptado = true) {
  const reserva = await reservarFolio({ userId: empresaId, ncf, tipoComprobante: "32", ahora });
  if (reserva.permitido) await registrarResultadoEnvio(reserva, { aceptado, codigo: aceptado ? 0 : 110 });
  return reserva;
}

const contratoDb = (id) => FolioContrato.findById(id).lean();

describe("modalidad ILIMITADO", () => {
  it("empresa existente sin configuración de folios emite sin restricciones", async () => {
    const empresaId = await crearEmpresaLegada();
    const reserva = await reservarFolio({ userId: empresaId, ncf: "E320000000001" });
    expect(reserva).toMatchObject({ permitido: true, omitido: true, motivo: "ILIMITADO" });
    expect(await FolioConsumo.countDocuments()).toBe(0);

    const resumen = await obtenerResumenEmpresa(empresaId);
    expect(resumen.modalidad).toBe("ILIMITADO");
    expect(resumen.estado).toBe("ILIMITADO");
    expect(resumen.bloqueoEmision).toBeNull();
  });

  it("empresa nueva guarda ILIMITADO explícitamente y no registra consumo", async () => {
    const empresaId = await crearEmpresa();
    const raw = await User.findById(empresaId).lean();
    expect(raw.empresa.folios.modalidad).toBe("ILIMITADO");

    for (let i = 1; i <= 5; i += 1) {
      const r = await reservarFolio({ userId: empresaId, ncf: `E32000000000${i}` });
      expect(r.omitido).toBe(true);
    }
    expect(await FolioConsumo.countDocuments()).toBe(0);
  });

  it("no genera alertas aunque tenga contratos registrados", async () => {
    const { empresaId } = await empresaControlada({ vence: "2026-01-20" });
    await cambiarModalidad({ empresaId, modalidad: "ILIMITADO", admin: ADMIN });
    await evaluarAlertas({ ahora: ENERO });
    expect(await listarAlertas()).toHaveLength(0);
  });
});

describe("modalidad CONTROLADO", () => {
  it("configuración incompleta: sin contratos bloquea con error de configuración", async () => {
    const empresaId = await crearEmpresa({ modalidad: "CONTROLADO" });
    const r = await reservarFolio({ userId: empresaId, ncf: "E320000000001" });
    expect(r).toMatchObject({ permitido: false, codigo: "FOLIOS_CONFIGURACION_INCOMPLETA" });
    const resumen = await obtenerResumenEmpresa(empresaId);
    expect(resumen.modalidad).toBe("CONTROLADO");
    expect(resumen.estado).toBe("SIN_CONTRATO");
  });

  it("contrato vigente: reserva y confirma consumo", async () => {
    const { empresaId, contrato } = await empresaControlada();
    const r = await emitir(empresaId, "E320000000001");
    expect(r).toMatchObject({ permitido: true, contratoId: contrato.id });
    const c = await contratoDb(contrato.id);
    expect(c).toMatchObject({ consumidos: 1, reservados: 0 });
  });

  it("contrato vencido: emite todo el último día y se bloquea desde las 00:00 RD", async () => {
    const { empresaId } = await empresaControlada({ vence: "2027-01-15" });
    const ultimoMinuto = await emitir(empresaId, "E320000000001", horaRD("2027-01-15", "23:59"));
    expect(ultimoMinuto.permitido).toBe(true);

    const r = await reservarFolio({
      userId: empresaId,
      ncf: "E320000000002",
      ahora: horaRD("2027-01-16", "00:00"),
    });
    expect(r).toMatchObject({ permitido: false, codigo: "FOLIOS_VENCIDOS", httpStatus: 403 });
    expect(r.message).toBe(BLOQUEOS_FOLIOS.FOLIOS_VENCIDOS.message);
  });

  it("contrato vencido bloquea incluso con folios disponibles", async () => {
    const { empresaId } = await empresaControlada({ cantidad: 1000, asignados: 1000, vence: "2026-06-30" });
    const r = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: horaRD("2026-07-01") });
    expect(r.codigo).toBe("FOLIOS_VENCIDOS");
  });

  it("folios agotados bloquean nuevos e-NCF pero no el reenvío de uno ya contabilizado", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 2, asignados: 2 });
    await emitir(empresaId, "E320000000001");
    await emitir(empresaId, "E320000000002");

    const r = await reservarFolio({ userId: empresaId, ncf: "E320000000003", ahora: ENERO });
    expect(r).toMatchObject({ permitido: false, codigo: "FOLIOS_AGOTADOS" });
    expect(r.message).toBe(BLOQUEOS_FOLIOS.FOLIOS_AGOTADOS.message);

    const reenvio = await reservarFolio({ userId: empresaId, ncf: "E320000000002", ahora: ENERO });
    expect(reenvio).toMatchObject({ permitido: true, yaContabilizado: true });
    expect((await contratoDb(contrato.id)).consumidos).toBe(2);
  });

  it("el disponible se limita a lo asignado en The Factory", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 1 });
    await emitir(empresaId, "E320000000001");
    const r = await reservarFolio({ userId: empresaId, ncf: "E320000000002", ahora: ENERO });
    expect(r.codigo).toBe("FOLIOS_AGOTADOS");

    await registrarAsignacion({ empresaId, contratoId: contrato.id, cantidad: 5, admin: ADMIN, ahora: ENERO });
    expect((await emitir(empresaId, "E320000000002")).permitido).toBe(true);
  });

  it("un rechazo de The Factory también consume (regla: llega a The Factory)", async () => {
    const { empresaId, contrato } = await empresaControlada();
    await emitir(empresaId, "E320000000001", ENERO, false);
    expect((await contratoDb(contrato.id)).consumidos).toBe(1);
  });

  it("ambiente de pruebas (demo) no valida ni contabiliza", async () => {
    const empresaId = await crearEmpresa({ modalidad: "CONTROLADO", ambiente: "demo" });
    const r = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ambienteKey: "demo" });
    expect(r).toMatchObject({ permitido: true, omitido: true, motivo: "AMBIENTE_PRUEBAS" });
  });
});

describe("asignaciones parciales", () => {
  it("acumula asignaciones sin modificar el vencimiento y no supera lo contratado", async () => {
    const empresaId = await crearEmpresa({ modalidad: "CONTROLADO" });
    const contrato = await crearContrato({
      empresaId,
      cantidadContratada: 100000,
      fechaInicio: "2026-01-15",
      fechaVencimiento: "2027-01-15",
      asignacionInicial: 20000,
      admin: ADMIN,
      ahora: ENERO,
    });
    await registrarAsignacion({ empresaId, contratoId: contrato.id, cantidad: 10000, fecha: "2026-05-10", admin: ADMIN, ahora: horaRD("2026-05-10") });
    const r = await registrarAsignacion({ empresaId, contratoId: contrato.id, cantidad: 20000, fecha: "2026-09-10", admin: ADMIN, ahora: horaRD("2026-09-10") });

    expect(r.contrato).toMatchObject({
      cantidadContratada: 100000,
      asignados: 50000,
      pendienteAsignar: 50000,
      fechaVencimiento: "2027-01-15",
    });

    await expect(
      registrarAsignacion({ empresaId, contratoId: contrato.id, cantidad: 50001, admin: ADMIN, ahora: horaRD("2026-10-01") }),
    ).rejects.toThrow(/supera la cantidad contratada/);
    expect((await contratoDb(contrato.id)).asignados).toBe(50000);
  });

  it("asignaciones simultáneas no superan lo contratado", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 0 });
    const resultados = await Promise.allSettled(
      [60, 60].map((cantidad) =>
        registrarAsignacion({ empresaId, contratoId: contrato.id, cantidad, admin: ADMIN, ahora: ENERO }),
      ),
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await contratoDb(contrato.id)).asignados).toBe(60);
  });

  it("no permite asignar a otro tenant (aislamiento)", async () => {
    const { contrato } = await empresaControlada();
    const otraEmpresa = await crearEmpresa({ modalidad: "CONTROLADO" });
    await expect(
      registrarAsignacion({ empresaId: otraEmpresa, contratoId: contrato.id, cantidad: 1, admin: ADMIN, ahora: ENERO }),
    ).rejects.toThrow(/no encontrado/);
  });
});

describe("renovación", () => {
  it("renovación anticipada: usa primero el que vence antes y no mezcla folios", async () => {
    const { empresaId, contrato: a } = await empresaControlada({ cantidad: 2, asignados: 2, vence: "2026-12-31" });
    const b = await crearContrato({
      empresaId,
      cantidadContratada: 10,
      fechaInicio: "2026-01-15",
      fechaVencimiento: "2027-12-31",
      asignacionInicial: 10,
      renovacionDe: a.id,
      admin: ADMIN,
      ahora: ENERO,
    });

    const r1 = await emitir(empresaId, "E320000000001");
    const r2 = await emitir(empresaId, "E320000000002");
    const r3 = await emitir(empresaId, "E320000000003");
    expect([r1.contratoId, r2.contratoId, r3.contratoId]).toEqual([a.id, a.id, b.id]);
    expect((await contratoDb(a.id)).consumidos).toBe(2);
    expect((await contratoDb(b.id)).consumidos).toBe(1);
    expect(await FolioContrato.countDocuments({ empresa: empresaId })).toBe(2);
  });

  it("renovación programada no habilita la emisión antes de su inicio y conserva el historial", async () => {
    const { empresaId, contrato: a } = await empresaControlada({ vence: "2026-06-30" });
    await crearContrato({
      empresaId,
      cantidadContratada: 50,
      fechaInicio: "2026-08-01",
      fechaVencimiento: "2027-07-31",
      asignacionInicial: 50,
      renovacionDe: a.id,
      admin: ADMIN,
      ahora: ENERO,
    });
    const hueco = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: horaRD("2026-07-15") });
    expect(hueco.codigo).toBe("FOLIOS_VENCIDOS");
    const nuevo = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: horaRD("2026-08-01", "00:00") });
    expect(nuevo.permitido).toBe(true);
    expect(await FolioContrato.findById(a.id)).not.toBeNull();
  });
});

describe("cambios de modalidad", () => {
  it("ILIMITADO -> CONTROLADO -> ILIMITADO aplica y retira el control, con auditoría", async () => {
    const empresaId = await crearEmpresa();
    expect((await reservarFolio({ userId: empresaId, ncf: "E320000000001" })).omitido).toBe(true);

    await cambiarModalidad({ empresaId, modalidad: "CONTROLADO", admin: ADMIN, motivo: "Compra de paquete" });
    expect((await reservarFolio({ userId: empresaId, ncf: "E320000000001" })).codigo).toBe(
      "FOLIOS_CONFIGURACION_INCOMPLETA",
    );

    await crearContrato({
      empresaId,
      cantidadContratada: 10,
      fechaInicio: "2026-01-15",
      fechaVencimiento: "2026-02-15",
      asignacionInicial: 10,
      admin: ADMIN,
      ahora: ENERO,
    });
    const vencido = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: horaRD("2026-03-01") });
    expect(vencido.codigo).toBe("FOLIOS_VENCIDOS");

    await cambiarModalidad({ empresaId, modalidad: "ILIMITADO", admin: ADMIN });
    const libre = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: horaRD("2026-03-01") });
    expect(libre.omitido).toBe(true);
    expect(await FolioContrato.countDocuments({ empresa: empresaId })).toBe(1);

    const auditoria = await FolioAuditoria.find({ empresa: empresaId, accion: "MODALIDAD_CAMBIADA" }).lean();
    expect(auditoria.map((a) => a.despues.modalidad)).toEqual(["CONTROLADO", "ILIMITADO"]);
    expect(auditoria[0].adminEmail).toBe(ADMIN.email);
  });
});

describe("concurrencia y reintentos", () => {
  it("dos envíos simultáneos con un solo folio: solo uno pasa", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 1, asignados: 1 });
    const [a, b] = await Promise.all([
      reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: ENERO }),
      reservarFolio({ userId: empresaId, ncf: "E320000000002", ahora: ENERO }),
    ]);
    const permitidos = [a, b].filter((r) => r.permitido);
    expect(permitidos).toHaveLength(1);
    expect([a, b].find((r) => !r.permitido).codigo).toBe("FOLIOS_AGOTADOS");
    expect((await contratoDb(contrato.id)).reservados).toBe(1);
  });

  it("el mismo e-NCF enviado en paralelo se reserva una sola vez", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 10, asignados: 10 });
    const resultados = await Promise.all(
      Array.from({ length: 3 }, () => reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: ENERO })),
    );
    expect(resultados.filter((r) => r.permitido)).toHaveLength(1);
    expect(resultados.filter((r) => r.codigo === "FOLIO_EN_PROCESO")).toHaveLength(2);
    expect((await contratoDb(contrato.id)).reservados).toBe(1);
  });

  it("reintentos no descuentan dos veces", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 10, asignados: 10 });
    await emitir(empresaId, "E320000000001");
    await emitir(empresaId, "E320000000001");
    await emitir(empresaId, "E320000000001");
    const c = await contratoDb(contrato.id);
    expect(c).toMatchObject({ consumidos: 1, reservados: 0 });
    const consumo = await FolioConsumo.findOne({ ncf: "E320000000001" }).lean();
    expect(consumo.intentos).toBe(3);
  });

  it("un envío que no llegó a The Factory libera la reserva y puede reintentarse", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 1, asignados: 1 });
    const r = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: ENERO });
    await liberarFolio(r, "ERROR_PREVIO_AL_ENVIO");
    expect(await contratoDb(contrato.id)).toMatchObject({ consumidos: 0, reservados: 0 });

    const reintento = await emitir(empresaId, "E320000000001");
    expect(reintento.permitido).toBe(true);
    expect(await contratoDb(contrato.id)).toMatchObject({ consumidos: 1, reservados: 0 });
  });

  it("reintento tras timeout reutiliza la reserva previa sin apartar otro folio", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 5, asignados: 5 });
    await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: ENERO });
    const enCurso = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: new Date(ENERO.getTime() + 1000) });
    expect(enCurso.codigo).toBe("FOLIO_EN_PROCESO");

    const despues = new Date(ENERO.getTime() + RESERVA_VIGENCIA_MS + 1000);
    const retomado = await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: despues });
    expect(retomado.permitido).toBe(true);
    expect((await contratoDb(contrato.id)).reservados).toBe(1);
    await registrarResultadoEnvio(retomado, { aceptado: true, codigo: 0 });
    expect(await contratoDb(contrato.id)).toMatchObject({ consumidos: 1, reservados: 0 });
  });

  it("reconciliación confirma lo que llegó a The Factory y libera lo que no", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 5, asignados: 5 });
    await reservarFolio({ userId: empresaId, ncf: "E320000000001", ahora: ENERO });
    await reservarFolio({ userId: empresaId, ncf: "E320000000002", ahora: ENERO });
    const stats = await reconciliarReservasPendientes({
      ahora: new Date(ENERO.getTime() + RESERVA_VIGENCIA_MS + 1000),
      verificar: async (c) => (c.ncf === "E320000000001" ? "existe" : "no_existe"),
    });
    expect(stats).toMatchObject({ revisadas: 2, confirmadas: 1, liberadas: 1 });
    expect(await contratoDb(contrato.id)).toMatchObject({ consumidos: 1, reservados: 0 });
  });
});

describe("alertas", () => {
  it("genera alertas de vencimiento y consumo sin duplicados", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 10, asignados: 10, vence: "2026-02-10" });
    for (let i = 1; i <= 8; i += 1) await emitir(empresaId, `E32000000000${i}`);

    const ahora = horaRD("2026-01-15");
    await evaluarAlertas({ ahora });
    await evaluarAlertas({ ahora });
    let tipos = (await FolioAlerta.find({ contrato: contrato.id }).lean()).map((a) => a.tipo).sort();
    expect(tipos).toEqual(["CONSUMO_80", "VENCE_30"]);

    await evaluarAlertas({ ahora: horaRD("2026-02-04") });
    await evaluarAlertas({ ahora: horaRD("2026-02-11") });
    tipos = (await FolioAlerta.find({ contrato: contrato.id }).lean()).map((a) => a.tipo).sort();
    expect(tipos).toEqual(["CONSUMO_80", "VENCE_30", "VENCE_7", "VENCIDO"]);
    expect(await listarAlertas()).toHaveLength(4);
  });

  it("alerta de 100 % al agotar por ajuste administrativo", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 10, asignados: 10 });
    await ajustarConsumo({ empresaId, contratoId: contrato.id, cantidad: 10, motivo: "Conciliación", admin: ADMIN, ahora: ENERO });
    const tipos = (await FolioAlerta.find({ contrato: contrato.id }).lean()).map((a) => a.tipo);
    expect(tipos).toContain("CONSUMO_100");
  });
});

describe("empresas que ya venían emitiendo", () => {
  it("el contrato arranca con fecha de inicio pasada y los consumidos a la fecha", async () => {
    const empresaId = await crearEmpresa({ modalidad: "CONTROLADO" });
    const c = await crearContrato({
      empresaId,
      cantidadContratada: 100000,
      fechaInicio: "2026-03-01",
      fechaVencimiento: "2027-02-28",
      asignacionInicial: 40000,
      consumoPrevio: 32500,
      admin: ADMIN,
      ahora: horaRD("2026-10-15"),
    });
    expect(c).toMatchObject({ consumoPrevio: 32500, consumidos: 32500, asignados: 40000, disponible: 7500 });

    const asignacion = await mongoose.connection.collection("folios_asignaciones").findOne({ contrato: new mongoose.Types.ObjectId(c.id) });
    expect(asignacion.fecha).toBe("2026-03-01");

    await emitir(empresaId, "E320000000001", horaRD("2026-10-15"));
    expect((await contratoDb(c.id)).consumidos).toBe(32501);
  });

  it("no permite consumidos previos mayores que la asignación inicial", async () => {
    const empresaId = await crearEmpresa({ modalidad: "CONTROLADO" });
    await expect(
      crearContrato({
        empresaId,
        cantidadContratada: 100,
        fechaInicio: "2026-01-15",
        fechaVencimiento: "2027-01-15",
        asignacionInicial: 50,
        consumoPrevio: 60,
        admin: ADMIN,
        ahora: ENERO,
      }),
    ).rejects.toThrow(/no pueden superar la asignación inicial/);
    expect(await FolioContrato.countDocuments()).toBe(0);
  });

  it("los consumidos previos se pueden corregir y sobreviven al recálculo", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 80 });
    await emitir(empresaId, "E320000000001");

    const editado = await actualizarContrato({
      empresaId,
      contratoId: contrato.id,
      cambios: { consumoPrevio: 30, motivo: "Carga inicial" },
      admin: ADMIN,
      ahora: ENERO,
    });
    expect(editado).toMatchObject({ consumoPrevio: 30, consumidos: 31, disponible: 49 });

    const corregido = await actualizarContrato({
      empresaId,
      contratoId: contrato.id,
      cambios: { consumoPrevio: 20 },
      admin: ADMIN,
      ahora: ENERO,
    });
    expect(corregido.consumidos).toBe(21);

    await expect(
      actualizarContrato({ empresaId, contratoId: contrato.id, cambios: { consumoPrevio: 81 }, admin: ADMIN, ahora: ENERO }),
    ).rejects.toThrow(/no pueden superar lo asignado/);

    await FolioContrato.updateOne({ _id: contrato.id }, { $set: { consumidos: 0 } });
    const recalculado = await recalcularContadores({ empresaId, contratoId: contrato.id, admin: ADMIN, ahora: ENERO });
    expect(recalculado.consumidos).toBe(21);
  });

  it("estima el consumo previo desde el historial de envíos con la regla de consumo", async () => {
    const empresaId = await crearEmpresa({ modalidad: "CONTROLADO" });
    const usuario = new mongoose.Types.ObjectId(empresaId);
    const envio = (ncf, extra) => ({
      ncf,
      rnc: "130476896",
      tipoComprobante: "32",
      usuario,
      ambiente: "production",
      fechaCreacion: horaRD("2026-05-10"),
      ...extra,
    });
    await mongoose.connection.collection("comprobantes_envios").insertMany([
      envio("E320000000001", { exitoso: true, respuestaCompleta: { procesado: true, codigo: 0 } }),
      envio("E320000000001", { exitoso: true, respuestaCompleta: { procesado: true, codigo: 0 } }),
      envio("E320000000002", { exitoso: false, respuestaCompleta: { procesado: false, codigo: 110 } }),
      envio("E320000000003", { exitoso: false, tipoError: "timeout" }),
      envio("E320000000004", { exitoso: true, ambiente: "demo", respuestaCompleta: { procesado: true } }),
      envio("E320000000005", { exitoso: true, fechaCreacion: horaRD("2026-02-28", "23:59"), respuestaCompleta: { procesado: true } }),
      envio("E320000000006", { exitoso: true, fechaCreacion: horaRD("2026-03-01", "00:00"), respuestaCompleta: { procesado: true } }),
    ]);

    const r = await estimarConsumoPrevio({ empresaId, desde: "2026-03-01", ahora: horaRD("2026-10-15") });
    expect(r).toMatchObject({ aceptados: 2, rechazados: 1, total: 3 });

    const otra = await crearEmpresa();
    expect((await estimarConsumoPrevio({ empresaId: otra, desde: "2026-03-01", ahora: horaRD("2026-10-15") })).total).toBe(0);
  });

  it("la estimación no repite e-NCF que el control ya contabilizó", async () => {
    const { empresaId } = await empresaControlada();
    await emitir(empresaId, "E320000000001");
    await mongoose.connection.collection("comprobantes_envios").insertOne({
      ncf: "E320000000001",
      rnc: "130476896",
      tipoComprobante: "32",
      usuario: new mongoose.Types.ObjectId(empresaId),
      ambiente: "production",
      exitoso: true,
      respuestaCompleta: { procesado: true, codigo: 0 },
      fechaCreacion: ENERO,
    });
    const r = await estimarConsumoPrevio({ empresaId, desde: "2026-01-01", ahora: horaRD("2026-01-16") });
    expect(r.total).toBe(0);
  });
});

describe("alerta mínima por email", () => {
  // Vigencia amplia: la confirmación de consumo evalúa con la fecha real del sistema.
  const VIGENCIA = { inicio: "2026-01-01", vence: "2099-12-31" };
  const alertaMinima = (contratoId) =>
    FolioAlerta.findOne({ contrato: contratoId, tipo: "MINIMO" }).lean();

  async function emitirVarios(empresaId, desde, hasta) {
    for (let i = desde; i <= hasta; i += 1) {
      const r = await emitir(empresaId, `E32${String(i).padStart(10, "0")}`);
      expect(r.permitido).toBe(true);
    }
  }

  it("avisa una sola vez al alcanzar el umbral (10 % por defecto del límite asignado)", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 10, ...VIGENCIA });
    expect((await obtenerResumenEmpresa(empresaId)).alertaMinima).toMatchObject({ pct: 10, limite: 10, umbral: 1 });

    await emitirVarios(empresaId, 1, 8);
    expect(await alertaMinima(contrato.id)).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();

    await emitirVarios(empresaId, 9, 9);
    const alerta = await alertaMinima(contrato.id);
    expect(alerta).toMatchObject({ atendida: false, emailIntentos: 1, emailError: "" });
    expect(alerta.emailEnviadoEn).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe("alertas@giganet.test");
    expect(email.subject).toContain("Folios bajos");
    expect(email.subject).toContain("(1 disponible)");
    expect(email.htmlContent).toContain(contrato.codigo);

    await emitirVarios(empresaId, 10, 10);
    await evaluarAlertas();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await FolioAlerta.countDocuments({ tipo: "MINIMO" })).toBe(1);
  });

  it("una asignación nueva rearma la alerta y el siguiente cruce vuelve a avisar", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 10, ...VIGENCIA });
    await ajustarConsumo({ empresaId, contratoId: contrato.id, cantidad: 9, motivo: "Carga", admin: ADMIN });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    await registrarAsignacion({ empresaId, contratoId: contrato.id, cantidad: 10, admin: ADMIN });
    expect(await alertaMinima(contrato.id)).toBeNull();
    expect(await FolioAuditoria.countDocuments({ accion: "ALERTA_MINIMA_REARMADA" })).toBe(1);

    await ajustarConsumo({ empresaId, contratoId: contrato.id, cantidad: 8, motivo: "Carga", admin: ADMIN });
    expect(await alertaMinima(contrato.id)).toBeNull();
    await ajustarConsumo({ empresaId, contratoId: contrato.id, cantidad: 1, motivo: "Carga", admin: ADMIN });
    expect(await alertaMinima(contrato.id)).not.toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][0].subject).toContain("(2 disponibles)");
  });

  it("un fallo de Brevo no afecta la emisión y el cron reintenta el email", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 10, ...VIGENCIA });
    await emitirVarios(empresaId, 1, 8);
    sendEmail.mockRejectedValueOnce({ success: false, error: "Brevo caído" });

    await emitirVarios(empresaId, 9, 9);
    expect((await contratoDb(contrato.id)).consumidos).toBe(9);
    const fallida = await alertaMinima(contrato.id);
    expect(fallida).toMatchObject({ emailEnviadoEn: null, emailError: "Brevo caído", emailIntentos: 1 });

    expect(await reintentarEmailsAlertas()).toMatchObject({ pendientes: 1, enviados: 1, fallidos: 0 });
    const enviada = await alertaMinima(contrato.id);
    expect(enviada.emailEnviadoEn).toBeInstanceOf(Date);
    expect(enviada.emailError).toBe("");
    expect(await reintentarEmailsAlertas()).toMatchObject({ pendientes: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("no avisa con la alerta desactivada ni en modalidad ILIMITADO", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 10, ...VIGENCIA });
    await configurarAlertaMinima({ empresaId, pct: null, admin: ADMIN });
    await ajustarConsumo({ empresaId, contratoId: contrato.id, cantidad: 9, motivo: "Carga", admin: ADMIN });
    expect(await alertaMinima(contrato.id)).toBeNull();

    const otra = await empresaControlada({ cantidad: 100, asignados: 10, ...VIGENCIA });
    await cambiarModalidad({ empresaId: otra.empresaId, modalidad: "ILIMITADO", admin: ADMIN });
    await ajustarConsumo({ empresaId: otra.empresaId, contratoId: otra.contrato.id, cantidad: 9, motivo: "Carga", admin: ADMIN });
    await evaluarAlertas();
    expect(await FolioAlerta.countDocuments({ tipo: "MINIMO" })).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("valida el porcentaje y al subirlo avisa si el disponible ya está bajo el nuevo umbral", async () => {
    const { empresaId, contrato } = await empresaControlada({ cantidad: 100, asignados: 100, ...VIGENCIA });
    for (const pct of [0, 91, 2.5, "abc"]) {
      await expect(configurarAlertaMinima({ empresaId, pct, admin: ADMIN })).rejects.toThrow(/porcentaje/);
    }
    await expect(configurarAlertaMinima({ empresaId, pct: 10, admin: ADMIN })).rejects.toThrow(/No hay cambios/);

    await ajustarConsumo({ empresaId, contratoId: contrato.id, cantidad: 70, motivo: "Carga", admin: ADMIN });
    expect(sendEmail).not.toHaveBeenCalled();

    const resumen = await configurarAlertaMinima({ empresaId, pct: 30, admin: ADMIN });
    expect(resumen.alertaMinima).toMatchObject({ pct: 30, limite: 100, umbral: 30 });
    expect(await alertaMinima(contrato.id)).not.toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await FolioAuditoria.countDocuments({ accion: "ALERTA_MINIMA_CONFIGURADA" })).toBe(1);

    const legada = await crearEmpresaLegada();
    expect((await obtenerResumenEmpresa(legada)).alertaMinima.pct).toBe(10);
  });
});

describe("panel", () => {
  it("lista empresas con modalidad, estado y filtros", async () => {
    await crearEmpresaLegada();
    await empresaControlada({ cantidad: 100, asignados: 40 });
    const panel = await listarPanelFolios({ ahora: ENERO });
    expect(panel.totales).toMatchObject({ empresas: 2, controladas: 1, ilimitadas: 1 });

    const controladas = await listarPanelFolios({ modalidad: "CONTROLADO", ahora: ENERO });
    expect(controladas.items).toHaveLength(1);
    expect(controladas.items[0].contrato).toMatchObject({ cantidadContratada: 100, asignados: 40, disponible: 40, pendienteAsignar: 60 });

    const porVencimiento = await listarPanelFolios({ vencDesde: "2027-01-01", vencHasta: "2027-01-31", ahora: ENERO });
    expect(porVencimiento.items).toHaveLength(1);
  });
});
