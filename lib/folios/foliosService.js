import mongoose from "mongoose";
import User from "@/app/models/user";
import FolioContrato from "@/app/models/folioContrato";
import FolioAsignacion from "@/app/models/folioAsignacion";
import FolioConsumo from "@/app/models/folioConsumo";
import FolioAlerta from "@/app/models/folioAlerta";
import FolioAuditoria from "@/app/models/folioAuditoria";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import { asegurarConexionFolios } from "./conexion";
import { registrarAuditoria } from "./auditoria";
import { BLOQUEOS_FOLIOS, MENSAJES_ALERTA } from "./mensajes";
import { enviarEmailAlertaMinima } from "./notificaciones";
import { diasEntre, esDiaValido, hoyRD, inicioDiaRD } from "./fechasRD";
import {
  ALERTA_MINIMA_PCT_MAX,
  MODALIDADES,
  MODALIDAD_CONTROLADO,
  alertaMinimaPctEmpresa,
  contratosVigentes,
  disponibleContrato,
  esVigente,
  estadoEmpresa,
  limiteEmision,
  modalidadEmpresa,
  motivoBloqueoPorVigencia,
  resumenContrato,
  seleccionarContratoActual,
  umbralMinimo,
} from "./estado";

/**
 * Regla de consumo:
 * - "llega_thefactory": consume todo e-NCF al que The Factory respondió el envío (aceptado o rechazado).
 * - "aceptado": consume solo los e-NCF aceptados (procesado y código 0).
 */
export const REGLA_CONSUMO = "llega_thefactory";

/** Una reserva sin respuesta más antigua que esto se considera abandonada y se reconcilia. */
export const RESERVA_VIGENCIA_MS = 5 * 60 * 1000;

export class FoliosError extends Error {
  constructor(message, status = 400, code = "FOLIOS_ERROR") {
    super(message);
    this.name = "FoliosError";
    this.status = status;
    this.code = code;
  }
}

function omitido(motivo) {
  return { permitido: true, omitido: true, motivo };
}

function bloqueo(codigo) {
  const b = BLOQUEOS_FOLIOS[codigo];
  return { permitido: false, codigo, httpStatus: b.httpStatus, message: b.message };
}

/** Convierte un bloqueo de `reservarFolio` en `{ status, data }` de enviar-factura. */
export function respuestaBloqueoFolios(reserva) {
  return {
    status: reserva.httpStatus,
    data: { status: "error", message: reserva.message, errorType: reserva.codigo },
  };
}

function esObjectIdValido(id) {
  return mongoose.isValidObjectId(id);
}

function exigirIds(...ids) {
  if (!ids.every(esObjectIdValido)) {
    throw new FoliosError("Identificador inválido", 400);
  }
}

function parseEntero(valor, { min, campo }) {
  const n = typeof valor === "string" ? Number(valor.replace(/,/g, "").trim()) : Number(valor);
  if (!Number.isInteger(n) || n < min) {
    throw new FoliosError(`${campo} debe ser un número entero mayor o igual a ${min}`);
  }
  return n;
}

function validarDia(valor, campo) {
  if (!esDiaValido(valor)) {
    throw new FoliosError(`${campo} no es una fecha válida (AAAA-MM-DD)`);
  }
  return valor;
}

// ---------------------------------------------------------------------------
// Emisión: reserva / confirmación / liberación
// ---------------------------------------------------------------------------

/**
 * Valida y reserva un folio antes de contactar a The Factory.
 * Empresas ILIMITADO, ambiente de pruebas o sin usuario: `{ permitido: true, omitido: true }` sin escribir nada.
 * @returns {Promise<{ permitido: boolean, omitido?: boolean, consumoId?: string, contratoId?: string|null, yaContabilizado?: boolean, codigo?: string, httpStatus?: number, message?: string }>}
 */
export async function reservarFolio({
  userId,
  ncf,
  tipoComprobante = "",
  ambienteKey = "production",
  ahora = new Date(),
} = {}) {
  if (!userId) return omitido("SIN_USUARIO");
  if (ambienteKey !== "production") return omitido("AMBIENTE_PRUEBAS");

  const user = await User.findById(userId).select("empresa.folios").lean();
  if (modalidadEmpresa(user?.empresa) !== MODALIDAD_CONTROLADO) {
    return omitido("ILIMITADO");
  }

  await asegurarConexionFolios();
  const hoy = hoyRD(ahora);
  const contratos = await FolioContrato.find({ empresa: userId, estado: "activo" }).lean();
  const motivo = motivoBloqueoPorVigencia(contratos, hoy);
  if (motivo) return bloqueo(motivo);

  const ncfNorm = String(ncf ?? "").trim().toUpperCase();
  if (!ncfNorm) return bloqueo("FOLIO_NCF_REQUERIDO");

  const vigentes = contratosVigentes(contratos, hoy);
  const idsVigentes = new Set(vigentes.map((c) => String(c._id)));
  const filtroConsumo = { empresa: userId, ncf: ncfNorm, ambiente: ambienteKey };
  let consumo = await FolioConsumo.findOne(filtroConsumo).lean();

  if (consumo?.estado === "confirmado") {
    await FolioConsumo.updateOne(
      { _id: consumo._id },
      { $inc: { intentos: 1 }, $set: { ultimoIntentoEn: ahora } },
    );
    return {
      permitido: true,
      consumoId: String(consumo._id),
      contratoId: consumo.contrato ? String(consumo.contrato) : null,
      yaContabilizado: true,
    };
  }

  if (consumo?.estado === "reservado") {
    const enCurso = ahora - new Date(consumo.reservadoEn) < RESERVA_VIGENCIA_MS;
    if (enCurso) return bloqueo("FOLIO_EN_PROCESO");
    if (consumo.contrato && idsVigentes.has(String(consumo.contrato))) {
      // Reintento tras un timeout: reutiliza la reserva previa (el folio ya está apartado).
      const retomado = await FolioConsumo.findOneAndUpdate(
        { _id: consumo._id, estado: "reservado", reservadoEn: consumo.reservadoEn },
        {
          $set: { reservadoEn: ahora, ultimoIntentoEn: ahora, pendienteVerificacion: false },
          $inc: { intentos: 1 },
        },
        { returnDocument: "after" },
      ).lean();
      if (!retomado) return bloqueo("FOLIO_EN_PROCESO");
      return {
        permitido: true,
        consumoId: String(retomado._id),
        contratoId: String(retomado.contrato),
      };
    }
    await liberarConsumoPorId(consumo._id, "CONTRATO_NO_VIGENTE", ahora);
    consumo = await FolioConsumo.findOne(filtroConsumo).lean();
  }

  let consumoId;
  if (consumo) {
    const reclamado = await FolioConsumo.findOneAndUpdate(
      { _id: consumo._id, estado: "liberado" },
      {
        $set: {
          estado: "reservado",
          contrato: null,
          reservadoEn: ahora,
          ultimoIntentoEn: ahora,
          liberadoEn: null,
          motivoLiberacion: "",
          pendienteVerificacion: false,
        },
        $inc: { intentos: 1 },
      },
      { returnDocument: "after" },
    ).lean();
    if (!reclamado) return bloqueo("FOLIO_EN_PROCESO");
    consumoId = reclamado._id;
  } else {
    try {
      const creado = await FolioConsumo.create({
        ...filtroConsumo,
        tipoComprobante: String(tipoComprobante || ""),
        estado: "reservado",
        reservadoEn: ahora,
        ultimoIntentoEn: ahora,
        intentos: 1,
      });
      consumoId = creado._id;
    } catch (err) {
      if (err?.code === 11000) return bloqueo("FOLIO_EN_PROCESO");
      throw err;
    }
  }

  for (const contrato of vigentes) {
    const reservado = await FolioContrato.findOneAndUpdate(
      {
        _id: contrato._id,
        estado: "activo",
        $expr: {
          $lt: [
            { $add: ["$consumidos", "$reservados"] },
            { $min: ["$asignados", "$cantidadContratada"] },
          ],
        },
      },
      { $inc: { reservados: 1 } },
      { returnDocument: "after", projection: { _id: 1 } },
    ).lean();
    if (reservado) {
      await FolioConsumo.updateOne({ _id: consumoId }, { $set: { contrato: reservado._id } });
      return {
        permitido: true,
        consumoId: String(consumoId),
        contratoId: String(reservado._id),
      };
    }
  }

  await FolioConsumo.updateOne(
    { _id: consumoId, estado: "reservado" },
    { $set: { estado: "liberado", liberadoEn: ahora, motivoLiberacion: "SIN_SALDO" } },
  );
  return bloqueo("FOLIOS_AGOTADOS");
}

