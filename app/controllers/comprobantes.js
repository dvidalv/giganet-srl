/**
 * Controladores de comprobantes (e-CF, TheFactoryHKA).
 * Origen: Express. Preparados para usarse también desde Next.js mediante el adaptador.
 *
 * Uso desde Next.js (app/api/.../route.js):
 *   import { runWithNext } from '@/lib/nextControllerAdapter';
 *   import { createComprobante } from '@/app/controllers/comprobantes';
 *   export async function POST(request) {
 *     return runWithNext(createComprobante, request, { requireAuth: true });
 *   }
 *
 * Requisito: cada handler debe hacer "return res.status(...).json(...)" para que
 * runWithNext pueda devolver la NextResponse.
 *
 * Handlers que requieren sesión (requireAuth: true): createComprobante, getComprobanteById,
 * updateComprobante, updateComprobanteEstado, deleteComprobante, getComprobantesStats,
 * consumirNumero, enviarFacturaElectronica, enviarEmailFactura, anularComprobantes, descargarArchivo.
 * consumirNumeroPorRnc usa API Key (no sesión); limpiarTokenCache y verificarServidorTheFactory no requieren auth.
 */
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Comprobante } from "@/app/models/comprobante";
import User from "@/app/models/user";
import { hashApiKey } from "@/utils/apiKey";
import axios from "axios";
import QRCode from "qrcode";



const TIPOS_COMPROBANTE = ["31", "32", "33", "34", "41", "43", "44", "45"];
const RNC_MIN = 9;
const RNC_MAX = 11;

function getApiKeyFromRequest(req) {
  const authHeader = req.headers?.authorization;
  const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  return req.headers?.["x-api-key"]?.trim() ?? null;
}

async function getUserIdByApiKey(apiKey) {
  if (!apiKey) return null;
  const keyHash = hashApiKey(apiKey);
  if (!keyHash) return null;
  const user = await User.findOne({ apiKeyHash: keyHash }).select("_id").lean();
  return user?._id?.toString() ?? null;
}

function formatFechaVencimiento(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const dia = d.getDate().toString().padStart(2, "0");
  const mes = (d.getMonth() + 1).toString().padStart(2, "0");
  const año = d.getFullYear();
  return `${dia}-${mes}-${año}`;
}
import { sendEmail } from "@/api-mail_brevo";
import {
  THEFACTORY_AUTH_URL,
  THEFACTORY_ENVIAR_URL,
  THEFACTORY_ESTATUS_URL,
  THEFACTORY_ANULACION_URL,
  THEFACTORY_DESCARGA_URL,
  THEFACTORY_USUARIO,
  THEFACTORY_CLAVE,
} from "@/utils/constants";

// Cache del token de TheFactoryHKA por RNC (cada emisor tiene su propio token)
const tokenCacheByRnc = {};

// Función para limpiar cache del token (útil para debugging)
const limpiarCacheToken = () => {
  console.log("🧹 Limpiando cache del token TheFactoryHKA...");
  Object.keys(tokenCacheByRnc).forEach((key) => delete tokenCacheByRnc[key]);
};

// Función para obtener token de autenticación de TheFactoryHKA
// @param {string} rnc - RNC del emisor (viene en la data de cada petición)
const obtenerTokenTheFactory = async (rnc) => {
  if (!rnc) {
    throw new Error("RNC es requerido para obtener el token de TheFactoryHKA");
  }
  try {
    let tokenCache = tokenCacheByRnc[rnc];
    if (!tokenCache) {
      tokenCache = { token: null, fechaExpiracion: null };
      tokenCacheByRnc[rnc] = tokenCache;
    }

    // Verificar si tenemos un token válido en cache para este RNC
    if (tokenCache.token && tokenCache.fechaExpiracion) {
      const ahora = new Date();
      const expiracion = new Date(tokenCache.fechaExpiracion);

      // Si el token expira en menos de 5 minutos, renovarlo
      const cincoMinutos = 5 * 60 * 1000; // 5 minutos en ms
      if (expiracion.getTime() - ahora.getTime() > cincoMinutos) {
        console.log(
          "Usando token desde cache:",
          tokenCache.token.substring(0, 20) + "..."
        );
        return tokenCache.token;
      }
    }

    // console.log('Obteniendo nuevo token de TheFactoryHKA...');

    // Realizar petición de autenticación
    // Nota: La API de TheFactoryHKA requiere los campos con mayúsculas iniciales
    const authRequest = {
      Usuario: THEFACTORY_USUARIO,
      Clave: THEFACTORY_CLAVE,
      RNC: rnc,
    };

    const response = await axios.post(THEFACTORY_AUTH_URL, authRequest, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000, // 15 segundos para auth
    });

    // console.log('Respuesta de autenticación:', response.data);

    // Verificar que la autenticación fue exitosa
    if (response.data.codigo !== 0) {
      throw new Error(`Error de autenticación: ${response.data.mensaje}`);
    }

    // Actualizar cache para este RNC
    tokenCache.token = response.data.token;
    tokenCache.fechaExpiracion = response.data.fechaExpiracion;

    // console.log(
    //   'Token obtenido exitosamente, expira:',
    //   tokenCache.fechaExpiracion,
    // );

    return tokenCache.token;
  } catch (error) {
    console.error("Error al obtener token de TheFactoryHKA:", error);
    console.error("Código de error:", error.code);
    console.error("Mensaje:", error.message);

    if (error.response) {
      throw new Error(
        `Error ${error.response.status}: ${JSON.stringify(error.response.data)}`
      );
    }

    // Detectar si el servidor está caído
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        "SERVIDOR_CAIDO: El servidor de TheFactoryHKA rechazó la conexión. El servidor puede estar caído o inaccesible."
      );
    }

    if (error.code === "ENOTFOUND") {
      throw new Error(
        "SERVIDOR_NO_ENCONTRADO: No se puede resolver el dominio de TheFactoryHKA. Verifica la configuración de DNS."
      );
    }

    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      throw new Error("Timeout al conectar con el servicio de autenticación");
    }

    if (error.code === "ECONNRESET") {
      throw new Error(
        "SERVIDOR_RESETEO: El servidor de TheFactoryHKA cerró la conexión abruptamente. Puede estar sobrecargado o caído."
      );
    }

    throw new Error(`Error de autenticación: ${error.message}`);
  }
};

// Función para determinar si la fecha de vencimiento es obligatoria según el tipo de NCF
const esFechaVencimientoObligatoria = (tipoDocumento) => {
  // Según la documentación de la DGII y TheFactoryHKA:
  // Tipos que requieren fecha de vencimiento:
  const tiposObligatorios = [
    "31", // Factura de Crédito Fiscal Electrónica
    "33", // Nota de Débito Electrónica
    "41", // Compras Electrónicas
    "43", // Gastos Menores Electrónico
    "44", // Régimenes Especiales Electrónico
    "45", // Gubernamental Electrónico
    "46", // Exportaciones Electrónico
    "47", // Pagos al Exterior Electrónico
  ];

  // Tipos opcionales (NO requieren fecha de vencimiento):
  // '32' - Factura de Consumo Electrónica
  // '34' - Nota de Crédito Electrónica (NO debe incluir FechaVencimientoSecuencia)
  const esObligatorio = tiposObligatorios.includes(tipoDocumento); // true si es obligatorio, false si es opcional

  // console.log(
  //   `📅 Fecha vencimiento para tipo ${tipoDocumento}: ${esObligatorio ? 'OBLIGATORIA' : 'OPCIONAL'}`,
  // );

  return esObligatorio;
};

// URLs DGII para QR: desarrollo (TesteCF) vs producción (ecf)
const URLS_DGII_QR = {
  desarrollo: {
    ConsultaTimbreFC: "https://fc.dgii.gov.do/TesteCF/ConsultaTimbreFC",
    ConsultaTimbre: "https://ecf.dgii.gov.do/TesteCF/ConsultaTimbre",
  },
  produccion: {
    ConsultaTimbreFC: "https://fc.dgii.gov.do/ecf/ConsultaTimbreFC",
    ConsultaTimbre: "https://ecf.dgii.gov.do/ecf/ConsultaTimbre",
  },
};

// Función para generar URL del QR Code para la DGII según el tipo de comprobante
const generarUrlQR = (responseData, facturaOriginal) => {
  try {
    const montoTotal = parseFloat(facturaOriginal.factura.total || 0);
    const tipoComprobante = facturaOriginal.factura.tipo;
    const ambiente =
      String(
        facturaOriginal.ambiente || process.env.DGII_AMBIENTE || ""
      ).toLowerCase() === "desarrollo"
        ? "desarrollo"
        : "produccion";
    const urlsDGII = URLS_DGII_QR[ambiente];

    // 🔍 DEBUG: Verificar datos recibidos
    console.log("🔍 DEBUG generarUrlQR - Datos recibidos:");
    console.log("responseData:", JSON.stringify(responseData, null, 2));
    console.log("facturaOriginal:", JSON.stringify(facturaOriginal, null, 2));
    console.log("montoTotal calculado:", montoTotal);
    console.log("tipoComprobante:", tipoComprobante);
    console.log("ambiente DGII:", ambiente);

    // Formatear fechas al formato DD-MM-YYYY
    const formatearFechaUrl = (fecha) => {
      if (!fecha) return "";
      // Si viene en formato DD-MM-YYYY, mantenerlo
      if (fecha.match(/^\d{2}-\d{2}-\d{4}$/)) {
        return fecha;
      }
      // Si viene en otro formato, convertirlo
      const date = new Date(fecha);
      return `${date.getDate().toString().padStart(2, "0")}-${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${date.getFullYear()}`;
    };

    // Determinar endpoint y parámetros según el tipo de comprobante
    let baseUrl, params;

    // TIPO 32 (Consumo Final): usar endpoint ConsultaTimbreFC (parámetros básicos)
    if (tipoComprobante === "32") {
      baseUrl = urlsDGII.ConsultaTimbreFC;
      params = new URLSearchParams({
        RncEmisor: facturaOriginal.emisor.rnc,
        ENCF: facturaOriginal.factura.ncf,
        MontoTotal: montoTotal.toFixed(2),
        CodigoSeguridad: responseData.codigoSeguridad,
      });

      console.log(
        `📋 Usando endpoint ConsultaTimbreFC (${ambiente}): ${baseUrl}`
      );
    } else {
      // TIPOS 31, 33, 34, etc.: usar endpoint ConsultaTimbre (parámetros completos)
      // Estos tipos SIEMPRE requieren RncComprador, FechaEmision y FechaFirma
      baseUrl = urlsDGII.ConsultaTimbre;

      params = new URLSearchParams({
        RncEmisor: facturaOriginal.emisor.rnc,
        RncComprador: facturaOriginal.comprador?.rnc || "",
        ENCF: facturaOriginal.factura.ncf,
        FechaEmision: responseData.fechaEmision
          ? formatearFechaUrl(responseData.fechaEmision)
          : formatearFechaUrl(facturaOriginal.factura.fecha),
        MontoTotal: montoTotal.toFixed(2),
        FechaFirma: responseData.fechaFirma || responseData.fechaEmision || "",
        CodigoSeguridad: responseData.codigoSeguridad,
      });

      console.log(
        `📋 Usando endpoint ConsultaTimbre (tipo ${tipoComprobante}, ${ambiente}): ${baseUrl}`
      );
    }

    const urlCompleta = `${baseUrl}?${params.toString()}`;

    console.log(`📱 URL QR DGII generada: ${urlCompleta}`);
    console.log(`📊 Endpoint: ${baseUrl}`);
    console.log(`📊 Parámetros: ${params.toString()}`);

    return urlCompleta;
  } catch (error) {
    console.error("❌ Error al generar datos del QR:", error);
    return null;
  }
};

/**
 * Lógica para generar código QR según especificaciones DGII (sin Express).
 * Devuelve { status, data } para uso directo con NextResponse.
 * @param {Object} body - { url?, rnc?, rncComprador?, ncf?, codigo?, fecha?, fechaFirma?, monto?, tipo?, formato?, tamaño?, ambiente? }
 * @param {string} body.ambiente - "produccion" (default) | "desarrollo"
 * @returns {Promise<{ status: number, data: object }>}
 */
