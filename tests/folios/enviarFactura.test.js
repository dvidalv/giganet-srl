import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.THEFACTORY_CREDENTIALS_ENCRYPTION_KEY = "ab".repeat(32);
});

vi.mock("axios", () => {
  const post = vi.fn();
  const get = vi.fn();
  return { default: { post, get, isAxiosError: (e) => Boolean(e?.isAxiosError) } };
});
vi.mock("@/api-mail_brevo", () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }));

import axios from "axios";
import User from "@/app/models/user";
import FolioContrato from "@/app/models/folioContrato";
import FolioConsumo from "@/app/models/folioConsumo";
import {
  consultarEstatusDocumentoLogic,
  descargarArchivoLogic,
  enviarFacturaElectronicaLogic,
} from "@/app/controllers/comprobantes";
import { crearContrato } from "@/lib/folios/foliosService";
import { BLOQUEOS_FOLIOS } from "@/lib/folios/mensajes";
import { buildTheFactoryUrls, THEFACTORY_BASE_URL, THEFACTORY_BASE_URL_DEMO } from "@/utils/constants";
import { encryptTheFactoryPassword } from "@/utils/thefactoryCredentials";
import { hoyRD } from "@/lib/folios/fechasRD";
import { ADMIN, crearEmpresa, detenerMongo, horaRD, iniciarMongo, limpiarColecciones } from "./helpers";

const RNC = "130476896";
const PROD = buildTheFactoryUrls(THEFACTORY_BASE_URL);
const DEMO = buildTheFactoryUrls(THEFACTORY_BASE_URL_DEMO);

let respuestaEnvio;

function factura(ncf) {
  return {
    factura: { ncf, tipo: "32", fecha: "2026-01-15", total: "118.00", id: `FM-${ncf}` },
    emisor: {
      rnc: RNC,
      razonSocial: "Mi Empresa SRL",
      direccion: "Calle 1",
      municipio: "Santo Domingo",
      provincia: "Distrito Nacional",
    },
    comprador: { rnc: null, nombre: "Consumidor final", correo: "", direccion: "", municipio: "", provincia: "" },
    items: [{ nombre: "Producto 1", precio: "100.00", cantidad: "1" }],
  };
}

async function empresaConCredenciales(opciones) {
  const id = await crearEmpresa({ rnc: RNC, ...opciones });
  const clave = encryptTheFactoryPassword("clave-thefactory");
  await User.updateOne(
    { _id: id },
    {
      $set: {
        "empresa.theFactoryUsuarioProduction": "usuario-prod",
        "empresa.theFactoryClaveProductionEnc": clave,
        "empresa.theFactoryUsuarioDemo": "usuario-demo",
        "empresa.theFactoryClaveDemoEnc": clave,
      },
    },
  );
  return id;
}

function contrato(empresaId, { cantidad = 10, asignados = 10, inicio, vence } = {}) {
  const hoy = hoyRD();
  return crearContrato({
    empresaId,
    cantidadContratada: cantidad,
    fechaInicio: inicio ?? hoy,
    fechaVencimiento: vence ?? `${Number(hoy.slice(0, 4)) + 1}${hoy.slice(4)}`,
    asignacionInicial: asignados,
    admin: ADMIN,
    ahora: inicio ? horaRD(inicio) : new Date(),
  });
}

const llamadasA = (url) => axios.post.mock.calls.filter(([u]) => u === url).length;

beforeAll(iniciarMongo);
afterAll(detenerMongo);

beforeEach(async () => {
  await limpiarColecciones();
  vi.clearAllMocks();
  respuestaEnvio = () => ({
    data: { procesado: true, codigo: 0, mensaje: "OK", codigoSeguridad: "AbC123", fechaFirma: "15-01-2026 10:00:00" },
  });
  axios.post.mockImplementation(async (url) => {
    if (url === PROD.authUrl || url === DEMO.authUrl) {
      return { data: { codigo: 0, token: "token-prueba", fechaExpiracion: new Date(Date.now() + 3600e3).toISOString() } };
    }
    if (url === PROD.enviarUrl || url === DEMO.enviarUrl) return respuestaEnvio();
    if (url === PROD.estatusUrl || url === DEMO.estatusUrl) {
      return { data: { codigo: 0, estado: "Aceptado", mensaje: "Aceptado", procesado: true } };
    }
    if (url === PROD.descargaUrl) {
      return { data: { codigo: 0, procesado: true, archivo: "PGRhdG8+", mensaje: "OK" } };
    }
    return { data: { codigo: 0 } };
  });
});

