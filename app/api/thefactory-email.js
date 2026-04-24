import axios from "axios";
import httpStatus from "http-status";
import { obtenerTokenTheFactory as obtenerTokenSistema } from "@/app/controllers/comprobantes";
import { resolveTheFactoryUrlsForUser } from "@/utils/theFactoryUrls";

/**
 * Obtiene un token de autenticación válido de TheFactoryHKA
 * Reutiliza la función existente del sistema principal
 * @param {string} rnc - RNC del emisor (de la data de la petición)
 * @param {string|null} userId - Usuario dueño (mismo ambiente The Factory que el resto de e-CF)
 * @returns {Promise<string>} Token de autenticación válido
 */
/** Token The Factory según ambiente de la empresa (`userId`). */
const obtenerTokenTheFactory = async (rnc, userId) => {
  try {
    console.log(
      "🔐 Obteniendo token para email (reutilizando sistema principal)..."
    );
    return await obtenerTokenSistema(rnc, { userId });
  } catch (error) {
    console.error("❌ Error al obtener token para email:", error.message);
    throw error;
  }
};

/**
 * Envía un email a través de The Factory HKA
 * @param {Object} emailData - Datos del email
 * @param {string} emailData.documento - Número de documento (NCF)
 * @param {string[]} emailData.correos - Array de correos destinatarios
 * @param {string} emailData.rnc - RNC del emisor (obligatorio, viene en la data de la petición)
 * @returns {Promise<Object>} Respuesta de la API de The Factory HKA
 */
const enviarEmailTheFactory = async (emailData) => {
  try {
    const { documento, correos, rnc, userId } = emailData;

    // Validaciones
    if (!documento) {
      throw new Error("El número de documento (NCF) es requerido");
    }

    if (!rnc) {
      throw new Error("El RNC del emisor es requerido");
    }

    if (!correos || !Array.isArray(correos) || correos.length === 0) {
      throw new Error("Debe proporcionar al menos un correo destinatario");
    }

    // Validar formato de emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailsInvalidos = correos.filter((email) => !emailRegex.test(email));
    if (emailsInvalidos.length > 0) {
      throw new Error(`Emails inválidos: ${emailsInvalidos.join(", ")}`);
    }

    console.log("📧 Iniciando envío de email a través de The Factory HKA...", {
      documento,
      rnc,
      correos: correos.length,
    });

    const urls = await resolveTheFactoryUrlsForUser(userId);
    const token = await obtenerTokenSistema(rnc, {
      userId,
      theFactoryUrls: urls,
    });

    // Construir payload según la API de The Factory HKA
    const payload = {
      token: token,
      rnc: rnc,
      correos: correos,
      documento: documento,
    };

    console.log("📤 Enviando solicitud de email a The Factory HKA...", {
      url: urls.emailUrl,
      documento,
      destinatarios: correos.length,
    });

    const response = await axios.post(urls.emailUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 60000, // 60 segundos
    });

    console.log("📨 Respuesta de The Factory HKA:", response.data);

    // Verificar respuesta
    if (!response.data) {
      throw new Error("Respuesta vacía de The Factory HKA");
    }

    const { procesado, codigo, mensaje } = response.data;

    // Interpretar resultado
    if (procesado === false && codigo === 0) {
      // Email encolado para envío (respuesta normal según documentación)
      return {
        success: true,
        status: "queued",
        message: mensaje || "Correo electrónico pendiente por ser enviado",
        data: {
          documento,
          correos,
          rnc,
          codigo,
          procesado,
          respuestaCompleta: response.data,
        },
      };
    } else if (procesado === true) {
      // Email procesado exitosamente
      return {
        success: true,
        status: "processed",
        message: mensaje || "Correo electrónico enviado exitosamente",
        data: {
          documento,
          correos,
          rnc,
          codigo,
          procesado,
          respuestaCompleta: response.data,
        },
      };
    } else {
      // Error en el procesamiento
      const errorMsg = mensaje || "Error desconocido en el envío de email";
      return {
        success: false,
        status: "error",
        message: errorMsg,
        error: {
          codigo,
          mensaje,
          procesado,
          respuestaCompleta: response.data,
        },
      };
    }
  } catch (error) {
    console.error("❌ Error al enviar email con The Factory HKA:", error);

    // Manejar errores de autenticación
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log(
        "🔄 Token inválido, el sistema principal manejará la renovación..."
      );
    }

    throw {
      success: false,
      status: "error",
      message: error.message || "Error al enviar email",
      error: {
        details: error.response?.data || error.message,
        status: error.response?.status,
        code: error.code,
      },
    };
  }
};