export async function generarCodigoQRLogic(body) {
  try {
    const {
      url,
      rnc,
      rncComprador,
      ncf,
      codigo,
      fecha,
      fechaFirma,
      monto,
      tipo,
      formato = "png",
      tamaño = 300,
      ambiente: ambienteBody,
    } = body ?? {};
    const ambiente =
      String(
        ambienteBody || process.env.DGII_AMBIENTE || ""
      ).toLowerCase() === "desarrollo"
        ? "desarrollo"
        : "produccion";

    const urlsDGII =
      ambiente === "desarrollo"
        ? URLS_DGII_QR.desarrollo
        : URLS_DGII_QR.produccion;

    let urlParaQR;

    // Opción 1: URL completa proporcionada
    if (url) {
      urlParaQR = url;
    }
    // Opción 2: Parámetros individuales
    else if (rnc && ncf) {
      const montoTotal = parseFloat(monto || 0);
      let baseUrl, params;

      const formatearFechaUrl = (fechaInput) => {
        if (!fechaInput) return "";
        if (fechaInput.match(/^\d{2}-\d{2}-\d{4}$/)) return fechaInput;
        const date = new Date(fechaInput);
        return `${date.getDate().toString().padStart(2, "0")}-${(
          date.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}-${date.getFullYear()}`;
      };

      if (tipo === "32") {
        if (!codigo) {
          return {
            status: httpStatus.BAD_REQUEST,
            data: {
              status: "error",
              message:
                "Parámetros insuficientes para generar el código QR tipo 32",
              details:
                "Para facturas tipo 32 se requiere: rnc, ncf, monto y codigo (código de seguridad)",
            },
          };
        }
        baseUrl = urlsDGII.ConsultaTimbreFC;
        params = new URLSearchParams({
          RncEmisor: rnc,
          ENCF: ncf,
          MontoTotal: montoTotal.toFixed(2),
          CodigoSeguridad: codigo,
        });
      } else {
        if (!codigo || !fecha) {
          return {
            status: httpStatus.BAD_REQUEST,
            data: {
              status: "error",
              message: `Parámetros insuficientes para generar el código QR tipo ${
                tipo || "desconocido"
              }`,
              details:
                "Para facturas tipo 31, 33, 34, etc. se requiere: rnc, ncf, codigo, fecha, rncComprador, monto, fechaFirma",
            },
          };
        }
        baseUrl = urlsDGII.ConsultaTimbre;
        params = new URLSearchParams({
          RncEmisor: rnc,
          RncComprador: rncComprador || "",
          ENCF: ncf,
          FechaEmision: formatearFechaUrl(fecha),
          MontoTotal: montoTotal.toFixed(2),
          FechaFirma: fechaFirma || fecha,
          CodigoSeguridad: codigo,
        });
      }

      urlParaQR = `${baseUrl}?${params.toString()}`;
    } else {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "Parámetros insuficientes para generar el código QR",
          details:
            "Debe proporcionar: url completa O al menos (rnc + ncf) para generar el QR",
        },
      };
    }

    const opcionesQR = {
      errorCorrectionLevel: "M",
      type: formato === "svg" ? "svg" : "image/png",
      quality: 0.92,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      width: Math.max(parseInt(tamaño) || 300, 150),
    };

    let qrData;
    if (formato === "svg") {
      qrData = await QRCode.toString(urlParaQR, { ...opcionesQR, type: "svg" });
    } else {
      qrData = await QRCode.toDataURL(urlParaQR, opcionesQR);
    }

    return {
      status: httpStatus.OK,
      data: {
        status: "success",
        message: "Código QR generado exitosamente",
        data: {
          url: urlParaQR,
          qrCode: qrData,
          formato,
          tamaño,
          ambiente: ambiente === "desarrollo" ? "desarrollo" : "produccion",
          versionCalculada: "auto",
          parametrosUsados: url ? "URL completa" : "Parámetros individuales",
          especificaciones: {
            errorCorrection: "M",
            cumpleNormativaDGII: true,
            versionOptimizada: true,
          },
          timestamp: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    console.error("❌ Error al generar código QR:", error);
    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      data: {
        status: "error",
        message: "Error interno al generar el código QR",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Controlador Express (req, res) - mantiene compatibilidad con runWithNext
const generarCodigoQR = async (req, res) => {
  const result = await generarCodigoQRLogic(req.body);
  return res.status(result.status).json(result.data);
};

// Función para normalizar el estado de la factura devuelto por TheFactoryHKA
const normalizarEstadoFactura = (estadoOriginal, datosCompletos) => {
  console.log(
    `\n🔄 ==================== INICIO NORMALIZACIÓN ESTADO ====================`
  );
  console.log(`📝 Estado original recibido: "${estadoOriginal}"`);
  console.log("📊 Datos completos recibidos:");
  console.log(JSON.stringify(datosCompletos, null, 2));

  // Convertir a mayúsculas para comparación
  const estado = (estadoOriginal || "").toString().toUpperCase();
  console.log(`🔤 Estado en mayúsculas: "${estado}"`);

  // PRIORIDAD 1: Verificar campo 'procesado' y código numérico primero
  console.log(`🔍 Verificando campo 'procesado': ${datosCompletos.procesado}`);
  console.log(`🔍 Verificando campo 'codigo': ${datosCompletos.codigo}`);

  if (datosCompletos.procesado === true) {
    console.log("✅ Campo procesado === true");

    // Si está procesado y tiene código exitoso
    if (datosCompletos.codigo === 0 || datosCompletos.codigo === 1) {
      console.log(`✅ Código exitoso detectado: ${datosCompletos.codigo}`);
      console.log(
        `🔄 ==================== FIN NORMALIZACIÓN: APROBADA ====================\n`
      );
      return "APROBADA";
    }

    // Si está procesado pero tiene código de error o estado especial
    if (datosCompletos.codigo !== undefined && datosCompletos.codigo > 1) {
      console.log(`⚠️ Código > 1 detectado: ${datosCompletos.codigo}`);

      switch (datosCompletos.codigo) {
        // ⏳ Estados en proceso
        case 2: // En proceso de validación en TheFactoryHKA
        case 4: // En proceso de validación en DGII
        case 10: // Pendiente de procesamiento
        case 15: // En validación
        case 95: // Documento pendiente por ser enviado a DGII
        case 99: // Sin respuesta DGII - documento enviado pero pendiente de respuesta
          console.log(
            `⏳ Estado en proceso identificado (código ${datosCompletos.codigo})`
          );
          console.log(
            `🔄 ==================== FIN NORMALIZACIÓN: EN_PROCESO ====================\n`
          );
          return "EN_PROCESO";

        // ❌ Errores de NCF
        case 108: // NCF ya presentado anteriormente
          return "NCF_INVALIDO"; // NCF ya presentado
        case 109: // NCF vencido o fuera de rango
          return "NCF_VENCIDO"; // NCF vencido o fuera de rango

        // ❌ Errores de autorización
        case 110:
          return "RNC_NO_AUTORIZADO"; // RNC no autorizado

        // ❌ Errores de validación de datos
        case 111: // Datos de la factura inválidos
        case 112: // Estructura del documento incorrecta
        case 113: // Totales inconsistentes
        case 114: // Fecha de emisión inválida
          return "DATOS_INVALIDOS"; // Datos/estructura/totales inválidos

        // ❌ Errores de búsqueda/no encontrado
        case 120:
          return "NO_ENCONTRADO"; // Documento no existe en BD de TheFactoryHKA

        // ❌ Estados de rechazo DGII
        case 200: // Rechazado por DGII - Datos inconsistentes
        case 201: // Rechazado - RNC inválido
        case 202: // Rechazado - Estructura incorrecta
        case 203: // Rechazado - Firma digital inválida
          return "RECHAZADA"; // Rechazado por DGII

        // ❌ Errores de reglas de negocio DGII (600-699)
        case 613:
          return "RECHAZADA"; // Error específico: comprobantes no pueden reemplazarse entre ellos mismos
        case 634: // Fecha de NCF modificado no coincide
          return "RECHAZADA"; // Error específico: fecha de NCF modificado no coincide

        // 🚫 Estados de cancelación
        case 300: // Documento anulado/cancelado
        case 301: // Documento anulado/cancelado
          return "ANULADA"; // Documento anulado/cancelado

        default:
          console.warn(
            `⚠️ Código de TheFactoryHKA no mapeado: ${datosCompletos.codigo}`
          );
          return "ERROR";
      }
    }
  }

  // PRIORIDAD 2: Estados exitosos por mensaje/texto
  if (
    estado.includes("APROBADA") ||
    estado.includes("ACEPTADA") ||
    estado.includes("ACEPTADO") ||
    estado.includes("PROCESADA") ||
    estado.includes("EXITOSA") ||
    estado.includes("SUCCESS") ||
    estado === "OK"
  ) {
    return "APROBADA";
  }

  // Estados de procesamiento
  if (
    estado.includes("PROCESO") ||
    estado.includes("PROCESANDO") ||
    estado.includes("VALIDANDO") ||
    estado.includes("PENDING")
  ) {
    return "EN_PROCESO";
  }

  // Estados de error específicos
  if (
    estado.includes("NCF") &&
    (estado.includes("INVALIDO") || estado.includes("USADO"))
  ) {
    return "NCF_INVALIDO";
  }

  if (estado.includes("RNC") && estado.includes("NO_AUTORIZADO")) {
    return "RNC_NO_AUTORIZADO";
  }

  // Estados de error generales
  if (
    estado.includes("RECHAZADA") ||
    estado.includes("ERROR") ||
    estado.includes("FAILED") ||
    estado.includes("INVALID")
  ) {
    return "RECHAZADA";
  }

  // Estados de cancelación
  if (
    estado.includes("ANULADA") ||
    estado.includes("CANCELADA") ||
    estado.includes("CANCELLED")
  ) {
    return "ANULADA";
  }

  // PRIORIDAD 3: Verificar código numérico independiente (si no se verificó arriba)
  if (datosCompletos.codigo !== undefined) {
    switch (datosCompletos.codigo) {
      // ✅ Estados exitosos
      case 0:
      case 1:
        return "APROBADA";

      // ⏳ Estados en proceso
      case 2:
      case 4: // En proceso de validación en DGII
      case 10:
      case 15:
      case 95:
      case 99: // Sin respuesta DGII - documento enviado pero pendiente de respuesta
        return "EN_PROCESO";

      // ❌ Errores de NCF
      case 108:
        return "NCF_INVALIDO";
      case 109:
        return "NCF_VENCIDO";

      // ❌ Errores de autorización
      case 110:
        return "RNC_NO_AUTORIZADO";

      // ❌ Errores de validación de datos
      case 111:
      case 112:
      case 113:
      case 114:
        return "DATOS_INVALIDOS";

      // ❌ Errores de búsqueda/no encontrado
      case 120:
        return "NO_ENCONTRADO"; // Documento no existe en BD de TheFactoryHKA

      // ❌ Estados de rechazo DGII
      case 200:
      case 201:
      case 202:
      case 203:
        return "RECHAZADA";

      // ❌ Errores de reglas de negocio DGII (600-699)
      case 613:
        return "RECHAZADA"; // Error específico: comprobantes no pueden reemplazarse entre ellos mismos
      case 634:
        return "RECHAZADA"; // Error específico: fecha de NCF modificado no coincide

      // 🚫 Estados de cancelación
      case 300:
      case 301:
        return "ANULADA";

      default:
        console.warn(
          `⚠️ Código de TheFactoryHKA no mapeado: ${datosCompletos.codigo}`
        );
        return "ERROR";
    }
  }

  // Si no coincide con ningún patrón conocido
  console.log("❓ No se encontró coincidencia con ningún patrón conocido");
  console.log(
    `🔄 ==================== FIN NORMALIZACIÓN: ${
      estado || "DESCONOCIDO"
    } ====================\n`
  );
  return estado || "DESCONOCIDO";
};

// Función para consultar el estatus de un documento en TheFactoryHKA
// @param {string} ncf - Número de comprobante fiscal
// @param {string} rnc - RNC del emisor (de la data de la petición)
const consultarEstatusInmediato = async (ncf, rnc) => {
  if (!rnc) {
    console.warn(
      "⚠️ consultarEstatusInmediato: RNC no proporcionado, no se puede consultar estatus"
    );
    return {
      consultaExitosa: false,
      datosEstatus: null,
      timestamp: new Date().toISOString(),
    };
  }
  try {
    console.log(
      `\n🔍 ==================== INICIO CONSULTA ESTATUS ====================`
    );
    console.log(`📄 NCF a consultar: ${ncf}`);

    const token = await obtenerTokenTheFactory(rnc);
    console.log(`🔐 Token obtenido: ${token.substring(0, 30)}...`);

    const payload = {
      token: token,
      rnc: rnc,
      documento: ncf,
    };

    console.log("📤 Payload enviado a TheFactoryHKA:");
    console.log(JSON.stringify(payload, null, 2));
    console.log(`🌐 URL de consulta: ${THEFACTORY_ESTATUS_URL}`);
    console.log(`🏢 RNC usado para consulta: ${rnc}`);

    const response = await axios.post(THEFACTORY_ESTATUS_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 segundos
    });

    console.log("📥 Respuesta RAW de TheFactoryHKA (response.data):");
    console.log(JSON.stringify(response.data, null, 2));
    console.log(`📊 Status HTTP: ${response.status}`);
    console.log(
      `🔍 ==================== FIN CONSULTA ESTATUS ====================\n`
    );

    return {
      consultaExitosa: true,
      datosEstatus: response.data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Error al consultar estatus (no crítico):", error.message);
    if (error.response) {
      console.error("📥 Respuesta de error de TheFactoryHKA:");
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error(`📊 Status HTTP de error: ${error.response.status}`);
    }
    console.log(
      `🔍 ==================== FIN CONSULTA ESTATUS (ERROR) ====================\n`
    );

    // No lanzamos error, solo devolvemos información de que falló
    return {
      consultaExitosa: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// Crear un nuevo rango de numeración de e-CF
const createComprobante = async (req, res) => {
  try {
    // Limpiar fecha_vencimiento si viene vacía y el tipo no la requiere (tipos 32 y 34)
    const rangoData = {
      ...req.body,
      usuario: req.user._id,
    };

    // Si fecha_vencimiento es string vacío, null o undefined, y es tipo 32 o 34, eliminarla
    if (
      ["32", "34"].includes(rangoData.tipo_comprobante) &&
      (!rangoData.fecha_vencimiento || rangoData.fecha_vencimiento === "")
    ) {
      delete rangoData.fecha_vencimiento;
      // console.log(
      //   `📅 Tipo ${rangoData.tipo_comprobante}: fecha_vencimiento removida (opcional)`,
      // );
    }

    const rango = await Comprobante.create(rangoData);

    return res.status(httpStatus.CREATED).json({
      status: "success",
      message: "Rango de numeración creado exitosamente",
      data: rango,
    });
  } catch (err) {
    console.error("Error al crear rango de numeración:", err);

    if (err.name === "ValidationError") {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: "Datos del rango inválidos",
        details: err.message,
      });
    }

    if (err.name === "MongoServerError" && err.code === 11000) {
      return res.status(httpStatus.CONFLICT).json({
        status: "error",
        message:
          "Ya existe un rango con esos números para este RNC y tipo de comprobante",
      });
    }

    // Manejar error de superposición de rangos
    if (err.message.includes("Ya existe un rango con números superpuestos")) {
      return res.status(httpStatus.CONFLICT).json({
        status: "error",
        message: err.message,
      });
    }

    if (err.message.includes("El número final debe ser mayor")) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: err.message,
      });
    }

    if (err.message.includes("La fecha de vencimiento debe ser posterior")) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: err.message,
      });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al crear el rango de numeración",
    });
  }
};