async function confirmarConsumoPorId(consumoId, { resultado, codigo = null, ahora = new Date() }) {
  const consumo = await FolioConsumo.findOneAndUpdate(
    { _id: consumoId, estado: "reservado" },
    {
      $set: {
        estado: "confirmado",
        confirmadoEn: ahora,
        resultado,
        codigoRespuesta: codigo,
        pendienteVerificacion: false,
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!consumo?.contrato) return null;

  let contrato = await FolioContrato.findOneAndUpdate(
    { _id: consumo.contrato, reservados: { $gt: 0 } },
    { $inc: { reservados: -1, consumidos: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!contrato) {
    contrato = await FolioContrato.findOneAndUpdate(
      { _id: consumo.contrato },
      { $inc: { consumidos: 1 } },
      { returnDocument: "after" },
    ).lean();
  }
  if (contrato) {
    await generarAlertasContrato(contrato, hoyRD(ahora));
  }
  return contrato;
}

async function liberarConsumoPorId(consumoId, motivo, ahora = new Date()) {
  const consumo = await FolioConsumo.findOneAndUpdate(
    { _id: consumoId, estado: "reservado" },
    {
      $set: {
        estado: "liberado",
        liberadoEn: ahora,
        motivoLiberacion: motivo,
        pendienteVerificacion: false,
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (consumo?.contrato) {
    await FolioContrato.updateOne(
      { _id: consumo.contrato, reservados: { $gt: 0 } },
      { $inc: { reservados: -1 } },
    );
  }
  return consumo;
}

function registrarFalloContable(accion, reserva, err) {
  console.error(
    `[folios] No se pudo ${accion} el consumo ${reserva?.consumoId ?? "?"}:`,
    err?.message || err,
  );
}

/**
 * The Factory respondió el envío (aceptado o rechazado). Nunca lanza: un fallo contable
 * no debe alterar la respuesta del envío.
 */
export async function registrarResultadoEnvio(reserva, { aceptado, codigo = null } = {}) {
  if (!reserva?.consumoId) return;
  const resultado = aceptado ? "aceptado" : "rechazado";
  try {
    if (reserva.yaContabilizado) {
      await FolioConsumo.updateOne(
        { _id: reserva.consumoId },
        { $set: { resultado, codigoRespuesta: codigo } },
      );
      return;
    }
    if (REGLA_CONSUMO === "aceptado" && !aceptado) {
      await liberarConsumoPorId(reserva.consumoId, "RECHAZADO_THEFACTORY");
      return;
    }
    await confirmarConsumoPorId(reserva.consumoId, { resultado, codigo });
  } catch (err) {
    registrarFalloContable("confirmar", reserva, err);
  }
}

/** El envío no llegó a The Factory: devuelve la reserva al contrato. Nunca lanza. */
export async function liberarFolio(reserva, motivo = "NO_ENVIADO") {
  if (!reserva?.consumoId || reserva.yaContabilizado) return;
  try {
    await liberarConsumoPorId(reserva.consumoId, motivo);
  } catch (err) {
    registrarFalloContable("liberar", reserva, err);
  }
}

/** Envío sin respuesta (timeout/red): la reserva queda apartada hasta la reconciliación. Nunca lanza. */
export async function marcarFolioPendiente(reserva) {
  if (!reserva?.consumoId || reserva.yaContabilizado) return;
  try {
    await FolioConsumo.updateOne(
      { _id: reserva.consumoId, estado: "reservado" },
      { $set: { pendienteVerificacion: true } },
    );
  } catch (err) {
    registrarFalloContable("marcar como pendiente", reserva, err);
  }
}

/**
 * Resuelve reservas abandonadas (timeouts) consultando el estatus en The Factory.
 * @param {{ verificar: (consumo: object) => Promise<"existe"|"no_existe"|null>, ahora?: Date, limite?: number }} opciones
 */
export async function reconciliarReservasPendientes({ verificar, ahora = new Date(), limite = 50 }) {
  await asegurarConexionFolios();
  const corte = new Date(ahora.getTime() - RESERVA_VIGENCIA_MS);
  const pendientes = await FolioConsumo.find({
    estado: "reservado",
    reservadoEn: { $lt: corte },
  })
    .sort({ reservadoEn: 1 })
    .limit(limite)
    .lean();

  const stats = { revisadas: pendientes.length, confirmadas: 0, liberadas: 0, sinResolver: 0 };
  for (const consumo of pendientes) {
    if (!consumo.contrato) {
      await liberarConsumoPorId(consumo._id, "RESERVA_INCOMPLETA", ahora);
      stats.liberadas += 1;
      continue;
    }
    let resultado = null;
    try {
      resultado = await verificar(consumo);
    } catch (err) {
      console.error("[folios] Error verificando estatus:", err?.message || err);
    }
    if (resultado === "existe") {
      await confirmarConsumoPorId(consumo._id, { resultado: "verificado", ahora });
      stats.confirmadas += 1;
    } else if (resultado === "no_existe") {
      await liberarConsumoPorId(consumo._id, "NO_LLEGO_A_THEFACTORY", ahora);
      stats.liberadas += 1;
    } else {
      await FolioConsumo.updateOne(
        { _id: consumo._id, estado: "reservado" },
        { $set: { pendienteVerificacion: true } },
      );
      stats.sinResolver += 1;
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

/** Tipo de alerta más específico aplicable al contrato hoy (vencimiento y consumo). */
export function tiposAlertaContrato(contrato, hoy) {
  if (contrato.estado !== "activo" || hoy < contrato.fechaInicio) return [];
  const tipos = [];
  const cantidad = contrato.cantidadContratada || 0;
  const pct = cantidad ? (contrato.consumidos || 0) / cantidad : 0;
  if (pct >= 1) tipos.push("CONSUMO_100");
  else if (pct >= 0.8) tipos.push("CONSUMO_80");

  const dias = diasEntre(hoy, contrato.fechaVencimiento);
  if (dias < 0) {
    if (dias >= -30) tipos.push("VENCIDO");
  } else if (dias <= 7) tipos.push("VENCE_7");
  else if (dias <= 15) tipos.push("VENCE_15");
  else if (dias <= 30) tipos.push("VENCE_30");
  return tipos;
}

const SELECT_EMPRESA_ALERTA = "empresa.nombre empresa.razonSocial empresa.rnc empresa.folios";
export const EMAIL_ALERTA_MAX_INTENTOS = 5;

function mensajeError(err) {
  return String(err?.error || err?.message || err || "Error desconocido").slice(0, 500);
}

/**
 * Envía el email de una alerta MINIMO una sola vez: la marca como enviada antes de llamar a Brevo
 * (evita duplicados en paralelo) y revierte la marca si falla. Nunca lanza.
 */
async function notificarAlertaMinima(alertaId, { user, contrato, pct }) {
  const reclamada = await FolioAlerta.findOneAndUpdate(
    { _id: alertaId, emailEnviadoEn: null, emailIntentos: { $lt: EMAIL_ALERTA_MAX_INTENTOS } },
    { $set: { emailEnviadoEn: new Date(), emailError: "" }, $inc: { emailIntentos: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!reclamada) return false;
  try {
    await enviarEmailAlertaMinima({
      empresa: {
        id: String(user._id),
        nombre: user.empresa?.razonSocial || user.empresa?.nombre || "Sin nombre",
        rnc: user.empresa?.rnc || "",
      },
      contrato,
      disponible: disponibleContrato(contrato),
      limite: limiteEmision(contrato),
      umbral: umbralMinimo(contrato, pct),
      pct,
    });
    return true;
  } catch (err) {
    console.error("[folios] No se pudo enviar el email de alerta mínima:", mensajeError(err));
    await FolioAlerta.updateOne(
      { _id: alertaId },
      { $set: { emailEnviadoEn: null, emailError: mensajeError(err) } },
    ).catch(() => {});
    return false;
  }
}

/**
 * Alerta mínima: crea la alerta MINIMO y avisa por email cuando el disponible cae al umbral;
 * la rearma (borra) cuando el disponible vuelve a superarlo.
 */
async function evaluarAlertaMinima(contrato, hoy, user) {
  if (!user || modalidadEmpresa(user.empresa) !== MODALIDAD_CONTROLADO) return 0;
  if (!esVigente(contrato, hoy)) return 0;
  const pct = alertaMinimaPctEmpresa(user.empresa);
  const umbral = umbralMinimo(contrato, pct);
  if (umbral === null) return 0;

  const disponible = disponibleContrato(contrato);
  if (disponible > umbral) {
    const r = await FolioAlerta.deleteOne({ contrato: contrato._id, tipo: "MINIMO" });
    if (r.deletedCount) {
      await registrarAuditoria({
        accion: "ALERTA_MINIMA_REARMADA",
        empresa: contrato.empresa,
        contrato: contrato._id,
        despues: { disponible, umbral, pct },
      });
    }
    return 0;
  }

  let alerta = null;
  try {
    alerta = await FolioAlerta.findOneAndUpdate(
      { contrato: contrato._id, tipo: "MINIMO" },
      {
        $setOnInsert: {
          empresa: contrato.empresa,
          mensaje: `Quedan ${disponible.toLocaleString("es-DO")} folios disponibles (mínimo configurado: ${pct} %, ${umbral.toLocaleString("es-DO")} folios)`,
          atendida: false,
        },
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return 0;
  }
  const creada = !alerta?.lastErrorObject?.updatedExisting;
  if (creada && alerta?.value) {
    await notificarAlertaMinima(alerta.value._id, { user, contrato, pct });
  }
  return creada ? 1 : 0;
}

/** Reintenta los emails de alertas MINIMO que no se pudieron enviar. */
export async function reintentarEmailsAlertas({ ahora = new Date() } = {}) {
  await asegurarConexionFolios();
  const pendientes = await FolioAlerta.find({
    tipo: "MINIMO",
    atendida: false,
    emailEnviadoEn: null,
    emailIntentos: { $lt: EMAIL_ALERTA_MAX_INTENTOS },
  })
    .limit(50)
    .lean();
  const stats = { pendientes: pendientes.length, enviados: 0, fallidos: 0, omitidos: 0 };
  const hoy = hoyRD(ahora);
  for (const alerta of pendientes) {
    const [contrato, user] = await Promise.all([
      FolioContrato.findById(alerta.contrato).lean(),
      User.findById(alerta.empresa).select(SELECT_EMPRESA_ALERTA).lean(),
    ]);
    const pct = alertaMinimaPctEmpresa(user?.empresa);
    if (
      !contrato ||
      !user ||
      modalidadEmpresa(user.empresa) !== MODALIDAD_CONTROLADO ||
      !esVigente(contrato, hoy) ||
      umbralMinimo(contrato, pct) === null
    ) {
      stats.omitidos += 1;
      continue;
    }
    if (await notificarAlertaMinima(alerta._id, { user, contrato, pct })) stats.enviados += 1;
    else stats.fallidos += 1;
  }
  return stats;
}

async function generarAlertasContrato(contrato, hoy, user = undefined) {
  let creadas = 0;
  const empresa =
    user === undefined
      ? await User.findById(contrato.empresa).select(SELECT_EMPRESA_ALERTA).lean()
      : user;
  creadas += await evaluarAlertaMinima(contrato, hoy, empresa);
  for (const tipo of tiposAlertaContrato(contrato, hoy)) {
    try {
      const r = await FolioAlerta.updateOne(
        { contrato: contrato._id, tipo },
        {
          $setOnInsert: {
            empresa: contrato.empresa,
            mensaje: MENSAJES_ALERTA[tipo],
            atendida: false,
          },
        },
        { upsert: true },
      );
      if (r.upsertedCount) creadas += 1;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  return creadas;
}

/** Genera alertas pendientes de todas las empresas CONTROLADO (idempotente). */
export async function evaluarAlertas({ ahora = new Date() } = {}) {
  await asegurarConexionFolios();
  const hoy = hoyRD(ahora);
  const empresas = await User.find({ "empresa.folios.modalidad": MODALIDAD_CONTROLADO })
    .select(SELECT_EMPRESA_ALERTA)
    .lean();
  const empresasPorId = new Map(empresas.map((e) => [String(e._id), e]));
  const contratos = await FolioContrato.find({
    empresa: { $in: empresas.map((e) => e._id) },
    estado: "activo",
  }).lean();
  let creadas = 0;
  for (const contrato of contratos) {
    creadas += await generarAlertasContrato(contrato, hoy, empresasPorId.get(String(contrato.empresa)) ?? null);
  }
  return { empresas: empresas.length, contratos: contratos.length, alertasCreadas: creadas };
}

function serializarAlerta(a, extras = {}) {
  return {
    id: String(a._id),
    empresa: String(a.empresa),
    contrato: String(a.contrato),
    tipo: a.tipo,
    mensaje: a.mensaje,
    emailEnviadoEn: a.emailEnviadoEn ?? null,
    emailError: a.emailError || "",
    atendida: !!a.atendida,
    atendidaEn: a.atendidaEn ?? null,
    createdAt: a.createdAt ?? null,
    ...extras,
  };
}

/** Alertas activas de empresas que siguen en CONTROLADO (las ILIMITADO no generan alertas). */
export async function listarAlertas({ incluirAtendidas = false, limite = 200 } = {}) {
  await asegurarConexionFolios();
  const alertas = await FolioAlerta.find(incluirAtendidas ? {} : { atendida: false })
    .sort({ atendida: 1, createdAt: -1 })
    .limit(limite)
    .lean();
  if (!alertas.length) return [];

  const empresaIds = [...new Set(alertas.map((a) => String(a.empresa)))];
  const contratoIds = [...new Set(alertas.map((a) => String(a.contrato)))];
  const [usuarios, contratos] = await Promise.all([
    User.find({ _id: { $in: empresaIds } })
      .select("empresa.nombre empresa.razonSocial empresa.rnc empresa.folios")
      .lean(),
    FolioContrato.find({ _id: { $in: contratoIds } }).select("codigo fechaVencimiento").lean(),
  ]);
  const usuariosPorId = new Map(usuarios.map((u) => [String(u._id), u]));
  const contratosPorId = new Map(contratos.map((c) => [String(c._id), c]));

  return alertas
    .filter((a) => {
      const u = usuariosPorId.get(String(a.empresa));
      return u && modalidadEmpresa(u.empresa) === MODALIDAD_CONTROLADO;
    })
    .map((a) => {
      const u = usuariosPorId.get(String(a.empresa));
      const c = contratosPorId.get(String(a.contrato));
      return serializarAlerta(a, {
        empresaNombre: u.empresa?.razonSocial || u.empresa?.nombre || "Sin nombre",
        empresaRnc: u.empresa?.rnc || "",
        contratoCodigo: c?.codigo || "",
        fechaVencimiento: c?.fechaVencimiento || "",
      });
    });
}

export async function atenderAlerta({ alertaId, admin }) {
  exigirIds(alertaId);
  await asegurarConexionFolios();
  const alerta = await FolioAlerta.findOneAndUpdate(
    { _id: alertaId, atendida: false },
    { $set: { atendida: true, atendidaEn: new Date(), atendidaPor: admin?.id ?? null } },
    { returnDocument: "after" },
  ).lean();
  if (!alerta) throw new FoliosError("Alerta no encontrada o ya atendida", 404);
  await registrarAuditoria({
    accion: "ALERTA_ATENDIDA",
    empresa: alerta.empresa,
    contrato: alerta.contrato,
    admin,
    despues: { tipo: alerta.tipo },
  });
  return serializarAlerta(alerta);
}

// ---------------------------------------------------------------------------
// Administración de empresa y contratos
// ---------------------------------------------------------------------------

async function obtenerEmpresaOFallar(empresaId, select) {
  exigirIds(empresaId);
  const user = await User.findById(empresaId).select(select).lean();
  if (!user) throw new FoliosError("Empresa no encontrada", 404);
  return user;
}

async function obtenerContratoOFallar(empresaId, contratoId) {
  exigirIds(empresaId, contratoId);
  await asegurarConexionFolios();
  const contrato = await FolioContrato.findOne({ _id: contratoId, empresa: empresaId }).lean();
  if (!contrato) throw new FoliosError("Contrato no encontrado para esta empresa", 404);
  return contrato;
}

function serializarAuditoria(a) {
  return {
    id: String(a._id),
    accion: a.accion,
    contrato: a.contrato ? String(a.contrato) : null,
    adminEmail: a.adminEmail || "",
    antes: a.antes ?? null,
    despues: a.despues ?? null,
    motivo: a.motivo || "",
    createdAt: a.createdAt ?? null,
  };
}

/** Estado completo de folios de una empresa para el panel de administración. */
export async function obtenerResumenEmpresa(empresaId, { ahora = new Date() } = {}) {
  const user = await obtenerEmpresaOFallar(
    empresaId,
    "empresa.nombre empresa.razonSocial empresa.rnc empresa.theFactoryAmbiente empresa.folios",
  );
  await asegurarConexionFolios();
  const hoy = hoyRD(ahora);
  const modalidad = modalidadEmpresa(user.empresa);
  const [contratos, alertas, auditoria] = await Promise.all([
    FolioContrato.find({ empresa: empresaId }).sort({ fechaInicio: -1, createdAt: -1 }).lean(),
    FolioAlerta.find({ empresa: empresaId, atendida: false }).sort({ createdAt: -1 }).lean(),
    FolioAuditoria.find({ empresa: empresaId }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);

  const controlado = modalidad === MODALIDAD_CONTROLADO;
  let bloqueoEmision = null;
  if (controlado) {
    const motivo = motivoBloqueoPorVigencia(contratos, hoy);
    const codigo =
      motivo ||
      (contratosVigentes(contratos, hoy).every((c) => disponibleContrato(c) === 0)
        ? "FOLIOS_AGOTADOS"
        : null);
    if (codigo) bloqueoEmision = { codigo, message: BLOQUEOS_FOLIOS[codigo].message };
  }
  const actual = controlado ? seleccionarContratoActual(contratos, hoy) : null;
  const ambiente = user.empresa?.theFactoryAmbiente === "demo" ? "demo" : "production";
  const alertaMinimaPct = alertaMinimaPctEmpresa(user.empresa);

  return {
    empresa: {
      id: String(user._id),
      nombre: user.empresa?.razonSocial || user.empresa?.nombre || "",
      rnc: user.empresa?.rnc || "",
      ambiente,
    },
    hoy,
    modalidad,
    modalidadActualizadaEn: user.empresa?.folios?.actualizadoEn ?? null,
    controlAplica: ambiente === "production",
    alertaMinima: {
      pct: alertaMinimaPct,
      limite: actual ? limiteEmision(actual) : 0,
      umbral: actual ? umbralMinimo(actual, alertaMinimaPct) : null,
    },
    estado: estadoEmpresa(modalidad, contratos, hoy),
    bloqueoEmision,
    contratoActual: actual ? resumenContrato(actual, hoy) : null,
    contratos: contratos.map((c) => resumenContrato(c, hoy)),
    alertas: controlado ? alertas.map((a) => serializarAlerta(a)) : [],
    auditoria: auditoria.map(serializarAuditoria),
  };
}

export async function cambiarModalidad({ empresaId, modalidad, admin, motivo = "" }) {
  if (!MODALIDADES.includes(modalidad)) {
    throw new FoliosError("La modalidad debe ser ILIMITADO o CONTROLADO");
  }
  const user = await obtenerEmpresaOFallar(empresaId, "empresa.folios");
  const anterior = modalidadEmpresa(user.empresa);
  await User.findByIdAndUpdate(
    empresaId,
    {
      $set: {
        "empresa.folios.modalidad": modalidad,
        "empresa.folios.actualizadoEn": new Date(),
        "empresa.folios.actualizadoPor": admin?.id ?? null,
      },
    },
    { runValidators: true },
  );
  await asegurarConexionFolios();
  await registrarAuditoria({
    accion: "MODALIDAD_CAMBIADA",
    empresa: empresaId,
    admin,
    antes: { modalidad: anterior },
    despues: { modalidad },
    motivo,
  });
  if (modalidad === MODALIDAD_CONTROLADO) await reevaluarAlertasEmpresa(empresaId);
  return obtenerResumenEmpresa(empresaId);
}

async function reevaluarAlertasEmpresa(empresaId, ahora = new Date()) {
  const user = await User.findById(empresaId).select(SELECT_EMPRESA_ALERTA).lean();
  const contratos = await FolioContrato.find({ empresa: empresaId, estado: "activo" }).lean();
  const hoy = hoyRD(ahora);
  for (const contrato of contratos) {
    await generarAlertasContrato(contrato, hoy, user);
  }
}

/** Configura el % de alerta mínima (1–90); vacío o null la desactiva. */
export async function configurarAlertaMinima({ empresaId, pct, admin, ahora = new Date() }) {
  const user = await obtenerEmpresaOFallar(empresaId, "empresa.folios");
  const nuevo = valorOpcional(pct)
    ? parseEntero(pct, { min: 1, campo: "El porcentaje de alerta mínima" })
    : null;
  if (nuevo !== null && nuevo > ALERTA_MINIMA_PCT_MAX) {
    throw new FoliosError(`El porcentaje de alerta mínima no puede superar ${ALERTA_MINIMA_PCT_MAX} %`);
  }
  const anterior = alertaMinimaPctEmpresa(user.empresa);
  if (nuevo === anterior) throw new FoliosError("No hay cambios para guardar");

  await User.findByIdAndUpdate(
    empresaId,
    { $set: { "empresa.folios.alertaMinimaPct": nuevo } },
    { runValidators: true },
  );
  await asegurarConexionFolios();
  await registrarAuditoria({
    accion: "ALERTA_MINIMA_CONFIGURADA",
    empresa: empresaId,
    admin,
    antes: { alertaMinimaPct: anterior },
    despues: { alertaMinimaPct: nuevo },
  });
  if (modalidadEmpresa(user.empresa) === MODALIDAD_CONTROLADO) {
    await reevaluarAlertasEmpresa(empresaId, ahora);
  }
  return obtenerResumenEmpresa(empresaId, { ahora });
}

async function generarCodigoContrato(ahora) {
  const anio = hoyRD(ahora).slice(0, 4);
  const r = await mongoose.connection
    .collection("folios_contadores")
    .findOneAndUpdate(
      { _id: `contrato-${anio}` },
      { $inc: { valor: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  const doc = r && typeof r.valor === "number" ? r : r?.value;
  return `FC-${anio}-${String(doc?.valor ?? Date.now()).padStart(4, "0")}`;
}

function validarRangoFechas(fechaInicio, fechaVencimiento) {
  validarDia(fechaInicio, "La fecha de inicio");
  validarDia(fechaVencimiento, "La fecha de vencimiento");
  if (fechaVencimiento < fechaInicio) {
    throw new FoliosError("La fecha de vencimiento debe ser igual o posterior a la fecha de inicio");
  }
}

/** Crea un contrato (o una renovación si `renovacionDe` apunta a un contrato de la misma empresa). */
export async function crearContrato({
  empresaId,
  cantidadContratada,
  fechaInicio,
  fechaVencimiento,
  asignacionInicial,
  consumoPrevio,
  observaciones = "",
  renovacionDe = null,
  admin,
  ahora = new Date(),
}) {
  await obtenerEmpresaOFallar(empresaId, "_id");
  await asegurarConexionFolios();
  const cantidad = parseEntero(cantidadContratada, { min: 1, campo: "La cantidad contratada" });
  validarRangoFechas(fechaInicio, fechaVencimiento);

  const inicial = valorOpcional(asignacionInicial)
    ? parseEntero(asignacionInicial, { min: 0, campo: "La asignación inicial" })
    : 0;
  if (inicial > cantidad) {
    throw new FoliosError("La asignación inicial no puede superar la cantidad contratada");
  }
  const previo = valorOpcional(consumoPrevio)
    ? parseEntero(consumoPrevio, { min: 0, campo: "Los folios consumidos a la fecha" })
    : 0;
  if (previo > inicial) {
    throw new FoliosError(
      "Los folios consumidos a la fecha no pueden superar la asignación inicial: para emitirlos debieron estar asignados en The Factory",
    );
  }

  if (renovacionDe) {
    await obtenerContratoOFallar(empresaId, renovacionDe);
  }

  const contrato = await FolioContrato.create({
    codigo: await generarCodigoContrato(ahora),
    empresa: empresaId,
    cantidadContratada: cantidad,
    fechaInicio,
    fechaVencimiento,
    consumoPrevio: previo,
    consumidos: previo,
    renovacionDe: renovacionDe || null,
    observaciones: String(observaciones || "").slice(0, 1000),
    creadoPor: admin?.id ?? null,
  });

  const hoy = hoyRD(ahora);
  await registrarAuditoria({
    accion: renovacionDe ? "CONTRATO_RENOVADO" : "CONTRATO_CREADO",
    empresa: empresaId,
    contrato: contrato._id,
    admin,
    despues: {
      codigo: contrato.codigo,
      cantidadContratada: cantidad,
      fechaInicio,
      fechaVencimiento,
      consumoPrevio: previo,
      renovacionDe: renovacionDe || null,
    },
  });

  if (inicial > 0) {
    const r = await registrarAsignacion({
      empresaId,
      contratoId: String(contrato._id),
      cantidad: inicial,
      fecha: fechaInicio,
      observaciones: "Asignación inicial",
      admin,
      ahora,
    });
    return r.contrato;
  }
  return resumenContrato(contrato.toObject(), hoy);
}

function valorOpcional(valor) {
  return valor !== undefined && valor !== null && valor !== "";
}

/** Actualiza fechas, cantidad, observaciones, saldo informado por The Factory o estado. */
export async function actualizarContrato({ empresaId, contratoId, cambios = {}, admin, ahora = new Date() }) {
  const actual = await obtenerContratoOFallar(empresaId, contratoId);
  const set = {};
  const filtro = { _id: contratoId, empresa: empresaId };
  const condiciones = [];

  const cantidadFinal =
    cambios.cantidadContratada !== undefined
      ? parseEntero(cambios.cantidadContratada, { min: 1, campo: "La cantidad contratada" })
      : actual.cantidadContratada;

  let deltaPrevio = 0;
  if (cambios.consumoPrevio !== undefined) {
    const previo = parseEntero(cambios.consumoPrevio, { min: 0, campo: "Los folios consumidos a la fecha" });
    deltaPrevio = previo - (actual.consumoPrevio || 0);
    if (deltaPrevio !== 0) {
      if (previo > (actual.asignados || 0)) {
        throw new FoliosError(
          `Los folios consumidos a la fecha no pueden superar lo asignado (${actual.asignados || 0})`,
        );
      }
      const consumidosFinal = (actual.consumidos || 0) + deltaPrevio;
      if (consumidosFinal < 0 || consumidosFinal > cantidadFinal) {
        throw new FoliosError("El consumo total del contrato quedaría fuera del rango permitido");
      }
      set.consumoPrevio = previo;
      filtro.consumoPrevio = actual.consumoPrevio || 0;
      condiciones.push(
        { $gte: [{ $add: ["$consumidos", deltaPrevio] }, 0] },
        {
          $lte: [
            { $add: ["$consumidos", deltaPrevio] },
            cambios.cantidadContratada !== undefined ? cantidadFinal : "$cantidadContratada",
          ],
        },
      );
    }
  }

  if (cantidadFinal !== actual.cantidadContratada) {
    if (cantidadFinal < (actual.asignados || 0)) {
      throw new FoliosError(
        `La cantidad contratada no puede ser menor que lo asignado (${actual.asignados})`,
      );
    }
    if (cantidadFinal < (actual.consumidos || 0) + deltaPrevio) {
      throw new FoliosError(
        `La cantidad contratada no puede ser menor que lo consumido (${(actual.consumidos || 0) + deltaPrevio})`,
      );
    }
    set.cantidadContratada = cantidadFinal;
    filtro.asignados = { $lte: cantidadFinal };
    condiciones.push({ $lte: [{ $add: ["$consumidos", deltaPrevio] }, cantidadFinal] });
  }

  if (cambios.fechaInicio !== undefined || cambios.fechaVencimiento !== undefined) {
    const inicio = cambios.fechaInicio ?? actual.fechaInicio;
    const vence = cambios.fechaVencimiento ?? actual.fechaVencimiento;
    validarRangoFechas(inicio, vence);
    if (inicio !== actual.fechaInicio) set.fechaInicio = inicio;
    if (vence !== actual.fechaVencimiento) set.fechaVencimiento = vence;
  }

  if (cambios.observaciones !== undefined) {
    set.observaciones = String(cambios.observaciones || "").slice(0, 1000);
  }

  if (cambios.saldoTheFactory !== undefined) {
    const s = cambios.saldoTheFactory || {};
    const cantidad =
      s.cantidad === null || s.cantidad === "" || s.cantidad === undefined
        ? null
        : parseEntero(s.cantidad, { min: 0, campo: "El saldo informado por The Factory" });
    set.saldoTheFactory = {
      cantidad,
      fecha: cantidad === null ? null : new Date(),
      nota: String(s.nota || "").slice(0, 500),
    };
  }

  const motivo = String(cambios.motivo || "").trim();
  if (cambios.estado !== undefined) {
    if (!["activo", "cancelado"].includes(cambios.estado)) {
      throw new FoliosError("Estado inválido");
    }
    if (cambios.estado === "cancelado" && !motivo) {
      throw new FoliosError("Indique el motivo de la cancelación");
    }
    if (cambios.estado !== actual.estado) {
      set.estado = cambios.estado;
      set.motivoCancelacion = cambios.estado === "cancelado" ? motivo.slice(0, 500) : "";
    }
  }

  if (!Object.keys(set).length) {
    throw new FoliosError("No hay cambios para guardar");
  }

  if (condiciones.length) filtro.$expr = { $and: condiciones };
  const actualizado = await FolioContrato.findOneAndUpdate(
    filtro,
    { $set: set, ...(deltaPrevio ? { $inc: { consumidos: deltaPrevio } } : {}) },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!actualizado) {
    throw new FoliosError("El contrato cambió mientras se editaba. Recargue y reintente.", 409);
  }
  await generarAlertasContrato(actualizado, hoyRD(ahora));

  const antes = Object.fromEntries(Object.keys(set).map((k) => [k, actual[k] ?? null]));
  await registrarAuditoria({
    accion:
      set.estado === "cancelado"
        ? "CONTRATO_CANCELADO"
        : set.estado === "activo"
          ? "CONTRATO_REACTIVADO"
          : "CONTRATO_ACTUALIZADO",
    empresa: empresaId,
    contrato: contratoId,
    admin,
    antes,
    despues: set,
    motivo,
  });
  return resumenContrato(actualizado, hoyRD(ahora));
}

/** Registra una asignación parcial hecha en The Factory sin superar lo contratado. */
export async function registrarAsignacion({
  empresaId,
  contratoId,
  cantidad,
  fecha,
  observaciones = "",
  admin,
  ahora = new Date(),
}) {
  const contrato = await obtenerContratoOFallar(empresaId, contratoId);
  const n = parseEntero(cantidad, { min: 1, campo: "La cantidad asignada" });
  const hoy = hoyRD(ahora);
  const dia = fecha ? validarDia(fecha, "La fecha de asignación") : hoy;

  if (contrato.estado === "cancelado") {
    throw new FoliosError("No se puede asignar folios a un contrato cancelado");
  }
  if (hoy > contrato.fechaVencimiento) {
    throw new FoliosError("No se puede asignar folios a un contrato vencido");
  }

  const actualizado = await FolioContrato.findOneAndUpdate(
    {
      _id: contratoId,
      empresa: empresaId,
      estado: "activo",
      $expr: { $lte: [{ $add: ["$asignados", n] }, "$cantidadContratada"] },
    },
    { $inc: { asignados: n } },
    { returnDocument: "after" },
  ).lean();
  if (!actualizado) {
    const fresco = await FolioContrato.findById(contratoId).lean();
    const pendiente = Math.max(0, (fresco?.cantidadContratada || 0) - (fresco?.asignados || 0));
    throw new FoliosError(
      `La asignación supera la cantidad contratada. Pendiente de asignar: ${pendiente.toLocaleString("es-DO")}`,
    );
  }

  let asignacion;
  try {
    asignacion = await FolioAsignacion.create({
      empresa: empresaId,
      contrato: contratoId,
      fecha: dia,
      cantidad: n,
      admin: admin?.id ?? null,
      adminEmail: admin?.email ?? "",
      observaciones: String(observaciones || "").slice(0, 500),
    });
  } catch (err) {
    await FolioContrato.updateOne({ _id: contratoId }, { $inc: { asignados: -n } });
    throw err;
  }

  await registrarAuditoria({
    accion: "ASIGNACION_REGISTRADA",
    empresa: empresaId,
    contrato: contratoId,
    admin,
    antes: { asignados: contrato.asignados || 0 },
    despues: { asignados: actualizado.asignados, cantidad: n, fecha: dia },
    motivo: observaciones,
  });
  await generarAlertasContrato(actualizado, hoy);

  return {
    asignacion: serializarAsignacion(asignacion.toObject()),
    contrato: resumenContrato(actualizado, hoy),
  };
}

/** Ajuste administrativo del consumo (positivo o negativo) con motivo obligatorio. */
export async function ajustarConsumo({ empresaId, contratoId, cantidad, motivo, admin, ahora = new Date() }) {
  const contrato = await obtenerContratoOFallar(empresaId, contratoId);
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n === 0) {
    throw new FoliosError("El ajuste debe ser un número entero distinto de cero");
  }
  const motivoLimpio = String(motivo || "").trim();
  if (!motivoLimpio) throw new FoliosError("Indique el motivo del ajuste");

  const actualizado = await FolioContrato.findOneAndUpdate(
    {
      _id: contratoId,
      empresa: empresaId,
      $expr: {
        $and: [
          { $gte: [{ $add: ["$consumidos", n] }, 0] },
          { $lte: [{ $add: ["$consumidos", n] }, "$cantidadContratada"] },
        ],
      },
    },
    { $inc: { consumidos: n, ajusteConsumo: n } },
    { returnDocument: "after" },
  ).lean();
  if (!actualizado) {
    throw new FoliosError("El ajuste dejaría el consumo fuera del rango permitido");
  }

  await registrarAuditoria({
    accion: "AJUSTE_CONSUMO",
    empresa: empresaId,
    contrato: contratoId,
    admin,
    antes: { consumidos: contrato.consumidos || 0 },
    despues: { consumidos: actualizado.consumidos, ajuste: n },
    motivo: motivoLimpio,
  });
  const hoy = hoyRD(ahora);
  await generarAlertasContrato(actualizado, hoy);
  return resumenContrato(actualizado, hoy);
}

/** Recalcula los contadores del contrato desde asignaciones y consumos registrados. */
export async function recalcularContadores({ empresaId, contratoId, admin, ahora = new Date() }) {
  const contrato = await obtenerContratoOFallar(empresaId, contratoId);
  const oid = new mongoose.Types.ObjectId(contratoId);
  const [agg, confirmados, reservados] = await Promise.all([
    FolioAsignacion.aggregate([
      { $match: { contrato: oid } },
      { $group: { _id: null, total: { $sum: "$cantidad" } } },
    ]),
    FolioConsumo.countDocuments({ contrato: oid, estado: "confirmado" }),
    FolioConsumo.countDocuments({ contrato: oid, estado: "reservado" }),
  ]);
  const nuevos = {
    asignados: agg[0]?.total || 0,
    consumidos: Math.max(
      0,
      confirmados + (contrato.consumoPrevio || 0) + (contrato.ajusteConsumo || 0),
    ),
    reservados,
  };
  const actualizado = await FolioContrato.findOneAndUpdate(
    { _id: contratoId, empresa: empresaId },
    { $set: nuevos },
    { returnDocument: "after" },
  ).lean();
  await registrarAuditoria({
    accion: "CONTADORES_RECALCULADOS",
    empresa: empresaId,
    contrato: contratoId,
    admin,
    antes: {
      asignados: contrato.asignados || 0,
      consumidos: contrato.consumidos || 0,
      reservados: contrato.reservados || 0,
    },
    despues: nuevos,
  });
  return resumenContrato(actualizado, hoyRD(ahora));
}

/**
 * Folios que la empresa ya consumió desde `desde` según el historial de envíos de Giganet, con la
 * misma regla de consumo (cada e-NCF al que The Factory respondió, una sola vez). Omite los e-NCF que
 * el control ya contabilizó. Lo emitido fuera de Giganet (portal de The Factory) no aparece aquí.
 */
export async function estimarConsumoPrevio({ empresaId, desde, ahora = new Date() }) {
  await obtenerEmpresaOFallar(empresaId, "_id");
  await asegurarConexionFolios();
  validarDia(desde, "La fecha de inicio");
  const vacio = { desde, aceptados: 0, rechazados: 0, total: 0, primerEnvio: null, ultimoEnvio: null };
  if (desde > hoyRD(ahora)) return vacio;

  const empresaOid = new mongoose.Types.ObjectId(empresaId);
  const [r] = await ComprobanteEnvio.aggregate([
    {
      $match: {
        usuario: empresaOid,
        ambiente: { $ne: "demo" },
        fechaCreacion: { $gte: inicioDiaRD(desde), $lte: ahora },
      },
    },
    {
      $group: {
        _id: "$ncf",
        aceptado: { $max: "$exitoso" },
        respondido: { $max: { $eq: [{ $type: "$respuestaCompleta.procesado" }, "bool"] } },
        primero: { $min: "$fechaCreacion" },
        ultimo: { $max: "$fechaCreacion" },
      },
    },
    { $match: { $or: [{ aceptado: true }, { respondido: true }] } },
    {
      $lookup: {
        from: FolioConsumo.collection.name,
        localField: "_id",
        foreignField: "ncf",
        pipeline: [
          { $match: { empresa: empresaOid, ambiente: "production", estado: { $ne: "liberado" } } },
          { $limit: 1 },
        ],
        as: "contabilizado",
      },
    },
    { $match: { contabilizado: { $size: 0 } } },
    {
      $group: {
        _id: null,
        aceptados: { $sum: { $cond: ["$aceptado", 1, 0] } },
        rechazados: { $sum: { $cond: ["$aceptado", 0, 1] } },
        primero: { $min: "$primero" },
        ultimo: { $max: "$ultimo" },
      },
    },
  ]);
  if (!r) return vacio;
  return {
    desde,
    aceptados: r.aceptados,
    rechazados: r.rechazados,
    total: r.aceptados + r.rechazados,
    primerEnvio: r.primero,
    ultimoEnvio: r.ultimo,
  };
}

function serializarAsignacion(a) {
  return {
    id: String(a._id),
    fecha: a.fecha,
    cantidad: a.cantidad,
    adminEmail: a.adminEmail || "",
    observaciones: a.observaciones || "",
    createdAt: a.createdAt ?? null,
  };
}

function serializarConsumo(c) {
  return {
    id: String(c._id),
    ncf: c.ncf,
    tipoComprobante: c.tipoComprobante || "",
    estado: c.estado,
    resultado: c.resultado || "",
    intentos: c.intentos || 1,
    pendienteVerificacion: !!c.pendienteVerificacion,
    reservadoEn: c.reservadoEn ?? null,
    confirmadoEn: c.confirmadoEn ?? null,
  };
}

/** Detalle de contrato: asignaciones, consumo paginado y auditoría. */
export async function obtenerDetalleContrato({ empresaId, contratoId, pagina = 1, porPagina = 25, ahora = new Date() }) {
  const contrato = await obtenerContratoOFallar(empresaId, contratoId);
  const page = Math.max(1, Number(pagina) || 1);
  const limit = Math.min(100, Math.max(1, Number(porPagina) || 25));
  const filtroConsumo = { contrato: contrato._id, estado: { $ne: "liberado" } };
  const [asignaciones, totalConsumos, consumos, auditoria] = await Promise.all([
    FolioAsignacion.find({ contrato: contrato._id }).sort({ fecha: -1, createdAt: -1 }).lean(),
    FolioConsumo.countDocuments(filtroConsumo),
    FolioConsumo.find(filtroConsumo)
      .sort({ reservadoEn: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    FolioAuditoria.find({ contrato: contrato._id }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  return {
    contrato: resumenContrato(contrato, hoyRD(ahora)),
    asignaciones: asignaciones.map(serializarAsignacion),
    consumos: {
      items: consumos.map(serializarConsumo),
      total: totalConsumos,
      pagina: page,
      porPagina: limit,
    },
    auditoria: auditoria.map(serializarAuditoria),
  };
}

// ---------------------------------------------------------------------------
// Panel global
// ---------------------------------------------------------------------------

/**
 * Tabla de folios de todas las empresas con filtros.
 * @param {{ q?: string, modalidad?: string, estado?: string, vencDesde?: string, vencHasta?: string, pagina?: number, porPagina?: number, ahora?: Date }} filtros
 */
export async function listarPanelFolios({
  q = "",
  modalidad = "",
  estado = "",
  vencDesde = "",
  vencHasta = "",
  pagina = 1,
  porPagina = 20,
  ahora = new Date(),
} = {}) {
  await asegurarConexionFolios();
  const hoy = hoyRD(ahora);
  const usuarios = await User.find({ "empresa.rnc": { $regex: /\S/ } })
    .select("empresa.nombre empresa.razonSocial empresa.rnc empresa.theFactoryAmbiente empresa.folios")
    .sort({ "empresa.razonSocial": 1, "empresa.nombre": 1 })
    .lean();
  const ids = usuarios.map((u) => u._id);
  const [contratos, alertasAgg] = await Promise.all([
    FolioContrato.find({ empresa: { $in: ids } }).lean(),
    FolioAlerta.aggregate([
      { $match: { atendida: false, empresa: { $in: ids } } },
      { $group: { _id: "$empresa", n: { $sum: 1 } } },
    ]),
  ]);
  const contratosPorEmpresa = new Map();
  for (const c of contratos) {
    const k = String(c.empresa);
    if (!contratosPorEmpresa.has(k)) contratosPorEmpresa.set(k, []);
    contratosPorEmpresa.get(k).push(c);
  }
  const alertasPorEmpresa = new Map(alertasAgg.map((a) => [String(a._id), a.n]));

  const filas = usuarios.map((u) => {
    const id = String(u._id);
    const mod = modalidadEmpresa(u.empresa);
    const propios = contratosPorEmpresa.get(id) ?? [];
    const controlado = mod === MODALIDAD_CONTROLADO;
    const actual = controlado ? seleccionarContratoActual(propios, hoy) : null;
    return {
      id,
      nombre: u.empresa?.razonSocial || u.empresa?.nombre || "Sin razón social",
      rnc: u.empresa?.rnc || "",
      ambiente: u.empresa?.theFactoryAmbiente === "demo" ? "demo" : "production",
      modalidad: mod,
      estado: estadoEmpresa(mod, propios, hoy),
      contrato: actual ? resumenContrato(actual, hoy) : null,
      totalContratos: propios.length,
      alertas: controlado ? alertasPorEmpresa.get(id) || 0 : 0,
    };
  });

  const totales = {
    empresas: filas.length,
    ilimitadas: filas.filter((f) => f.modalidad !== MODALIDAD_CONTROLADO).length,
    controladas: filas.filter((f) => f.modalidad === MODALIDAD_CONTROLADO).length,
    bloqueadas: filas.filter((f) =>
      ["VENCIDO", "AGOTADO", "SIN_SALDO_ASIGNADO", "SIN_CONTRATO"].includes(f.estado),
    ).length,
    porVencer: filas.filter((f) => f.estado === "POR_VENCER").length,
    alertas: filas.reduce((s, f) => s + f.alertas, 0),
  };

  const texto = String(q || "").trim().toLowerCase();
  const filtradas = filas.filter((f) => {
    if (texto && !f.nombre.toLowerCase().includes(texto) && !f.rnc.includes(texto)) return false;
    if (modalidad && f.modalidad !== modalidad) return false;
    if (estado && f.estado !== estado) return false;
    if (vencDesde || vencHasta) {
      const v = f.contrato?.fechaVencimiento;
      if (!v) return false;
      if (vencDesde && v < vencDesde) return false;
      if (vencHasta && v > vencHasta) return false;
    }
    return true;
  });

  const limit = Math.min(100, Math.max(1, Number(porPagina) || 20));
  const page = Math.max(1, Number(pagina) || 1);
  return {
    hoy,
    totales,
    total: filtradas.length,
    pagina: page,
    porPagina: limit,
    items: filtradas.slice((page - 1) * limit, page * limit),
  };
}
