/**
 * Verificación del estado del servidor de TheFactoryHKA (conectividad y autenticación).
 * Usado por el endpoint verificarServidorTheFactory.
 */
import axios from "axios";
import {
  THEFACTORY_AUTH_URL,
  THEFACTORY_USUARIO,
  THEFACTORY_CLAVE,
  THEFACTORY_RNC,
  THEFACTORY_BASE_URL,
  THEFACTORY_BASE_URL_DEMO,
  buildTheFactoryUrls,
} from "@/utils/constants";

/**
 * Autentica en vivo contra TheFactoryHKA (sin caché de token) para validar credenciales.
 * @param {{ usuario: string, clave: string, rnc: string, ambiente: 'demo'|'production' }} params
 * `respondio` es true cuando el mensaje proviene de The Factory (y no de un error de red).
 * @returns {Promise<{ valido: boolean, estado: string, mensaje: string, codigo: number|null, respondio: boolean, authUrl: string }>}
 */
export async function verificarCredencialesTheFactory({ usuario, clave, rnc, ambiente }) {
  const { authUrl } = buildTheFactoryUrls(
    ambiente === "demo" ? THEFACTORY_BASE_URL_DEMO : THEFACTORY_BASE_URL,
  );
  try {
    const response = await axios.post(
      authUrl,
      { Usuario: usuario, Clave: clave, RNC: rnc },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 },
    );
    const codigo = typeof response.data?.codigo === "number" ? response.data.codigo : null;
    if (codigo === 0 && response.data?.token) {
      return {
        valido: true,
        estado: "VALIDAS",
        mensaje: response.data?.mensaje || "Autenticación correcta.",
        codigo,
        respondio: true,
        authUrl,
      };
    }
    return {
      valido: false,
      estado: "INVALIDAS",
      mensaje: response.data?.mensaje || "The Factory rechazó las credenciales.",
      codigo,
      respondio: true,
      authUrl,
    };
  } catch (error) {
    if (error.response) {
      const data = error.response.data;
      const mensaje =
        (data && typeof data === "object" && (data.mensaje || data.message || data.title)) ||
        (typeof data === "string" && data.trim().slice(0, 300)) ||
        error.message;
      return {
        valido: false,
        estado: error.response.status === 401 || error.response.status === 403 ? "INVALIDAS" : "ERROR",
        mensaje: `HTTP ${error.response.status}: ${mensaje}`,
        codigo: typeof data?.codigo === "number" ? data.codigo : null,
        respondio: true,
        authUrl,
      };
    }
    const sinConexion = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNABORTED"].includes(error.code);
    return {
      valido: false,
      estado: sinConexion ? "SERVIDOR_NO_DISPONIBLE" : "ERROR",
      mensaje: sinConexion
        ? `No se pudo conectar con The Factory (${error.code}).`
        : error.message || "Error al verificar las credenciales.",
      codigo: null,
      respondio: false,
      authUrl,
    };
  }
}

/**
 * Verifica si el servidor de TheFactoryHKA está disponible y las credenciales son válidas.
 * @returns {Promise<{ estado: string, recomendacion: string, [key: string]: any }>}
 */
export async function verificarEstadoTheFactory() {
  try {
    if (!THEFACTORY_USUARIO || !THEFACTORY_CLAVE || !THEFACTORY_RNC) {
      return {
        estado: "CONFIGURACION_FALTANTE",
        recomendacion:
          "Configure THEFACTORY_USUARIO, THEFACTORY_CLAVE y THEFACTORY_RNC en las variables de entorno.",
      };
    }

    const response = await axios.post(
      THEFACTORY_AUTH_URL,
      {
        Usuario: THEFACTORY_USUARIO,
        Clave: THEFACTORY_CLAVE,
        RNC: THEFACTORY_RNC,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    if (response.data?.codigo === 0) {
      return {
        estado: "FUNCIONANDO",
        recomendacion:
          "El servidor de TheFactoryHKA está disponible y la autenticación es correcta.",
      };
    }

    return {
      estado: "AUTENTICACION_FALLIDA",
      recomendacion:
        response.data?.mensaje || "La autenticación con TheFactoryHKA falló.",
    };
  } catch (error) {
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return {
        estado: "SERVIDOR_CAIDO",
        recomendacion:
          "No se pudo conectar al servidor de TheFactoryHKA. Verifique conectividad o que el servicio esté activo.",
      };
    }
    if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
      return {
        estado: "SERVIDOR_CAIDO",
        recomendacion: "Timeout al conectar con TheFactoryHKA.",
      };
    }
    return {
      estado: "ERROR",
      recomendacion: error.message || "Error al verificar el servidor.",
    };
  }
}