// Obtener todos los rangos de numeración del usuario
const getAllComprobantes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      estado,
      tipo_comprobante,
      rnc,
      vencimiento_proximo,
    } = req.query;

    // console.log('estado', estado);
    // console.log('tipo_comprobante', tipo_comprobante);
    // console.log('rnc', rnc);
    // console.log('vencimiento_proximo', vencimiento_proximo);

    const skip = (page - 1) * limit;

    // Construir filtros - REMOVIDO filtro por usuario para mostrar todos los comprobantes
    const filters = {};
    if (estado) filters.estado = estado;
    if (tipo_comprobante) filters.tipo_comprobante = tipo_comprobante;
    if (rnc) filters.rnc = new RegExp(rnc, "i");

    // Filtro para rangos que vencen pronto (próximos 30 días)
    if (vencimiento_proximo === "true") {
      const treintaDias = new Date();
      treintaDias.setDate(treintaDias.getDate() + 30);
      filters.fecha_vencimiento = { $lte: treintaDias };
    }

    const rangos = await Comprobante.find(filters)
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("usuario", "name email");

    const total = await Comprobante.countDocuments(filters);

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Rangos de numeración encontrados",
      data: rangos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error al obtener rangos:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al obtener rangos de numeración",
    });
  }
};

// Obtener un rango por ID
const getComprobanteById = async (req, res) => {
  try {
    const { id } = req.params;

    const rango = await Comprobante.findOne({
      _id: id,
      usuario: req.user._id,
    }).populate("usuario", "name email");

    if (!rango) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Rango de numeración no encontrado",
      });
    }

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Rango de numeración encontrado",
      data: rango,
    });
  } catch (err) {
    console.error("Error al obtener rango:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al obtener el rango",
    });
  }
};

// Actualizar un rango de numeración
const updateComprobante = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("📝 Intentando actualizar comprobante:", {
      id,
      usuario: req.user._id,
      datos: req.body,
    });

    // Buscar el rango existente sin validar usuario propietario
    const existingRango = await Comprobante.findById(id);

    if (!existingRango) {
      console.log("❌ Comprobante no encontrado:", id);
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Comprobante no encontrado",
      });
    }

    // console.log('✅ Comprobante encontrado, actualizando sin restricciones');
    // console.log('📊 Estado antes de actualizar:', existingRango.estado);

    // Limpiar fecha_vencimiento si viene vacía y el tipo no la requiere (tipos 32 y 34)
    const updateData = { ...req.body };
    if (
      ["32", "34"].includes(
        updateData.tipo_comprobante || existingRango.tipo_comprobante
      ) &&
      (updateData.fecha_vencimiento === "" ||
        updateData.fecha_vencimiento === null)
    ) {
      updateData.fecha_vencimiento = undefined;
      // console.log(
      //   `📅 Tipo ${updateData.tipo_comprobante || existingRango.tipo_comprobante}: fecha_vencimiento removida (opcional)`,
      // );
    }

    // Actualizar todos los campos enviados sin restricciones
    Object.assign(existingRango, updateData);
    existingRango.fechaActualizacion = Date.now();

    // console.log('📊 Estado después de Object.assign:', existingRango.estado);

    const rango = await existingRango.save();

    // console.log('📊 Estado después de save:', rango.estado);

    // Populate el usuario para mantener la consistencia con otras respuestas
    await rango.populate("usuario", "name email");

    // console.log('✅ Comprobante actualizado exitosamente:', {
    //   id: rango._id,
    //   estado_final: rango.estado,
    //   usuario_original: existingRango.usuario,
    //   actualizado_por: req.user._id,
    // });

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Comprobante actualizado exitosamente",
      data: rango,
    });
  } catch (err) {
    console.error("❌ Error al actualizar comprobante:", err);

    if (err.name === "ValidationError") {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: "Datos del comprobante inválidos",
        details: err.message,
      });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al actualizar el comprobante",
    });
  }
};

// Cambiar estado de un rango
const updateComprobanteEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    // console.log('🔄 Intentando actualizar estado del comprobante:', {
    //   id,
    //   estado,
    //   usuario: req.user._id,
    // });

    const validEstados = ["activo", "inactivo", "vencido", "agotado"];
    if (!validEstados.includes(estado)) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message:
          "Estado inválido. Debe ser: activo, inactivo, vencido o agotado",
      });
    }

    // Actualizar sin validar usuario propietario
    const rango = await Comprobante.findByIdAndUpdate(
      id,
      { estado, fechaActualizacion: Date.now() },
      { new: true }
    ).populate("usuario", "name email");

    if (!rango) {
      // console.log('❌ Comprobante no encontrado:', id);
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Comprobante no encontrado",
      });
    }

    // console.log('✅ Estado actualizado exitosamente:', {
    //   id: rango._id,
    //   nuevo_estado: estado,
    // });

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Estado del comprobante actualizado exitosamente",
      data: rango,
    });
  } catch (err) {
    console.error("❌ Error al actualizar estado:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al actualizar el estado",
    });
  }
};

// Eliminar un rango (solo si no se han utilizado números)
const deleteComprobante = async (req, res) => {
  try {
    const { id } = req.params;

    // console.log('🗑️ Intentando eliminar comprobante:', {
    //   id,
    //   usuario: req.user._id,
    //   usuarioEmail: req.user.email,
    // });

    // Validar que el ID sea un ObjectId válido de MongoDB
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      // console.log('❌ ID inválido:', id);
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: "ID de comprobante inválido",
      });
    }

    // Eliminar el comprobante directamente sin validar usuario propietario
    const rango = await Comprobante.findByIdAndDelete(id);

    if (!rango) {
      // console.log('❌ Comprobante no encontrado:', id);
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Comprobante no encontrado",
      });
    }

    // console.log('✅ Comprobante eliminado exitosamente:', {
    //   id: rango._id,
    //   rnc: rango.rnc,
    //   tipo_comprobante: rango.tipo_comprobante,
    //   usuario_original: rango.usuario,
    //   eliminado_por: req.user._id,
    // });

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Comprobante eliminado exitosamente",
      data: {
        id: rango._id,
        rnc: rango.rnc,
        tipo_comprobante: rango.tipo_comprobante,
        numeros_utilizados: rango.numeros_utilizados,
      },
    });
  } catch (err) {
    console.error("❌ Error al eliminar comprobante:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al eliminar el comprobante",
      error: err.message,
    });
  }
};

// Obtener estadísticas de rangos del usuario
const getComprobantesStats = async (req, res) => {
  try {
    const stats = await Comprobante.aggregate([
      { $match: { usuario: req.user._id } },
      {
        $group: {
          _id: "$estado",
          count: { $sum: 1 },
          totalNumeros: { $sum: "$cantidad_numeros" },
          numerosUtilizados: { $sum: "$numeros_utilizados" },
          numerosDisponibles: { $sum: "$numeros_disponibles" },
        },
      },
    ]);

    const totalRangos = await Comprobante.countDocuments({
      usuario: req.user._id,
    });

    // Rangos que vencen en los próximos 30 días
    const treintaDias = new Date();
    treintaDias.setDate(treintaDias.getDate() + 30);

    const vencenProximamente = await Comprobante.countDocuments({
      usuario: req.user._id,
      fecha_vencimiento: { $lte: treintaDias },
      estado: { $in: ["activo", "alerta"] }, // Incluir rangos activos y en alerta
    });

    // Rangos con alertas (estado 'alerta' o números bajos)
    const conAlertas = await Comprobante.countDocuments({
      usuario: req.user._id,
      estado: "alerta", // Ahora usamos el estado específico de alerta
    });

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Estadísticas obtenidas exitosamente",
      data: {
        totalRangos,
        vencenProximamente,
        conAlertas,
        porEstado: stats,
      },
    });
  } catch (err) {
    console.error("Error al obtener estadísticas:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al obtener estadísticas",
    });
  }
};

// Consumir un número de un rango específico
const consumirNumero = async (req, res) => {
  try {
    const { id } = req.params;

    const rango = await Comprobante.findOne({
      _id: id,
      usuario: req.user._id,
    });

    if (!rango) {
      return res.status(httpStatus.NOT_FOUND).json({
        status: "error",
        message: "Rango de numeración no encontrado",
      });
    }

    if (!rango.esValido()) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: "El rango no está disponible (vencido, agotado o inactivo)",
      });
    }

    await rango.consumirNumero();

    // Calcular el número que se acaba de consumir
    const numeroConsumido = rango.numero_inicial + rango.numeros_utilizados - 1;

    // Formatear el número según estructura e-CF
    const numeroFormateado = rango.formatearNumeroECF(numeroConsumido);

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Número consumido exitosamente",
      data: {
        numeroConsumido: numeroConsumido,
        numeroFormateado: numeroFormateado,
        numerosDisponibles: rango.numeros_disponibles,
        estadoRango: rango.estado,
      },
    });
  } catch (err) {
    console.error("Error al consumir número:", err);

    if (err.message.includes("No hay números disponibles")) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: err.message,
      });
    }

    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno del servidor al consumir número",
    });
  }
};

// Consumir un número por RNC y tipo de comprobante (igual lógica que POST /api/comprobantes/solicitar-numero)
// Requiere API Key en Authorization: Bearer <api_key> o header x-api-key; filtra por usuario dueño de la key.
const consumirNumeroPorRnc = async (req, res) => {
  try {
    const apiKey = getApiKeyFromRequest(req);
    if (!apiKey) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ error: "No autorizado" });
    }

    const userId = await getUserIdByApiKey(apiKey);
    if (!userId) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ error: "No autorizado" });
    }

    const body = req.body || {};
    const rncRaw =
      body.rnc != null ? String(body.rnc).replace(/\D/g, "").trim() : "";
    const tipo_comprobante =
      body.tipo_comprobante != null ? String(body.tipo_comprobante).trim() : "";
    const solo_preview = Boolean(body.solo_preview);

    if (!rncRaw || rncRaw.length < RNC_MIN || rncRaw.length > RNC_MAX) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error: "RNC inválido (debe tener entre 9 y 11 dígitos)",
      });
    }
    if (!TIPOS_COMPROBANTE.includes(tipo_comprobante)) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error:
          "Tipo de comprobante inválido. Debe ser: 31, 32, 33, 34, 41, 43, 44, 45",
      });
    }

    const query = {
      usuario: new mongoose.Types.ObjectId(userId),
      rnc: rncRaw,
      tipo_comprobante,
      estado: { $in: ["activo", "alerta"] },
      numeros_disponibles: { $gt: 0 },
    };

    if (!["32", "34"].includes(tipo_comprobante)) {
      query.$or = [
        { fecha_vencimiento: { $gte: new Date() } },
        { fecha_vencimiento: null },
      ];
    }

    const rango = await Comprobante.findOne(query)
      .sort({ fechaCreacion: 1 })
      .exec();

    if (!rango) {
      return res.status(httpStatus.NOT_FOUND).json({
        error: "Secuencia no encontrada o no autorizada",
      });
    }

    if (!rango.esValido()) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error: "El rango no está disponible (vencido, agotado o inactivo)",
      });
    }

    const fechaVencimiento = formatFechaVencimiento(rango.fecha_vencimiento);

    if (solo_preview) {
      const proximoNumero = rango.numero_inicial + rango.numeros_utilizados;
      const numeroFormateado = rango.formatearNumeroECF(proximoNumero);
      return res.status(httpStatus.OK).json({
        status: "success",
        message: "Próximo número (sin consumir)",
        data: {
          proximoNumero,
          numeroFormateado,
          numerosDisponibles: rango.numeros_disponibles,
          estadoRango: rango.estado,
          fechaVencimiento,
        },
      });
    }

    await rango.consumirNumero();
    const numeroConsumido = rango.numero_inicial + rango.numeros_utilizados - 1;
    const numeroFormateado = rango.formatearNumeroECF(numeroConsumido);

    let mensajeAlerta = null;
    if (rango.estado === "agotado") {
      mensajeAlerta =
        "ÚLTIMO COMPROBANTE USADO - Solicitar nuevo rango urgente";
    } else if (rango.estado === "alerta") {
      mensajeAlerta = `Quedan ${rango.numeros_disponibles} comprobantes - Solicitar nuevo rango pronto`;
    }

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Número consumido exitosamente",
      data: {
        numeroConsumido,
        numeroFormateado,
        numerosDisponibles: rango.numeros_disponibles,
        estadoRango: rango.estado,
        fechaVencimiento,
        alertaAgotamiento:
          rango.estado === "alerta" || rango.estado === "agotado",
        mensajeAlerta,
        rnc: rango.rnc,
        tipoComprobante: rango.tipo_comprobante,
        prefijo: rango.prefijo ?? "E",
      },
    });
  } catch (err) {
    if (err.message?.includes("No hay números disponibles")) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error: "No hay números disponibles en el rango",
      });
    }
    console.error("Error al consumir número por RNC:", err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      error: "Error al solicitar número",
    });
  }
};

// Función para convertir strings vacíos a null (requerido por TheFactoryHKA)
const stringVacioANull = (valor) => {
  if (valor === "" || valor === undefined || valor === null) {
    return null;
  }
  return typeof valor === "string" ? valor.trim() || null : valor;
};

const stringVacioANullLimit = (valor, max) => {
  const sanitized = stringVacioANull(valor);
  if (!sanitized || typeof sanitized !== "string" || !max) return sanitized;
  return sanitized.length > max ? sanitized.slice(0, max) : sanitized;
};