/**
 * Lógica reutilizable para enviar email de documento electrónico.
 * Retorna { status, data } para uso en API routes Next.js.
 *
 * @param {{ documento: string, correos: string[], rnc: string }} body
 * @param {{ userId?: string|null }} [options]
 * @returns {Promise<{ status: number, data: object }>}
 */
export async function enviarEmailDocumentoLogic(body, options = {}) {
  const { userId } = options;
  try {
    const { documento, correos, rnc } = body ?? {};

    if (!documento) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "El número de documento (NCF) es requerido",
          details: "Debe proporcionar el NCF del documento a enviar por email",
        },
      };
    }

    if (!rnc) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "El RNC del emisor es requerido",
          details: "Debe proporcionar el RNC en el body de la petición",
        },
      };
    }

    if (!correos || !Array.isArray(correos) || correos.length === 0) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "Debe proporcionar al menos un correo destinatario",
          details:
            "El campo correos debe ser un array con al menos un email válido",
        },
      };
    }

    if (correos.length > 10) {
      return {
        status: httpStatus.BAD_REQUEST,
        data: {
          status: "error",
          message: "Máximo 10 destinatarios por solicitud",
          details:
            "Para mejores resultados, limite el envío a máximo 10 correos por llamada",
        },
      };
    }

    console.log("📧 Solicitud de envío de email recibida:", {
      documento,
      correos: correos.length,
      rnc,
    });

    const resultado = await enviarEmailTheFactory({
      documento,
      correos,
      rnc,
      userId,
    });

    if (resultado.success) {
      return {
        status: httpStatus.OK,
        data: {
          status: "success",
          message: resultado.message,
          data: resultado.data,
        },
      };
    }

    return {
      status: httpStatus.BAD_REQUEST,
      data: {
        status: "error",
        message: resultado.message,
        details: resultado.error,
      },
    };
  } catch (error) {
    console.error("❌ Error en enviarEmailDocumentoLogic:", error);

    const err = error?.message ? error : { message: "Error desconocido" };
    return {
      status: httpStatus.INTERNAL_SERVER_ERROR,
      data: {
        status: "error",
        message: "Error interno del servidor al enviar email",
        details: err.message || "Error desconocido",
      },
    };
  }
}

/**
 * Controlador para la API REST - envía email de documento electrónico
 */
const enviarEmailDocumento = async (req, res) => {
  try {
    const { documento, correos, rnc } = req.body;

    // Validaciones
    if (!documento) {
      return res.status(400).json({
        status: "error",
        message: "El número de documento (NCF) es requerido",
        details: "Debe proporcionar el NCF del documento a enviar por email",
      });
    }

    if (!rnc) {
      return res.status(400).json({
        status: "error",
        message: "El RNC del emisor es requerido",
        details: "Debe proporcionar el RNC en el body de la petición",
      });
    }

    if (!correos || !Array.isArray(correos) || correos.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Debe proporcionar al menos un correo destinatario",
        details:
          "El campo correos debe ser un array con al menos un email válido",
      });
    }

    if (correos.length > 10) {
      return res.status(400).json({
        status: "error",
        message: "Máximo 10 destinatarios por solicitud",
        details:
          "Para mejores resultados, limite el envío a máximo 10 correos por llamada",
      });
    }

    console.log("📧 Solicitud de envío de email recibida:", {
      documento,
      correos: correos.length,
      rnc,
    });

    const resultado = await enviarEmailTheFactory({
      documento,
      correos,
      rnc,
      userId: req.user?._id?.toString?.() || req.user?.id || null,
    });

    if (resultado.success) {
      res.status(200).json({
        status: "success",
        message: resultado.message,
        data: resultado.data,
      });
    } else {
      res.status(400).json({
        status: "error",
        message: resultado.message,
        details: resultado.error,
      });
    }
  } catch (error) {
    console.error("❌ Error en controlador de envío de email:", error);

    res.status(500).json({
      status: "error",
      message: "Error interno del servidor al enviar email",
      details: error.message || "Error desconocido",
    });
  }
};

export {
  enviarEmailTheFactory,
  enviarEmailDocumento,
  enviarEmailDocumentoLogic,
  obtenerTokenTheFactory,
};