describe("envío de facturas con control de folios", () => {
  it("ILIMITADO: el envío llega a The Factory exactamente igual y no registra consumo", async () => {
    const userId = await empresaConCredenciales();
    const r = await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    expect(r.status).toBe(200);
    expect(llamadasA(PROD.enviarUrl)).toBe(1);
    expect(await FolioConsumo.countDocuments()).toBe(0);
  });

  it("demo: una empresa CONTROLADO sin contratos sigue certificando", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO", ambiente: "demo" });
    const r = await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    expect(r.status).toBe(200);
    expect(llamadasA(DEMO.enviarUrl)).toBe(1);
    expect(await FolioConsumo.countDocuments()).toBe(0);
  });

  it("CONTROLADO vigente: envía y contabiliza un folio", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    const c = await contrato(userId);
    const r = await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    expect(r.status).toBe(200);
    expect(await FolioContrato.findById(c.id).lean()).toMatchObject({ consumidos: 1, reservados: 0 });
  });

  it("contrato vencido: bloquea con el mensaje exacto sin contactar a The Factory", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    await contrato(userId, { inicio: "2025-01-01", vence: "2025-12-31" });
    const r = await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    expect(r.status).toBe(403);
    expect(r.data).toMatchObject({ status: "error", errorType: "FOLIOS_VENCIDOS", message: BLOQUEOS_FOLIOS.FOLIOS_VENCIDOS.message });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("folios agotados: bloquea con el mensaje exacto sin contactar a The Factory", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    await contrato(userId, { cantidad: 1, asignados: 1 });
    expect((await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId })).status).toBe(200);
    axios.post.mockClear();

    const r = await enviarFacturaElectronicaLogic(factura("E320000000002"), { userId });
    expect(r.status).toBe(403);
    expect(r.data).toMatchObject({ errorType: "FOLIOS_AGOTADOS", message: BLOQUEOS_FOLIOS.FOLIOS_AGOTADOS.message });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("CONTROLADO sin contrato: error de configuración, no pasa a ILIMITADO", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    const r = await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    expect(r.data.errorType).toBe("FOLIOS_CONFIGURACION_INCOMPLETA");
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("reintento del mismo e-NCF rechazado por duplicado no descuenta otra vez", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    const c = await contrato(userId);
    await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    respuestaEnvio = () => ({ data: { procesado: false, codigo: 108, mensaje: "NCF ya fue presentado" } });
    const r = await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    expect(r.status).toBe(400);
    expect((await FolioContrato.findById(c.id).lean()).consumidos).toBe(1);
  });

  it("timeout de red: la reserva queda pendiente de verificación", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    const c = await contrato(userId);
    respuestaEnvio = () => {
      throw Object.assign(new Error("timeout of 60000ms exceeded"), { code: "ECONNABORTED", isAxiosError: true });
    };
    await enviarFacturaElectronicaLogic(factura("E320000000001"), { userId });
    const consumo = await FolioConsumo.findOne({ ncf: "E320000000001" }).lean();
    expect(consumo).toMatchObject({ estado: "reservado", pendienteVerificacion: true });
    expect(await FolioContrato.findById(c.id).lean()).toMatchObject({ consumidos: 0, reservados: 1 });
  });

  it("después del vencimiento siguen funcionando consultas y descargas", async () => {
    const userId = await empresaConCredenciales({ modalidad: "CONTROLADO" });
    await contrato(userId, { inicio: "2025-01-01", vence: "2025-12-31" });

    const estatus = await consultarEstatusDocumentoLogic({ ncf: "E320000000001", rnc: RNC }, { userId });
    expect(estatus.status).toBe(200);
    expect(llamadasA(PROD.estatusUrl)).toBe(1);

    const descarga = await descargarArchivoLogic({ rnc: RNC, documento: "E320000000001", extension: "xml" }, { userId });
    expect(descarga.status).not.toBe(403);
    expect(llamadasA(PROD.descargaUrl)).toBe(1);
  });
});