// Formato de teléfono para DGII/TheFactory (TelefonoValidationType): XXX-XXX-XXXX
const formatearTelefonoDGII = (tel) => {
  if (tel == null || tel === "") return null;
  const digits = String(tel).replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

// Función para transformar JSON simplificado al formato de TheFactoryHKA
const transformarFacturaParaTheFactory = (facturaSimple, token) => {
  const {
    comprador,
    emisor,
    factura,
    items,
    ItemsDevueltos,
    modificacion,
    descuentos,
    DescuentosORecargos,
  } = facturaSimple;

  // RNC del emisor: siempre se toma de emisor.rnc
  const rncEmisor =
    emisor?.rnc != null && String(emisor.rnc).trim() !== ""
      ? String(emisor.rnc).trim()
      : null;
  let facturaAdaptada = { ...factura, rnc: rncEmisor };
  let itemsAdaptados = items;
  const MAX_INTERNO_LENGTH = 12;

  // 🔧 ADAPTACIÓN PARA TIPOS 33 Y 34: Mapear estructura específica de FileMaker
  if ((factura?.tipo === "33" || factura?.tipo === "34") && modificacion) {
    console.log(
      `🔧 Adaptando estructura de tipo ${factura.tipo} desde FileMaker...`
    );

    // Mapear campos de modificacion a factura (PascalCase → camelCase)
    facturaAdaptada = {
      ...facturaAdaptada,
      ncfModificado: modificacion.NCFModificado,
      fechaNCFModificado: modificacion.FechaNCFModificado,
      // ✅ TheFactoryHKA espera STRING SIN ceros iniciales según ejemplos reales
      // Remover ceros iniciales: "06" → "6", "05" → "5", "6" → "6"
      codigoModificacion:
        String(modificacion.CodigoModificacion || "")
          .trim()
          .replace(/^0+/, "") || "0",
      razonModificacion:
        modificacion.RazonModificacion?.trim() ||
        modificacion.RazonModificacion,
    };

    console.log(
      `📋 Campos de modificación mapeados para tipo ${factura.tipo}:`,
      {
        ncfModificado: facturaAdaptada.ncfModificado,
        fechaNCFModificado: facturaAdaptada.fechaNCFModificado,
        codigoModificacion: facturaAdaptada.codigoModificacion,
        razonModificacion: facturaAdaptada.razonModificacion,
      }
    );
  }

  // Si vienen ItemsDevueltos en lugar de items Y es tipo 34, usarlos
  if (ItemsDevueltos && ItemsDevueltos.length > 0 && factura?.tipo === "34") {
    console.log("🔧 Usando ItemsDevueltos como items para tipo 34...");
    itemsAdaptados = ItemsDevueltos.map((item) => ({
      nombre: item.nombre,
      precio: item.montoAcreditar || item.precio, // Usar montoAcreditar si existe, sino precio
    }));
    console.log("📋 Items adaptados:", itemsAdaptados);
  }

  // Validar que tenemos los datos básicos necesarios (usando datos adaptados)
  const camposFaltantes = [];

  // 🔍 Validación específica por tipo de comprobante para RNC del comprador
  if (facturaAdaptada?.tipo === "32") {
    // Tipo 32 (Consumo): RNC del comprador debe ser null (consumidor final)
    // No validamos comprador.rnc para tipo 32
    console.log(
      "📋 Tipo 32 detectado - RNC comprador será null (consumidor final)"
    );
  } else {
    // Otros tipos (31, 33, 34, 41, 43, 44, 45): RNC del comprador es obligatorio
    if (!comprador?.rnc) camposFaltantes.push("comprador.rnc");
  }

  // Validaciones obligatorias para TODOS los tipos
  if (!rncEmisor) camposFaltantes.push("emisor.rnc");
  if (!facturaAdaptada?.ncf) camposFaltantes.push("factura.ncf");
  if (!facturaAdaptada?.tipo) camposFaltantes.push("factura.tipo");
  if (!itemsAdaptados?.length)
    camposFaltantes.push("items (debe tener al menos 1 elemento)");

  if (camposFaltantes.length > 0) {
    console.error("❌ Validación fallida - Campos faltantes:", camposFaltantes);
    console.error("📋 Datos recibidos:", {
      "comprador.rnc": comprador?.rnc || "FALTANTE (null para tipo 32)",
      "emisor.rnc": emisor?.rnc || "FALTANTE",
      "factura.ncf": facturaAdaptada?.ncf || "FALTANTE",
      "factura.tipo": facturaAdaptada?.tipo || "FALTANTE",
      "items.length": itemsAdaptados?.length || 0,
      tipoComprobante: facturaAdaptada?.tipo,
    });
    throw new Error(
      `Faltan datos obligatorios en la factura: ${camposFaltantes.join(", ")}`
    );
  }

  // 📅 Formatear y validar fecha de vencimiento del NCF
  // Para tipos 32 y 34, la fecha de vencimiento es OPCIONAL
  let fechaVencimientoFormateada = null;

  // Solo procesar fecha de vencimiento si NO es tipo 32 o 34
  if (!["32", "34"].includes(facturaAdaptada.tipo)) {
    // Calcular dinámicamente una fecha de vencimiento segura como fallback
    const fechaActual = new Date();
    const añoActual = fechaActual.getFullYear();
    const mesActual = fechaActual.getMonth() + 1; // getMonth() retorna 0-11

    // Si estamos en diciembre, usar el próximo año para evitar vencimiento inmediato
    const añoVencimiento = mesActual === 12 ? añoActual + 1 : añoActual;
    fechaVencimientoFormateada = `31-12-${añoVencimiento}`; // Fecha segura y dinámica

    if (facturaAdaptada.fechaVencNCF) {
      try {
        // Validar formato de fecha (puede venir como DD-MM-YYYY o YYYY-MM-DD)
        const fecha = facturaAdaptada.fechaVencNCF;
        if (fecha.match(/^\d{2}-\d{2}-\d{4}$/)) {
          // Ya está en formato DD-MM-YYYY
          fechaVencimientoFormateada = fecha;
        } else if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Convertir de YYYY-MM-DD a DD-MM-YYYY
          const [year, month, day] = fecha.split("-");
          fechaVencimientoFormateada = `${day}-${month}-${year}`;
        } else {
          console.warn(
            `⚠️ Formato de fecha NCF no reconocido: ${fecha}, usando fecha calculada: ${fechaVencimientoFormateada}`
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ Error al procesar fecha de vencimiento NCF: ${error.message}, usando fecha calculada: ${fechaVencimientoFormateada}`
        );
      }
    } else {
      // console.log(
      //   `📅 fechaVencNCF no proporcionada para tipo ${facturaAdaptada.tipo}, usando fecha calculada: ${fechaVencimientoFormateada}`,
      // );
    }
  } else {
    // Para tipos 32 y 34, no se requiere fecha de vencimiento
    // console.log(
    //   `📅 Tipo ${facturaAdaptada.tipo}: fechaVencNCF no requerida (opcional)`,
    // );
  }

  // console.log(`📅 Fecha vencimiento NCF final: ${fechaVencimientoFormateada}`);

  // Calcular totales PRIMERO
  const montoTotal = parseFloat(facturaAdaptada.total).toFixed(2);

  // Función para limpiar y parsear montos con comas
  const parsearMonto = (monto) => {
    if (!monto) return 0;
    // Remover comas y parsear como número
    const montoLimpio = monto.toString().replace(/,/g, "");
    return parseFloat(montoLimpio) || 0;
  };

  // 🧮 Calcular montoExento basado en los items (con parsing correcto)
  // Lógica de cálculo de montos según el tipo de comprobante
  let montoExentoCalculado, montoGravadoCalculado;

  if (facturaAdaptada.tipo === "45") {
    // Tipo 45 (Gubernamental): Por defecto todos los items son GRAVADOS
    // Solo si se marca explícitamente como exento, se considera exento
    montoExentoCalculado = itemsAdaptados
      .reduce((suma, item) => {
        const precio = parsearMonto(item.precio);
        // Solo si específicamente se marca como exento
        if (
          item.itbis === false ||
          item.exento === true ||
          item.gravado === false
        ) {
          return suma + precio;
        }
        return suma; // Por defecto gravado para tipo 45
      }, 0)
      .toFixed(2);

    montoGravadoCalculado = itemsAdaptados
      .reduce((suma, item) => {
        const precio = parsearMonto(item.precio);
        // Si específicamente se marca como exento, no lo incluimos en gravado
        if (
          item.itbis === false ||
          item.exento === true ||
          item.gravado === false
        ) {
          return suma;
        }
        // Por defecto gravado para tipo 45
        return suma + precio;
      }, 0)
      .toFixed(2);
  } else {
    // Para otros tipos: servicios médicos generalmente son exentos de ITBIS
    // Si un item tiene .itbis = false o .exento = true, se considera exento
    // Si no tiene esas propiedades, asumimos que es exento (servicios médicos)
    montoExentoCalculado = itemsAdaptados
      .reduce((suma, item) => {
        const precio = parsearMonto(item.precio);
        // Si específicamente se marca como gravado, no lo incluimos en exento
        if (item.itbis === true || item.gravado === true) {
          return suma; // No sumarlo al exento
        }
        // Por defecto, servicios médicos son exentos
        return suma + precio;
      }, 0)
      .toFixed(2);

    // Calcular monto gravado (lo que no es exento)
    montoGravadoCalculado = itemsAdaptados
      .reduce((suma, item) => {
        const precio = parsearMonto(item.precio);
        // Solo si específicamente se marca como gravado
        if (item.itbis === true || item.gravado === true) {
          return suma + precio;
        }
        return suma;
      }, 0)
      .toFixed(2);
  }

  // 🔧 VERIFICAR Y CORREGIR MONTO TOTAL
  // Calcular el total real basado en la suma de items
  const montoTotalCalculado = (
    parseFloat(montoExentoCalculado) + parseFloat(montoGravadoCalculado)
  ).toFixed(2);
  const montoTotalDeclarado = parseFloat(montoTotal).toFixed(2);

  // Si hay una diferencia significativa, usar el total calculado de items como fuente de verdad
  let montoTotalCorregido = montoTotal;
  if (
    Math.abs(
      parseFloat(montoTotalCalculado) - parseFloat(montoTotalDeclarado)
    ) > 0.01
  ) {
    console.log(`⚠️ INCONSISTENCIA EN MONTO TOTAL:`);
    console.log(`   - Total declarado por FileMaker: ${montoTotalDeclarado}`);
    console.log(`   - Total calculado de items: ${montoTotalCalculado}`);
    console.log(
      `   - Diferencia: ${(
        parseFloat(montoTotalDeclarado) - parseFloat(montoTotalCalculado)
      ).toFixed(2)}`
    );
    console.log(`   - Usando total calculado de items para DGII`);

    montoTotalCorregido = montoTotalCalculado;
  }

  // 💰 MANEJO DE DESCUENTOS GLOBALES
  let descuentosArray = [];
  let totalDescuentos = 0;
  let montoTotalConDescuentos = parseFloat(montoTotalCorregido);

  // Procesar descuentos desde diferentes estructuras
  let descuentosParaProcesar = null;

  // Prioridad 1: Nueva estructura desde FileMaker (DescuentosORecargos.Descuentos)
  if (DescuentosORecargos?.Descuentos) {
    descuentosParaProcesar = DescuentosORecargos.Descuentos;
    console.log(
      "💸 Procesando descuentos desde DescuentosORecargos.Descuentos:",
      descuentosParaProcesar
    );
  }
  // Prioridad 2: Estructura anterior (campo descuentos directo)
  else if (
    descuentos &&
    (Array.isArray(descuentos) || typeof descuentos === "object")
  ) {
    descuentosParaProcesar = descuentos;
    console.log(
      "💸 Procesando descuentos desde campo descuentos:",
      descuentosParaProcesar
    );
  }

  // Procesar descuentos si se encontraron
  if (descuentosParaProcesar) {
    // Si descuentos es un array
    if (Array.isArray(descuentosParaProcesar)) {
      // Filtrar descuentos con monto mayor a cero
      const descuentosValidos = descuentosParaProcesar.filter((descuento) => {
        const montoDescuento = parsearMonto(
          descuento.Monto || descuento.monto || descuento.valor || 0
        );
        return montoDescuento > 0;
      });

      console.log(
        `💸 Descuentos totales: ${descuentosParaProcesar.length}, válidos (>0): ${descuentosValidos.length}`
      );

      if (descuentosValidos.length > 0) {
        descuentosArray = descuentosValidos.map((descuento, index) => {
          // Manejo flexible de diferentes campos para el monto
          const montoDescuento = parsearMonto(
            descuento.Monto || descuento.monto || descuento.valor || 0
          );
          totalDescuentos += montoDescuento;

          return {
            numeroLinea: (index + 1).toString(),
            tipoAjuste: "D", // D = Descuento
            descripcion:
              descuento.Descripcion ||
              descuento.descripcion ||
              descuento.concepto ||
              "Descuento aplicado",
            tipoValor: "$",
            montoDescuentooRecargo: montoDescuento.toFixed(2),
            indicadorFacturacionDescuentooRecargo:
              descuento.indicadorFacturacion || "1",
          };
        });
      }
    }
    // Si descuentos es un objeto con descuento global
    else if (
      descuentosParaProcesar.Monto ||
      descuentosParaProcesar.monto ||
      descuentosParaProcesar.valor ||
      descuentosParaProcesar.porcentaje
    ) {
      let montoDescuento = 0;

      if (descuentosParaProcesar.porcentaje) {
        // Calcular descuento por porcentaje
        const porcentaje = parseFloat(descuentosParaProcesar.porcentaje);
        montoDescuento = (parseFloat(montoTotalCorregido) * porcentaje) / 100;
        console.log(
          `💸 Descuento por porcentaje: ${porcentaje}% de ${montoTotalCorregido} = ${montoDescuento.toFixed(
            2
          )}`
        );
      } else {
        // Descuento por monto fijo
        montoDescuento = parsearMonto(
          descuentosParaProcesar.Monto ||
            descuentosParaProcesar.monto ||
            descuentosParaProcesar.valor
        );
        console.log(
          `💸 Descuento por monto fijo: ${montoDescuento.toFixed(2)}`
        );
      }

      // Solo agregar descuento si el monto es mayor a cero
      if (montoDescuento > 0) {
        totalDescuentos = montoDescuento;

        const valorCampo = descuentosParaProcesar.porcentaje
          ? parseFloat(descuentosParaProcesar.porcentaje).toFixed(2)
          : montoDescuento.toFixed(2);
        const montoCampo = montoDescuento.toFixed(2);

        descuentosArray = [
          {
            numeroLinea: "1",
            tipoAjuste: "D", // D = Descuento
            descripcion:
              descuentosParaProcesar.Descripcion ||
              descuentosParaProcesar.descripcion ||
              descuentosParaProcesar.concepto ||
              "Descuento global",
            tipoValor: descuentosParaProcesar.porcentaje ? "%" : "$",
            montoDescuentooRecargo: montoCampo,
            indicadorFacturacionDescuentooRecargo:
              descuentosParaProcesar.indicadorFacturacion || "1",
          },
        ];

        console.log(
          `💸 Descuento global válido agregado: ${montoDescuento.toFixed(2)}`
        );
      } else {
        console.log(
          `💸 Descuento global ignorado (monto cero): ${montoDescuento.toFixed(
            2
          )}`
        );
      }
    }

    // Calcular monto total después de descuentos
    montoTotalConDescuentos = parseFloat(montoTotalCorregido) - totalDescuentos;

    console.log(`💸 Total descuentos aplicados: ${totalDescuentos.toFixed(2)}`);
    console.log(`💰 Monto total original: ${montoTotalCorregido}`);
    console.log(
      `💰 Monto total con descuentos: ${montoTotalConDescuentos.toFixed(2)}`
    );
  }

  // 🧮 AJUSTAR MONTOS EXENTOS Y GRAVADOS DESPUÉS DE DESCUENTOS
  // Para servicios médicos, la mayoría son exentos, así que simplificamos:
  // Si hay descuentos, el monto exento es igual al monto total con descuentos
  let montoExentoConDescuentos = parseFloat(montoExentoCalculado);
  let montoGravadoConDescuentos = parseFloat(montoGravadoCalculado);

  if (totalDescuentos > 0) {
    // Para servicios médicos (principalmente exentos), ajustar de manera simple:
    // - Si todo es exento, el monto exento = monto total con descuentos
    // - Si hay montos gravados, aplicar proporción

    if (parseFloat(montoGravadoCalculado) === 0) {
      // Solo hay montos exentos: el exento final = total con descuentos
      montoExentoConDescuentos = montoTotalConDescuentos;
      montoGravadoConDescuentos = 0;

      console.log(`💰 Ajuste simple para servicios exentos:`);
      console.log(
        `   - Todo es exento, monto exento = monto total con descuentos`
      );
      console.log(
        `   - Monto exento final: ${montoExentoConDescuentos.toFixed(2)}`
      );
    } else {
      // Hay montos gravados y exentos: aplicar proporción
      const proporcionDescuento =
        totalDescuentos / parseFloat(montoTotalCorregido);
      montoExentoConDescuentos =
        parseFloat(montoExentoCalculado) * (1 - proporcionDescuento);
      montoGravadoConDescuentos =
        parseFloat(montoGravadoCalculado) * (1 - proporcionDescuento);

      console.log(`💰 Ajuste proporcional para montos mixtos:`);
      console.log(
        `   - Monto exento con descuento: ${montoExentoConDescuentos.toFixed(
          2
        )}`
      );
      console.log(
        `   - Monto gravado con descuento: ${montoGravadoConDescuentos.toFixed(
          2
        )}`
      );
      console.log(
        `   - Proporción descuento: ${(proporcionDescuento * 100).toFixed(2)}%`
      );
    }
  }

  // console.log(`💰 Cálculo de totales:`, {
  //   tipoComprobante: facturaAdaptada.tipo,
  //   montoTotalFactura: montoTotal,
  //   montoExentoCalculado: montoExentoCalculado,
  //   montoGravadoCalculado: montoGravadoCalculado,
  //   totalDescuentos: totalDescuentos.toFixed(2),
  //   montoTotalConDescuentos: montoTotalConDescuentos.toFixed(2),
  //   sumaCalculada: (
  //     parseFloat(montoExentoCalculado) + parseFloat(montoGravadoCalculado)
  //   ).toFixed(2),
  //   diferencia: (
  //     parseFloat(montoTotal) -
  //     parseFloat(montoExentoCalculado) -
  //     parseFloat(montoGravadoCalculado)
  //   ).toFixed(2),
  // });

  // Construir los detalles de items DESPUÉS de calcular los montos - camelCase según ejemplo oficial
  const detallesItems = itemsAdaptados.map((item, index) => {
    // Determinar si este item específico es gravado o exento
    let itemEsGravado = false;

    if (facturaAdaptada.tipo === "45") {
      // Tipo 45 (Gubernamental): Servicios médicos son EXENTOS por defecto
      // Solo gravado si se marca explícitamente con itbis=true o gravado=true
      itemEsGravado = item.itbis === true || item.gravado === true;
    } else {
      // Otros tipos: Por defecto exento (servicios médicos), solo gravado si se marca explícitamente
      itemEsGravado = item.itbis === true || item.gravado === true;
    }

    const itemCompleto = {
      NumeroLinea: (index + 1).toString(),
      IndicadorFacturacion: itemEsGravado ? "1" : "4", // 1=gravado, 4=exento
    };

    // Para tipos 41, 46, 47: incluir sección retencion OBLIGATORIA
    // NOTA: Tipos 43, 44 y 45 NO incluyen retención según validación de TheFactoryHKA
    if (
      facturaAdaptada.tipo === "41" ||
      facturaAdaptada.tipo === "46" ||
      facturaAdaptada.tipo === "47"
    ) {
      itemCompleto.retencion = {
        indicadorAgente: "1",
        montoITBIS: itemEsGravado
          ? (parsearMonto(item.precio) * 0.18).toFixed(2)
          : "0.00",
        montoISR: "0.00",
      };
    }

    // Campos comunes para todos los tipos (PascalCase según ejemplo oficial)
    return {
      ...itemCompleto,
      Nombre: stringVacioANull(item.nombre),
      IndicadorBienoServicio: item.indicadorBienoServicio || "1", // 1=Bien, 2=Servicio
      Descripcion: item.descripcion || null,
      Cantidad: item.cantidad || "1.00",
      UnidadMedida: item.unidadMedida || "43", // 43 = Unidad
      PrecioUnitario: parsearMonto(item.precio).toFixed(2),
      Monto: parsearMonto(item.precio).toFixed(2),
    };
  });

  // 🔍 Debug: Verificar suma individual de items vs totales calculados
  let sumaItemsGravados = detallesItems
    .filter((item) => item.IndicadorFacturacion === "1")
    .reduce((suma, item) => suma + parseFloat(item.Monto), 0)
    .toFixed(2);

  let sumaItemsExentos = detallesItems
    .filter((item) => item.IndicadorFacturacion === "4")
    .reduce((suma, item) => suma + parseFloat(item.Monto), 0)
    .toFixed(2);

  // 🔧 Para tipo 45: Ajustar montos de items si hay diferencia con total declarado
  if (facturaAdaptada.tipo === "45") {
    const totalDeclarado = parseFloat(montoTotal);
    const detalleCalculado = parseFloat(sumaItemsGravados);
    const diferencia = Math.abs(totalDeclarado - detalleCalculado);

    // Si hay diferencia mínima, ajustar los montos de los items proporcionalmente
    if (diferencia <= 1.0 && diferencia > 0) {
      const factorAjuste = totalDeclarado / detalleCalculado;

      // console.log(`🔧 Ajustando montos de items para tipo 45:`, {
      //   totalDeclarado: totalDeclarado,
      //   detalleCalculado: detalleCalculado,
      //   diferencia: diferencia.toFixed(2),
      //   factorAjuste: factorAjuste.toFixed(4),
      // });

      // Ajustar cada item gravado proporcionalmente
      detallesItems.forEach((item) => {
        if (item.IndicadorFacturacion === "1") {
          const montoOriginal = parseFloat(item.Monto);
          const montoAjustado = (montoOriginal * factorAjuste).toFixed(2);
          item.Monto = montoAjustado;
          item.PrecioUnitario = montoAjustado; // También ajustar precio unitario

          // console.log(`  Item ajustado: ${montoOriginal} → ${montoAjustado}`);
        }
      });

      // Recalcular sumas después del ajuste
      sumaItemsGravados = detallesItems
        .filter((item) => item.IndicadorFacturacion === "1")
        .reduce((suma, item) => suma + parseFloat(item.Monto), 0)
        .toFixed(2);
    }
  }

  // 💸 AJUSTAR ITEMS PROPORCIONALMENTE POR DESCUENTOS
  if (totalDescuentos > 0) {
    console.log("💸 Ajustando items por descuentos aplicados...");

    // Calcular la suma total de los items antes del ajuste
    const sumaItemsAntes = detallesItems.reduce(
      (suma, item) => suma + parseFloat(item.Monto),
      0
    );

    // Calcular factor de ajuste por descuento
    const factorAjustePorDescuento = montoTotalConDescuentos / sumaItemsAntes;

    console.log(
      `💸 Factor de ajuste por descuento: ${factorAjustePorDescuento.toFixed(
        4
      )}`
    );
    console.log(`💸 Suma items antes: ${sumaItemsAntes.toFixed(2)}`);
    console.log(
      `💸 Total con descuentos: ${montoTotalConDescuentos.toFixed(2)}`
    );

    // Ajustar cada item proporcionalmente
    detallesItems.forEach((item, index) => {
      const montoOriginal = parseFloat(item.Monto);
      const montoAjustado = (montoOriginal * factorAjustePorDescuento).toFixed(
        2
      );
      item.Monto = montoAjustado;
      item.PrecioUnitario = montoAjustado; // También ajustar precio unitario

      console.log(
        `   Item ${index + 1}: ${montoOriginal.toFixed(2)} → ${montoAjustado}`
      );
    });

    // 🔧 AJUSTE FINAL: Corregir diferencias de redondeo
    const sumaItemsAjustados = detallesItems.reduce(
      (suma, item) => suma + parseFloat(item.Monto),
      0
    );
    const diferenciaPorRedondeo = montoTotalConDescuentos - sumaItemsAjustados;

    if (Math.abs(diferenciaPorRedondeo) > 0.001) {
      // Ajustar el último item para que la suma sea exacta
      const ultimoItem = detallesItems[detallesItems.length - 1];
      const montoCorregido = (
        parseFloat(ultimoItem.Monto) + diferenciaPorRedondeo
      ).toFixed(2);
      ultimoItem.Monto = montoCorregido;
      ultimoItem.PrecioUnitario = montoCorregido;

      console.log(
        `🔧 Ajuste de redondeo en último item: ${diferenciaPorRedondeo.toFixed(
          4
        )}`
      );
      console.log(`   Último item ajustado: ${montoCorregido}`);
    }

    // Recalcular sumas después del ajuste por descuentos
    sumaItemsGravados = detallesItems
      .filter((item) => item.IndicadorFacturacion === "1")
      .reduce((suma, item) => suma + parseFloat(item.Monto), 0)
      .toFixed(2);

    sumaItemsExentos = detallesItems
      .filter((item) => item.IndicadorFacturacion === "4")
      .reduce((suma, item) => suma + parseFloat(item.Monto), 0)
      .toFixed(2);

    const sumaItemsDespues = detallesItems.reduce(
      (suma, item) => suma + parseFloat(item.Monto),
      0
    );

    console.log(`💸 Suma items después: ${sumaItemsDespues.toFixed(2)}`);
    console.log(
      `💸 Diferencia final: ${Math.abs(
        sumaItemsDespues - montoTotalConDescuentos
      ).toFixed(4)}`
    );
  }

  // console.log(`🔍 Verificación detalle vs totales:`, {
  //   tipoComprobante: facturaAdaptada.tipo,
  //   itemsGravadosDetalle: sumaItemsGravados,
  //   montoGravadoCalculado: montoGravadoCalculado,
  //   diferenciaGravado: (
  //     parseFloat(sumaItemsGravados) - parseFloat(montoGravadoCalculado)
  //   ).toFixed(2),
  //   itemsExentosDetalle: sumaItemsExentos,
  //   montoExentoCalculado: montoExentoCalculado,
  //   diferenciaExento: (
  //     parseFloat(sumaItemsExentos) - parseFloat(montoExentoCalculado)
  //   ).toFixed(2),
  // });

  // Formatear fecha (DD-MM-YYYY)
  const formatearFecha = (fecha) => {
    if (!fecha) return null;
    // Si viene en formato DD-MM-YYYY, lo mantenemos
    if (fecha.match(/^\d{2}-\d{2}-\d{4}$/)) {
      return fecha;
    }
    // Si viene en otro formato, lo convertimos
    const date = new Date(fecha);
    return `${date.getDate().toString().padStart(2, "0")}-${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}-${date.getFullYear()}`;
  };

  // Estructura completa para TheFactoryHKA - CORREGIDA según ejemplo oficial
  const documentoCompleto = {
    Token: token,
    DocumentoElectronico: {
      Encabezado: {
        IdentificacionDocumento: (() => {
          const baseIdDoc = {
            TipoDocumento: facturaAdaptada.tipo,
            NCF: facturaAdaptada.ncf,
            FechaVencimientoSecuencia: esFechaVencimientoObligatoria(
              facturaAdaptada.tipo
            )
              ? fechaVencimientoFormateada
              : null,
          };

          // Configuración específica por tipo de comprobante
          if (facturaAdaptada.tipo === "31" || facturaAdaptada.tipo === "32") {
            // Tipos 31, 32: Facturas de Crédito Fiscal y Consumo - incluyen indicadorEnvioDiferido
            return {
              ...baseIdDoc,
              IndicadorMontoGravado:
                parseFloat(montoGravadoCalculado) > 0 ? "1" : "0",
              IndicadorEnvioDiferido: "1",
              TipoIngresos: "01",
              TipoPago: "1",
              TablaFormasPago: [
                {
                  Forma: "1",
                  Monto: montoTotalConDescuentos.toFixed(2),
                },
              ],
            };
          } else if (facturaAdaptada.tipo === "33") {
            // Tipo 33: Nota de Débito - SÍ incluir FechaVencimientoSecuencia (requerido por TheFactoryHKA)
            return {
              TipoDocumento: facturaAdaptada.tipo,
              NCF: facturaAdaptada.ncf,
              FechaVencimientoSecuencia: fechaVencimientoFormateada, // ✅ OBLIGATORIO para tipo 33
              IndicadorMontoGravado:
                parseFloat(montoGravadoCalculado) > 0 ? "1" : "0",
              TipoIngresos: "03", // ESPECÍFICO para Nota de Débito (OBLIGATORIO)
              TipoPago: "1",
              TablaFormasPago: [
                {
                  Forma: "1",
                  Monto: montoTotalConDescuentos.toFixed(2),
                },
              ],
            };
          } else if (facturaAdaptada.tipo === "34") {
            // Tipo 34: Nota de Crédito - estructura especial SIN fechaVencimiento ni indicadorEnvioDiferido
            return {
              TipoDocumento: facturaAdaptada.tipo,
              NCF: facturaAdaptada.ncf,
              // NO incluir FechaVencimientoSecuencia para tipo 34
              IndicadorMontoGravado:
                parseFloat(montoGravadoCalculado) > 0 ? "1" : "0",
              IndicadorNotaCredito: "0", // OBLIGATORIO para tipo 34
              TipoIngresos: "01",
              TipoPago: "1",
            };
          } else if (facturaAdaptada.tipo === "41") {
            // Tipo 41: Compras - incluyen indicadorMontoGravado pero NO indicadorEnvioDiferido
            return {
              ...baseIdDoc,
              IndicadorMontoGravado:
                parseFloat(montoGravadoCalculado) > 0 ? "1" : "0",
              TipoPago: "1",
              TablaFormasPago: [
                {
                  Forma: "1",
                  Monto: montoTotalConDescuentos.toFixed(2),
                },
              ],
            };
          } else if (facturaAdaptada.tipo === "43") {
            // Tipo 43: Gastos Menores - estructura muy simple, solo campos básicos
            return {
              ...baseIdDoc,
            };
          } else if (facturaAdaptada.tipo === "45") {
            // Tipo 45: Gubernamental - incluye indicadorMontoGravado y tipoIngresos pero NO tablaFormasPago
            return {
              ...baseIdDoc,
              IndicadorMontoGravado:
                parseFloat(montoGravadoCalculado) > 0 ? "1" : "0",
              TipoIngresos: "01",
              TipoPago: "1",
            };
          } else if (
            facturaAdaptada.tipo === "44" ||
            facturaAdaptada.tipo === "46" ||
            facturaAdaptada.tipo === "47"
          ) {
            // Tipos 44, 46, 47: Regímenes especiales - NO incluyen indicadorMontoGravado ni indicadorEnvioDiferido
            return {
              ...baseIdDoc,
              TipoIngresos: "01",
              TipoPago: "1",
              TablaFormasPago: [
                {
                  Forma: "1",
                  Monto: montoTotalConDescuentos.toFixed(2),
                },
              ],
            };
          }

          // Fallback por defecto
          return {
            ...baseIdDoc,
            TipoPago: "1",
            TablaFormasPago: [
              {
                Forma: "1",
                Monto: montoTotalConDescuentos.toFixed(2),
              },
            ],
          };
        })(),
        Emisor: (() => {
          const telefonosRaw = emisor.telefono || [];
          const arr = Array.isArray(telefonosRaw) ? telefonosRaw : [telefonosRaw];
          const tablatelefono = arr
            .map((t) => formatearTelefonoDGII(t))
            .filter((t) => t != null);
          const baseEmisor = {
            RNC: emisor.rnc,
            RazonSocial: stringVacioANull(emisor.razonSocial),
            Direccion: stringVacioANull(emisor.direccion),
            Municipio: emisor.municipio || null,
            Provincia: emisor.provincia || null,
            TablaTelefono: tablatelefono,
            FechaEmision: formatearFecha(facturaAdaptada.fecha),
          };

          // Para tipos 31, 32, 33, 34: incluir campos adicionales del emisor
          if (
            facturaAdaptada.tipo === "31" ||
            facturaAdaptada.tipo === "32" ||
            facturaAdaptada.tipo === "33" ||
            facturaAdaptada.tipo === "34"
          ) {
            return {
              ...baseEmisor,
              nombreComercial: stringVacioANull(emisor.razonSocial),
              correo: stringVacioANull(emisor.correo),
              webSite: emisor.webSite || null,
              codigoVendedor: stringVacioANullLimit(
                facturaAdaptada.id,
                MAX_INTERNO_LENGTH
              ),
              numeroFacturaInterna: stringVacioANullLimit(
                facturaAdaptada.id,
                MAX_INTERNO_LENGTH
              ),
              numeroPedidoInterno: stringVacioANullLimit(
                facturaAdaptada.id,
                MAX_INTERNO_LENGTH
              ),
              zonaVenta: "PRINCIPAL",
            };
          }

          // Para otros tipos (41, 43, etc.): estructura más simple
          return baseEmisor;
        })(),
        // Comprador: Tipo 43 NO incluye comprador según estructura oficial
        ...(facturaAdaptada.tipo !== "43" && {
          comprador: (() => {
            const baseComprador = {
              rnc: facturaAdaptada.tipo === "32" ? null : comprador.rnc, // 🔧 Para tipo 32: null (consumidor final)
              razonSocial: stringVacioANull(comprador.nombre),
              correo: stringVacioANull(comprador.correo),
              direccion: stringVacioANull(comprador.direccion),
              municipio: comprador.municipio || null,
              provincia: comprador.provincia || null,
            };

            // Para tipos 31, 32, 33, 34: incluir campos adicionales del comprador
            if (
              facturaAdaptada.tipo === "31" ||
              facturaAdaptada.tipo === "32" ||
              facturaAdaptada.tipo === "33" ||
              facturaAdaptada.tipo === "34"
            ) {
              return {
                ...baseComprador,
                contacto: stringVacioANull(comprador.nombre),
                envioMail: stringVacioANull(comprador.correo) ? "SI" : "NO",
                fechaEntrega: comprador.fechaEntrega || null,
                fechaOrden: comprador.fechaOrden || null,
                numeroOrden: comprador.numeroOrden || null,
                codigoInterno:
                  comprador.codigoInterno ||
                  (facturaAdaptada.tipo === "32" ? null : comprador.rnc), // 🔧 Para tipo 32: null
              };
            }

            // Para otros tipos: estructura más simple
            return baseComprador;
          })(),
        }),
        // informacionesAdicionales solo para tipos 31, 32, 33, 34
        ...(facturaAdaptada.tipo === "31" ||
        facturaAdaptada.tipo === "32" ||
        facturaAdaptada.tipo === "33" ||
        facturaAdaptada.tipo === "34"
          ? {
              informacionesAdicionales: {
                numeroContenedor: facturaAdaptada.numeroContenedor || null,
                numeroReferencia: stringVacioANullLimit(
                  facturaAdaptada.id,
                  MAX_INTERNO_LENGTH
                ),
              },
            }
          : {}),
        Totales: (() => {
          // Estructura según ejemplo oficial de TheFactoryHKA (camelCase)
          const baseTotales = {
            montoGravadoTotal:
              parseFloat(montoGravadoConDescuentos) > 0
                ? montoGravadoConDescuentos.toFixed(2)
                : null,
            montoGravadoI1:
              parseFloat(montoGravadoConDescuentos) > 0
                ? montoGravadoConDescuentos.toFixed(2)
                : null,
            itbiS1: parseFloat(montoGravadoConDescuentos) > 0 ? "18" : null,
            totalITBIS:
              parseFloat(montoGravadoConDescuentos) > 0
                ? (parseFloat(montoGravadoConDescuentos) * 0.18).toFixed(2)
                : null,
            totalITBIS1:
              parseFloat(montoGravadoConDescuentos) > 0
                ? (parseFloat(montoGravadoConDescuentos) * 0.18).toFixed(2)
                : null,
            montoTotal: montoTotalConDescuentos.toFixed(2),
          };

          // Para tipos 31, 32, 33, 34: Incluir montoExento (según ejemplo oficial)
          if (
            facturaAdaptada.tipo === "31" ||
            facturaAdaptada.tipo === "32" ||
            facturaAdaptada.tipo === "33" ||
            facturaAdaptada.tipo === "34"
          ) {
            return {
              ...baseTotales,
              montoExento:
                parseFloat(montoExentoConDescuentos) > 0
                  ? montoExentoConDescuentos.toFixed(2)
                  : null,
            };
          }

          // Para tipo 43: Gastos Menores - estructura muy simple
          if (facturaAdaptada.tipo === "43") {
            return {
              montoExento: montoTotalConDescuentos.toFixed(2), // Para tipo 43, todo es monto exento
              montoTotal: montoTotalConDescuentos.toFixed(2),
            };
          }

          // Para tipo 44: Régimen especial - NO incluir campos de retención
          if (facturaAdaptada.tipo === "44") {
            return {
              ...baseTotales,
              montoExento:
                parseFloat(montoExentoConDescuentos) > 0
                  ? montoExentoConDescuentos.toFixed(2)
                  : null,
              valorPagar: montoTotalConDescuentos.toFixed(2),
            };
          }

          // Para tipo 45: Gubernamental - incluir campos ITBIS pero NO retención
          if (facturaAdaptada.tipo === "45") {
            // Después del ajuste de items, usar directamente la suma del detalle
            const montoGravadoFinal = parseFloat(sumaItemsGravados);
            const itbisCalculado = montoGravadoFinal * 0.18;
            const montoTotalConImpuestos =
              montoGravadoFinal + itbisCalculado + parseFloat(sumaItemsExentos);

            // console.log(`✅ Cálculo final para tipo 45:`, {
            //   montoGravadoDetalle: sumaItemsGravados,
            //   itbisCalculado: itbisCalculado.toFixed(2),
            //   montoTotalConImpuestos: montoTotalConImpuestos.toFixed(2),
            // });

            // Estructura específica para tipo 45 con cálculos exactos (PascalCase)
            // NOTA: Solo incluir campos de ITBIS si hay montos gravados
            const totales45 = {
              MontoTotal: montoTotalConImpuestos.toFixed(2), // Total (sin impuestos para servicios exentos)
              ValorPagar: montoTotalConImpuestos.toFixed(2),
            };

            // Solo incluir campos de impuestos si HAY montos gravados
            if (montoGravadoFinal > 0) {
              totales45.MontoGravadoTotal = sumaItemsGravados;
              totales45.ITBIS1 = "18";
              totales45.TotalITBIS = itbisCalculado.toFixed(2);
              totales45.TotalITBIS1 = itbisCalculado.toFixed(2);
            }

            // Solo incluir montoExento si hay montos exentos (> 0)
            if (parseFloat(sumaItemsExentos) > 0) {
              totales45.MontoExento = sumaItemsExentos;
            }

            return totales45;
          }

          // Para tipos 41, 46, 47: Incluir campos de retención
          return {
            ...baseTotales,
            montoExento:
              parseFloat(montoExentoConDescuentos) > 0
                ? montoExentoConDescuentos.toFixed(2)
                : null,
            valorPagar: montoTotalConDescuentos.toFixed(2),
            totalITBISRetenido:
              parseFloat(montoGravadoConDescuentos) > 0
                ? (parseFloat(montoGravadoConDescuentos) * 0.18).toFixed(2)
                : "0.00",
            totalISRRetencion: "0.00",
          };
        })(),
      },
      DetallesItems: detallesItems,
      // Agregar sección de descuentos/recargos (TheFactory espera array, no objeto con descuentoORecargo)
      ...(descuentosArray.length > 0 && {
        descuentosORecargos: descuentosArray,
      }),
      // Para tipo 45: Agregar sección vacía si no hay descuentos
      ...(facturaAdaptada.tipo === "45" &&
        descuentosArray.length === 0 && {
          descuentosORecargos: [],
        }),
      // Para tipos 33 y 34: Agregar InformacionReferencia OBLIGATORIA (con validación)
      ...((facturaAdaptada.tipo === "33" || facturaAdaptada.tipo === "34") &&
        (() => {
          // Validar que se proporcionen los campos obligatorios para tipos 33 y 34
          if (!facturaAdaptada.ncfModificado) {
            throw new Error(
              `❌ Tipo ${facturaAdaptada.tipo} requiere "ncfModificado": NCF de la factura original que se está modificando`
            );
          }
          if (!facturaAdaptada.fechaNCFModificado) {
            throw new Error(
              `❌ Tipo ${facturaAdaptada.tipo} requiere "fechaNCFModificado": Fecha de la factura original`
            );
          }
          if (!facturaAdaptada.codigoModificacion) {
            throw new Error(
              `❌ Tipo ${facturaAdaptada.tipo} requiere "codigoModificacion": Código que indica el tipo de modificación (1,2,3,4)`
            );
          }
          if (!facturaAdaptada.razonModificacion) {
            throw new Error(
              `❌ Tipo ${facturaAdaptada.tipo} requiere "razonModificacion": Razón descriptiva de la modificación`
            );
          }

          return {
            InformacionReferencia: {
              NCFModificado: facturaAdaptada.ncfModificado,
              FechaNCFModificado: formatearFecha(
                facturaAdaptada.fechaNCFModificado
              ),
              CodigoModificacion: facturaAdaptada.codigoModificacion,
              RazonModificacion: facturaAdaptada.razonModificacion,
            },
          };
        })()),
    },
  };

  return documentoCompleto;
};

// Función auxiliar para enviar factura original a soporte cuando hay errores
const enviarFacturaASoporte = async (facturaOriginal, errorInfo) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #003366 0%, #0056b3 100%); padding: 30px; text-align: center; color: white;">
          <h1>⚠️ Error en Envío de Factura Electrónica</h1>
          <p>Lab Contreras - Sistema de Gestión</p>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #dc3545;">Información del Error</h2>
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>Fecha y Hora:</strong> ${new Date().toLocaleString(
              "es-DO",
              { timeZone: "America/Santo_Domingo" }
            )}</p>
            <p><strong>Tipo de Error:</strong> ${
              errorInfo.tipo || "Error desconocido"
            }</p>
            <p><strong>Mensaje:</strong> ${errorInfo.mensaje || "N/A"}</p>
            ${
              errorInfo.codigo
                ? `<p><strong>Código de Error:</strong> ${errorInfo.codigo}</p>`
                : ""
            }
            ${
              errorInfo.statusCode
                ? `<p><strong>Status HTTP:</strong> ${errorInfo.statusCode}</p>`
                : ""
            }
          </div>
          
          <h2 style="color: #333; margin-top: 30px;">Factura Original (JSON)</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; overflow-x: auto;">
            <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace; font-size: 12px;">${JSON.stringify(
              facturaOriginal,
              null,
              2
            )}</pre>
          </div>
          
          ${
            errorInfo.respuestaTheFactory
              ? `
          <h2 style="color: #333; margin-top: 30px;">Respuesta de TheFactory</h2>
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace; font-size: 12px;">${JSON.stringify(
              errorInfo.respuestaTheFactory,
              null,
              2
            )}</pre>
          </div>
          `
              : ""
          }
          
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 30px;">
            <p style="margin: 0; font-size: 12px; color: #6c757d;">
              Este email fue generado automáticamente por el sistema cuando se detectó un error en el envío de factura electrónica a TheFactoryHKA.
            </p>
          </div>
        </div>
        <div style="padding: 20px; text-align: center; background-color: #003366; color: white;">
          <p style="margin: 0; font-size: 12px;">© Lab Contreras - Sistema de Gestión</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: "soporte@contrerasrobledo.com.do",
      subject: `Error en Envío de Factura Electrónica - ${
        facturaOriginal.factura?.ncf || "NCF No Disponible"
      }`,
      htmlContent,
      textContent: `Error en Envío de Factura Electrónica

      Fecha: ${new Date().toLocaleString("es-DO", {
        timeZone: "America/Santo_Domingo",
      })}
      Tipo de Error: ${errorInfo.tipo || "Error desconocido"}
      Mensaje: ${errorInfo.mensaje || "N/A"}
      Código de Error: ${errorInfo.codigo || "N/A"}
      Status HTTP: ${errorInfo.statusCode || "N/A"}

      Factura Original:
      ${JSON.stringify(facturaOriginal, null, 2)}

      ${
        errorInfo.respuestaTheFactory
          ? `Respuesta de TheFactory:\n${JSON.stringify(
              errorInfo.respuestaTheFactory,
              null,
              2
            )}`
          : ""
      }`,
    });

    console.log("✅ Email de error enviado a soporte@contrerasrobledo.com.do");
  } catch (emailError) {
    console.error("❌ Error al enviar email a soporte:", emailError);
    // No lanzamos el error para no interrumpir el flujo principal
  }
};

/**
 * Lógica de negocio para enviar factura a TheFactoryHKA.
 * Devuelve { status, data } para uso directo con NextResponse.
 * @param {Object} body - Body de la petición (emisor, comprador, factura, items, etc.)
 * @returns {Promise<{ status: number, data: Object }>}
 */
export async function enviarFacturaElectronicaLogic(body) {
  try {
    console.log("Datos recibidos:", JSON.stringify(body, null, 2));

    // RNC del emisor: siempre se toma de emisor.rnc
    const rnc =
      body.emisor?.rnc != null && String(body.emisor.rnc).trim() !== ""
        ? String(body.emisor.rnc).trim()
        : null;
    if (!rnc) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "RNC del emisor es requerido",
          details: "Debe proporcionar emisor.rnc en el body de la petición",
        },
      };
    }

    // Obtener token de autenticación
    const token = await obtenerTokenTheFactory(rnc);

    // Transformar el JSON simplificado al formato completo
    const facturaCompleta = transformarFacturaParaTheFactory(body, token, rnc);

    console.log(
      "Factura transformada:",
      JSON.stringify(facturaCompleta, null, 2)
    );

    // Enviar a TheFactoryHKA (Token y DocumentoElectronico en la raíz del body)
    const response = await axios.post(THEFACTORY_ENVIAR_URL, facturaCompleta, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 60000,
    });

    if (!response.data.procesado || response.data.codigo !== 0) {
      console.error("❌ Error de TheFactoryHKA:", response.data.mensaje);
      const errorMessages = {
        108: "NCF ya fue presentado anteriormente",
        109: "NCF vencido o inválido",
        110: "RNC no autorizado para este tipo de comprobante",
        111: "Datos de la factura inválidos",
      };
      const mensajeError =
        errorMessages[response.data.codigo] ||
        response.data.mensaje ||
        "Error desconocido";

      await enviarFacturaASoporte(body, {
        tipo: "Error de negocio de TheFactoryHKA",
        mensaje: mensajeError,
        codigo: response.data.codigo,
        respuestaTheFactory: response.data,
      });

      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: `Error de TheFactoryHKA: ${mensajeError}`,
          details: {
            codigo: response.data.codigo,
            mensajeOriginal: response.data.mensaje,
            procesado: response.data.procesado,
            codigoSeguridad: response.data.codigoSeguridad || null,
            respuestaCompleta: response.data,
          },
        },
      };
    }

    const ncfGenerado = body.factura.ncf;
    const estatusConsulta = await consultarEstatusInmediato(ncfGenerado, rnc);
    const urlQR = generarUrlQR(response.data, body);

    // Generar QR (imagen base64) con los datos de la factura aprobada
    let qrCode = null;
    const qrBody = {
      rnc: body.emisor?.rnc,
      rncComprador: body.comprador?.rnc,
      ncf: body.factura?.ncf,
      codigo: response.data.codigoSeguridad,
      fecha: response.data.fechaEmision || body.factura?.fecha,
      fechaFirma: response.data.fechaFirma || response.data.fechaEmision,
      monto: body.factura?.total,
      tipo: body.factura?.tipo,
      ambiente:
        String(
          body.ambiente || process.env.DGII_AMBIENTE || ""
        ).toLowerCase() === "desarrollo"
          ? "desarrollo"
          : "produccion",
      formato: "png",
      tamaño: 300,
    };
    const qrResult = await generarCodigoQRLogic(qrBody);
    if (qrResult.status === httpStatus.OK && qrResult.data?.data?.qrCode) {
      qrCode = qrResult.data.data.qrCode;
    } else if (urlQR) {
      // Fallback: generar QR desde la URL ya construida
      const qrFallback = await generarCodigoQRLogic({
        url: urlQR,
        formato: "png",
        tamaño: 300,
      });
      if (qrFallback.status === httpStatus.OK && qrFallback.data?.data?.qrCode) {
        qrCode = qrFallback.data.data.qrCode;
      }
    }

    return {
      status: httpStatus.OK,
      data: {
        status: "success",
        message: "Factura electrónica enviada exitosamente",
        data: {
          facturaOriginal: body,
          respuestaTheFactory: response.data,
          ncfGenerado,
          codigoSeguridad: response.data.codigoSeguridad,
          fechaFirma: response.data.fechaFirma,
          xmlBase64: response.data.xmlBase64,
          urlQR,
          qrCode,
          estatusInicial: estatusConsulta,
        },
      },
    };
  } catch (error) {
    console.error("Error al enviar factura electrónica:", error);

    if (
      error.message.includes("Error de autenticación") ||
      error.message.includes("token") ||
      error.message.includes("expirado") ||
      error.message.includes("expired") ||
      (error.response &&
        (error.response.status === 401 || error.response.status === 403))
    ) {
      console.log("🔄 Error de autenticación detectado, limpiando cache...");
      limpiarCacheToken();
      await enviarFacturaASoporte(body, {
        tipo: "Error de autenticación",
        mensaje: "Token expirado o inválido",
        statusCode: error.response?.status || 401,
      });
      return {
        status: httpStatus.UNAUTHORIZED,
        data: {
          status: "error",
          message: "Token expirado. Vuelve a intentar la operación",
          details:
            "El token de autenticación ha expirado. El sistema lo renovará automáticamente en el próximo intento.",
          codigo: "TOKEN_EXPIRADO",
          sugerencia: "Reintente la operación en unos segundos",
        },
      };
    }

    if (error.response) {
      console.log("respuesta del TheFactoryHKA:", error.response.data);
      console.error("❌ Respuesta de error de TheFactoryHKA:", error.response.status);
      let detallesValidacion = error.response.data;
      if (error.response.data?.errors) {
        detallesValidacion = {
          ...error.response.data,
          erroresDetallados: error.response.data.errors,
        };
      }
      await enviarFacturaASoporte(body, {
        tipo: "Error de respuesta HTTP de TheFactoryHKA",
        mensaje: error.message || "Error en el envío a TheFactoryHKA",
        statusCode: error.response.status,
        respuestaTheFactory: error.response.data,
      });
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "Error en el envío a TheFactoryHKA",
          details: detallesValidacion,
          statusCode: error.response.status,
        },
      };
    }

    if (error.code === "ECONNABORTED") {
      console.warn("⏰ TIMEOUT TheFactoryHKA");
      await enviarFacturaASoporte(body, {
        tipo: "Timeout en TheFactoryHKA",
        mensaje: "TheFactoryHKA tardó más de 60 segundos en responder",
        ncf: body.factura?.ncf || null,
      });
      return {
        status: httpStatus.REQUEST_TIMEOUT,
        data: {
          status: "error",
          message: "Timeout: TheFactoryHKA tardó más de 60 segundos en responder",
          details:
            "El servicio está experimentando lentitud. Consulte el estatus del documento.",
          ncf: body.factura?.ncf || null,
          sugerencia: "Usar el endpoint /consultar-estatus para verificar",
        },
      };
    }

    if (error.message.includes("Faltan datos obligatorios")) {
      await enviarFacturaASoporte(body, {
        tipo: "Error de validación",
        mensaje: error.message,
      });
      return {
        status: httpStatus.BAD_REQUEST,
        data: { status: "error", message: error.message },
      };
    }

    if (error.message.includes("Timeout al conectar con el servicio de autenticación")) {
      await enviarFacturaASoporte(body, {
        tipo: "Timeout en autenticación",
        mensaje: "Timeout al conectar con TheFactoryHKA",
      });
      return {
        status: httpStatus.REQUEST_TIMEOUT,
        data: {
          status: "error",
          message: "Timeout en la autenticación con TheFactoryHKA",
        },
      };
    }

    if (
      error.message.includes("SERVIDOR_CAIDO") ||
      error.message.includes("SERVIDOR_NO_ENCONTRADO") ||
      error.message.includes("SERVIDOR_RESETEO")
    ) {
      console.error("🚨 SERVIDOR DE THEFACTORY CAÍDO O INACCESIBLE");
      await enviarFacturaASoporte(body, {
        tipo: "Servidor de TheFactoryHKA caído o inaccesible",
        mensaje: error.message,
      });
      return {
        status: httpStatus.SERVICE_UNAVAILABLE,
        data: {
          status: "error",
          message: "El servidor de TheFactoryHKA está caído o inaccesible",
          details: error.message,
          sugerencia:
            "Verifica el estado del servidor o contacta con soporte",
        },
      };
    }

    await enviarFacturaASoporte(body, {
      tipo: "Error interno del servidor",
      mensaje: error.message || "Error desconocido al procesar la factura electrónica",
    });
    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      data: {
        status: "error",
        message: "Error interno del servidor al procesar la factura electrónica",
        details: error.message,
      },
    };
  }
}

// Controlador Express (req, res) - mantiene compatibilidad con runWithNext
const enviarFacturaElectronica = async (req, res) => {
  const result = await enviarFacturaElectronicaLogic(req.body);
  return res.status(result.status).json(result.data);
};

/**
 * Lógica para consultar el estatus de un documento desde Next.js (sin Express).
 * Devuelve { status, data } para uso directo con NextResponse.
 * @param {{ ncf: string, rnc: string, reintentar?: boolean }} body
 * @returns {Promise<{ status: number, data: object }>}
 */
export async function consultarEstatusDocumentoLogic(body) {
  try {
    const { ncf, rnc, reintentar } = body ?? {};

    // Validar que se proporcione el NCF
    if (!ncf) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "El campo NCF es requerido",
          details: "Debe proporcionar el NCF del documento a consultar",
        },
      };
    }

    // Validar que se proporcione el RNC del emisor
    if (!rnc) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "El campo RNC es requerido",
          details:
            "Debe proporcionar el RNC del emisor para consultar el estatus",
        },
      };
    }

    // Si se solicita reintentar, esperar 2 segundos antes de consultar
    if (reintentar) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Consultar estatus en TheFactoryHKA
    const estatusConsulta = await consultarEstatusInmediato(ncf, rnc);

    if (estatusConsulta.consultaExitosa) {
      // Interpretar el estado devuelto por TheFactoryHKA
      const estadoOriginal =
        estatusConsulta.datosEstatus.estado ||
        estatusConsulta.datosEstatus.status ||
        estatusConsulta.datosEstatus.mensaje ||
        "DESCONOCIDO";

      // console.log(`📝 Estado original extraído: "${estadoOriginal}"`);
      // console.log('🔍 datosEstatus completos:');
      // console.log(JSON.stringify(estatusConsulta.datosEstatus, null, 2));

      const estadoNormalizado = normalizarEstadoFactura(
        estadoOriginal,
        estatusConsulta.datosEstatus
      );

      // console.log(`✅ Estado normalizado: "${estadoNormalizado}"`);
      // console.log(`📤 Enviando respuesta exitosa al cliente`);

      // Agregar información adicional si el documento no fue encontrado
      let mensajeAdicional = null;
      if (
        estadoNormalizado === "NO_ENCONTRADO" ||
        estatusConsulta.datosEstatus.codigo === 120
      ) {
        // console.log(
        //   '⚠️ ADVERTENCIA: Documento no encontrado en TheFactoryHKA (código 120)',
        // );
        mensajeAdicional =
          "El documento no se encuentra en la base de datos de TheFactoryHKA. Posibles causas: " +
          "1) El documento nunca fue enviado, " +
          "2) Diferencia de ambiente (Demo vs Producción), " +
          "3) RNC incorrecto en la consulta, " +
          "4) Delay en la sincronización de TheFactoryHKA.";
      }

      const respuestaFinal = {
        status: httpStatus.OK,
        data: {
          status: "success",
          message: "Consulta de estatus realizada exitosamente",
          data: {
            ncf: ncf,
            estado: estadoNormalizado,
            estadoOriginal: estadoOriginal,
            mensaje:
              estatusConsulta.datosEstatus.mensaje ||
              estatusConsulta.datosEstatus.description ||
              "Sin mensaje",
            fechaConsulta: estatusConsulta.timestamp,
            datosCompletos: estatusConsulta.datosEstatus,
            ...(mensajeAdicional && { advertencia: mensajeAdicional }),
          },
        },
      };

      return respuestaFinal;
    } else {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "No se pudo consultar el estatus del documento",
          details: estatusConsulta.error,
          data: {
            ncf: ncf,
            timestamp: estatusConsulta.timestamp,
          },
        },
      };
    }
  } catch (error) {
    console.error("❌ Error CRÍTICO en consulta de estatus:", error);
    console.error("📚 Stack trace:", error.stack);
    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      data: {
        status: "error",
        message: "Error interno del servidor al consultar estatus",
        details: error.message,
      },
    };
  }
}

// 🔍 Endpoint independiente para consultar estatus de documento (modo Express)
const consultarEstatusDocumento = async (req, res) => {
  const result = await consultarEstatusDocumentoLogic(req.body);
  return res.status(result.status).json(result.data);
};

// Endpoint para limpiar cache del token (útil para debugging)
const limpiarTokenCache = async (req, res) => {
  try {
    limpiarCacheToken();

    return res.status(httpStatus.OK).json({
      status: "success",
      message: "Cache del token limpiado exitosamente",
      details: "El próximo envío obtendrá un token nuevo",
    });
  } catch (error) {
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error al limpiar cache del token",
      details: error.message,
    });
  }
};

// 📧 Endpoint para enviar email de documento electrónico vía The Factory HKA
const enviarEmailFactura = async (req, res) => {
  // Importación lazy para evitar dependencia circular
  const { enviarEmailDocumento } = await import("@/app/api/thefactory-email");
  return await enviarEmailDocumento(req, res);
};

// Función para anular comprobantes fiscales
const anularComprobantes = async (req, res) => {
  try {
    console.log(
      "📋 Solicitud de anulación recibida:",
      JSON.stringify(req.body, null, 2)
    );

    const { rnc, anulaciones, fechaHoraAnulacion } = req.body;

    // ====== VALIDACIONES ======

    // 1. Validar campos requeridos
    if (!rnc) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: "El campo RNC es obligatorio",
      });
    }

    if (
      !anulaciones ||
      !Array.isArray(anulaciones) ||
      anulaciones.length === 0
    ) {
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message:
          "El campo anulaciones es obligatorio y debe ser un array con al menos una anulación",
      });
    }

    // 2. Validar tipos de documentos permitidos
    const tiposDocumentosValidos = [
      "31",
      "32",
      "33",
      "34",
      "41",
      "43",
      "44",
      "45",
      "46",
      "47",
    ];

    // 3. Validar formato de NCF (E + 2 dígitos + 8-10 dígitos de secuencia)
    // Acepta tanto NCF estándar (11 caracteres) como NCF extendido (13 caracteres)
    const ncfRegex = /^E\d{2}\d{8,10}$/;

    // 4. Validar cada anulación
    for (let i = 0; i < anulaciones.length; i++) {
      const anulacion = anulaciones[i];

      if (!anulacion.tipoDocumento) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${i + 1}: El campo tipoDocumento es obligatorio`,
        });
      }

      if (!tiposDocumentosValidos.includes(anulacion.tipoDocumento)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${
            i + 1
          }: Tipo de documento inválido. Debe ser uno de: ${tiposDocumentosValidos.join(
            ", "
          )}`,
        });
      }

      // 🔧 MEJORA: Soportar diferentes formatos de entrada
      // Opción 1: { ncf: "E310000000098" } - anular un solo comprobante
      // Opción 2: { ncfDesde: "E310000000098" } - anular un solo comprobante (sin ncfHasta)
      // Opción 3: { ncfDesde: "E310000000098", ncfHasta: "E310000000099" } - anular rango

      if (anulacion.ncf && !anulacion.ncfDesde) {
        // Si usa 'ncf', copiarlo a ncfDesde y ncfHasta
        anulacion.ncfDesde = anulacion.ncf;
        anulacion.ncfHasta = anulacion.ncf;
      } else if (anulacion.ncfDesde && !anulacion.ncfHasta) {
        // Si solo proporciona ncfDesde, asumir que es un solo comprobante
        anulacion.ncfHasta = anulacion.ncfDesde;
      }

      // Validar que al menos tengamos ncfDesde
      if (!anulacion.ncfDesde) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${
            i + 1
          }: Debe proporcionar 'ncf' o 'ncfDesde' (o ambos 'ncfDesde' y 'ncfHasta' para un rango)`,
        });
      }

      // Asegurar que ncfHasta existe
      if (!anulacion.ncfHasta) {
        anulacion.ncfHasta = anulacion.ncfDesde;
      }

      // Validar formato de NCF
      if (!ncfRegex.test(anulacion.ncfDesde)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${
            i + 1
          }: NCF Desde tiene formato inválido. Debe ser E + tipo (2 dígitos) + secuencia (8-10 dígitos). Ejemplos: E310000000098 o E310000000147`,
        });
      }

      if (!ncfRegex.test(anulacion.ncfHasta)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${
            i + 1
          }: NCF Hasta tiene formato inválido. Debe ser E + tipo (2 dígitos) + secuencia (8-10 dígitos). Ejemplos: E310000000099 o E310000000148`,
        });
      }

      // Validar que el tipo de documento coincida con el prefijo del NCF
      const tipoEnNCFDesde = anulacion.ncfDesde.substring(1, 3);
      const tipoEnNCFHasta = anulacion.ncfHasta.substring(1, 3);

      if (tipoEnNCFDesde !== anulacion.tipoDocumento) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${i + 1}: El tipo de documento (${
            anulacion.tipoDocumento
          }) no coincide con el prefijo del NCF Desde (${tipoEnNCFDesde})`,
        });
      }

      if (tipoEnNCFHasta !== anulacion.tipoDocumento) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${i + 1}: El tipo de documento (${
            anulacion.tipoDocumento
          }) no coincide con el prefijo del NCF Hasta (${tipoEnNCFHasta})`,
        });
      }

      // Validar que ncfHasta >= ncfDesde
      const secuenciaDesde = parseInt(anulacion.ncfDesde.substring(3), 10);
      const secuenciaHasta = parseInt(anulacion.ncfHasta.substring(3), 10);

      if (secuenciaHasta < secuenciaDesde) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: `Anulación ${
            i + 1
          }: NCF Hasta debe ser mayor o igual a NCF Desde`,
        });
      }
    }

    // ====== TRANSFORMACIÓN AL FORMATO DE THEFACTORY ======

    // Generar fecha/hora de anulación en formato DD-MM-YYYY HH:mm:ss
    let fechaFormateada;
    if (fechaHoraAnulacion) {
      // Si el usuario proporciona la fecha, validar formato
      const fechaRegex = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/;
      if (!fechaRegex.test(fechaHoraAnulacion)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          status: "error",
          message: "Formato de fecha inválido. Debe ser DD-MM-YYYY HH:mm:ss",
        });
      }
      fechaFormateada = fechaHoraAnulacion;
    } else {
      // Generar fecha/hora actual
      const ahora = new Date();
      const dia = String(ahora.getDate()).padStart(2, "0");
      const mes = String(ahora.getMonth() + 1).padStart(2, "0");
      const anio = ahora.getFullYear();
      const horas = String(ahora.getHours()).padStart(2, "0");
      const minutos = String(ahora.getMinutes()).padStart(2, "0");
      const segundos = String(ahora.getSeconds()).padStart(2, "0");
      fechaFormateada = `${dia}-${mes}-${anio} ${horas}:${minutos}:${segundos}`;
    }

    // Calcular cantidad total de NCFs a anular
    let cantidadTotal = 0;
    const detallesAnulacion = anulaciones.map((anulacion, index) => {
      const secuenciaDesde = parseInt(anulacion.ncfDesde.substring(3), 10);
      const secuenciaHasta = parseInt(anulacion.ncfHasta.substring(3), 10);
      const cantidad = secuenciaHasta - secuenciaDesde + 1;
      cantidadTotal += cantidad;

      return {
        NumeroLinea: String(index + 1),
        TipoDocumento: anulacion.tipoDocumento,
        TablaSecuenciasAnuladas: [
          {
            NCFDesde: anulacion.ncfDesde,
            NCFHasta: anulacion.ncfHasta,
          },
        ],
        Cantidad: String(cantidad).padStart(2, "0"),
      };
    });

    // Obtener token de autenticación
    console.log("🔑 Obteniendo token de autenticación...");
    const token = await obtenerTokenTheFactory(rnc);

    // Construir payload completo para TheFactoryHKA
    const payloadAnulacion = {
      token: token,
      Anulacion: {
        Encabezado: {
          RNC: rnc,
          Cantidad: String(cantidadTotal).padStart(2, "0"),
          FechaHoraAnulacioneNCF: fechaFormateada,
        },
        DetallesAnulacion: detallesAnulacion,
      },
    };

    console.log(
      "📤 Enviando anulación a TheFactoryHKA:",
      JSON.stringify(payloadAnulacion, null, 2)
    );

    // Enviar a TheFactoryHKA
    const response = await axios.post(
      THEFACTORY_ANULACION_URL,
      payloadAnulacion,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 segundos de timeout
      }
    );

    console.log(
      "📥 Respuesta de TheFactoryHKA:",
      JSON.stringify(response.data, null, 2)
    );

    // Verificar respuesta
    // TheFactory usa procesado:true y código 100 para éxito en anulaciones
    // (diferente a código 0 en otros endpoints)
    if (
      response.data.procesado === true ||
      response.data.codigo === 0 ||
      response.data.codigo === 100
    ) {
      // Éxito
      return res.status(httpStatus.OK).json({
        status: "success",
        message: "Secuencias anuladas exitosamente",
        data: {
          codigo: response.data.codigo,
          mensaje: response.data.mensaje,
          procesado: response.data.procesado,
          xmlBase64: response.data.xmlBase64, // XML firmado de la anulación
          cantidadAnulada: cantidadTotal,
          detalles: anulaciones.map((a, i) => ({
            tipoDocumento: a.tipoDocumento,
            ncfDesde: a.ncfDesde,
            ncfHasta: a.ncfHasta,
            cantidad: detallesAnulacion[i].Cantidad,
          })),
        },
      });
    } else {
      // Error de negocio de TheFactoryHKA
      return res.status(httpStatus.BAD_REQUEST).json({
        status: "error",
        message: `Error al anular: ${response.data.mensaje}`,
        details: {
          codigo: response.data.codigo,
          mensaje: response.data.mensaje,
          procesado: response.data.procesado,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error al anular comprobantes:", error);

    // Manejo de errores de axios
    if (error.response) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        status: "error",
        message: "Error en la respuesta de TheFactoryHKA",
        details: {
          status: error.response.status,
          data: error.response.data,
        },
      });
    }

    if (error.code === "ECONNABORTED") {
      return res.status(httpStatus.REQUEST_TIMEOUT).json({
        status: "error",
        message: "Timeout al conectar con TheFactoryHKA",
      });
    }

    // Error genérico
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error interno al procesar la anulación",
      details: error.message,
    });
  }
};

