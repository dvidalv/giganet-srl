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
} from "@/utils/constants";

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