/**
 * Lógica para descargar archivo XML o PDF desde TheFactoryHKA (sin Express).
 * Devuelve { status, data } para uso directo con NextResponse.
 * @param {{ rnc: string, documento: string, extension: "xml"|"pdf" }} body
 * @returns {Promise<{ status: number, data: object }>}
 */
export async function descargarArchivoLogic(body) {
  try {
    const { rnc, documento, extension } = body ?? {};

    if (!rnc) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: 'El parámetro "rnc" es obligatorio',
        },
      };
    }

    if (!documento) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: 'El parámetro "documento" es obligatorio (número de e-NCF)',
        },
      };
    }

    if (!extension) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message:
            'El parámetro "extension" es obligatorio (valores permitidos: "xml" o "pdf")',
        },
      };
    }

    const extensionesPermitidas = ["xml", "pdf"];
    const ext = extension.toLowerCase();
    if (!extensionesPermitidas.includes(ext)) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: 'El parámetro "extension" debe ser "xml" o "pdf"',
        },
      };
    }

    const token = await obtenerTokenTheFactory(rnc);
    const descargaRequest = {
      token,
      rnc,
      documento,
      extension: ext,
    };

    const response = await axios.post(
      THEFACTORY_DESCARGA_URL,
      descargaRequest,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    if (
      (response.data.codigo === 0 || response.data.codigo === 130) &&
      response.data.procesado
    ) {
      return {
        status: httpStatus.OK,
        data: {
          status: "success",
          message: "Archivo descargado exitosamente",
          data: {
            archivo: response.data.archivo,
            extension: ext,
            documento,
            rnc,
            procesado: response.data.procesado,
            codigo: response.data.codigo,
            mensaje: response.data.mensaje,
          },
        },
      };
    }

    return {
      status: httpStatus.BAD_REQUEST,
      data: {
        status: "error",
        message: `Error al descargar archivo: ${response.data.mensaje}`,
        details: {
          codigo: response.data.codigo,
          mensaje: response.data.mensaje,
          procesado: response.data.procesado,
        },
      },
    };
  } catch (error) {
    console.error("❌ Error al descargar archivo:", error);

    if (error.response) {
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        data: {
          status: "error",
          message: "Error en la respuesta de TheFactoryHKA",
          details: {
            status: error.response.status,
            data: error.response.data,
          },
        },
      };
    }

    if (error.code === "ECONNABORTED") {
      return {
        status: httpStatus.REQUEST_TIMEOUT,
        data: {
          status: "error",
          message: "Timeout al conectar con TheFactoryHKA",
        },
      };
    }

    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      data: {
        status: "error",
        message: "Error interno al procesar la descarga",
        details: error.message,
      },
    };
  }
}

/**
 * @description Descarga archivo XML o PDF de un documento electrónico desde TheFactoryHKA
 * @route POST /comprobantes/descargar-archivo
 * @access Privado (requiere autenticación)
 */
const descargarArchivo = async (req, res) => {
  const result = await descargarArchivoLogic(req.body);
  return res.status(result.status).json(result.data);
};

// Endpoint para verificar el estado del servidor de TheFactoryHKA
const verificarServidorTheFactory = async (req, res) => {
  try {
    const { verificarEstadoTheFactory } = await import(
      "@/utils/verificarTheFactory"
    );
    const resultados = await verificarEstadoTheFactory();

    // Determinar código de estado HTTP según el resultado
    let statusCode = httpStatus.OK;
    if (resultados.estado === "SERVIDOR_CAIDO") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;
    } else if (resultados.estado === "AUTENTICACION_FALLIDA") {
      statusCode = httpStatus.UNAUTHORIZED;
    }

    return res.status(statusCode).json({
      status: resultados.estado === "FUNCIONANDO" ? "success" : "error",
      message: resultados.recomendacion,
      data: resultados,
    });
  } catch (error) {
    console.error("❌ Error al verificar servidor de TheFactoryHKA:", error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Error al verificar el estado del servidor",
      details: error.message,
    });
  }
};

export {
  createComprobante,
  getAllComprobantes,
  getComprobanteById,
  updateComprobante,
  updateComprobanteEstado,
  deleteComprobante,
  getComprobantesStats,
  consumirNumero,
  consumirNumeroPorRnc,
  enviarFacturaElectronica,
  consultarEstatusDocumento,
  generarUrlQR,
  generarCodigoQR,
  limpiarTokenCache,
  obtenerTokenTheFactory,
  enviarEmailFactura,
  anularComprobantes,
  descargarArchivo,
  verificarServidorTheFactory,
};
