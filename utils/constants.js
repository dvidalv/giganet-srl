// Configuración FileMaker (opcional)
const FILEMAKER_URL = process.env.FILEMAKER_URL || "";
const FILEMAKER_DATABASE = process.env.FILEMAKER_DATABASE || "";
const FILEMAKER_CREDENTIALS_BASE64 =
  process.env.FILEMAKER_CREDENTIALS_BASE64 || "";
const FILEMAKER_RESULTADOSLAYOUT = process.env.FILEMAKER_RESULTADOSLAYOUT || "";
const FILEMAKER_MEDICOSLAYOUT = process.env.FILEMAKER_MEDICOSLAYOUT || "";
const FILEMAKER_PUBLICACIONESLAYOUT =
  process.env.FILEMAKER_PUBLICACIONESLAYOUT || "";

// Configuración para TheFactoryHKA e-CF API
// THEFACTORY_BASE_URL = producción; THEFACTORY_BASE_URL_DEMO = pruebas (por empresa en BD).
const THEFACTORY_BASE_URL =
  process.env.THEFACTORY_BASE_URL ||
  "https://emision.thefactoryhka.com.do/api";
const THEFACTORY_BASE_URL_DEMO =
  process.env.THEFACTORY_BASE_URL_DEMO ||
  "https://demoemision.thefactoryhka.com.do/api";

/** @param {string} baseUrl */
function buildTheFactoryUrls(baseUrl) {
  const b = String(baseUrl || "").replace(/\/+$/, "");
  return {
    baseUrl: b,
    authUrl: `${b}/Autenticacion`,
    enviarUrl: `${b}/Enviar`,
    estatusUrl: `${b}/EstatusDocumento`,
    emailUrl: `${b}/EnvioCorreo`,
    anulacionUrl: `${b}/Anulacion`,
    descargaUrl: `${b}/DescargaArchivo`,
  };
}

const _prodUrls = buildTheFactoryUrls(THEFACTORY_BASE_URL);
let THEFACTORY_AUTH_URL = _prodUrls.authUrl;
let THEFACTORY_ENVIAR_URL = _prodUrls.enviarUrl;
let THEFACTORY_ESTATUS_URL = _prodUrls.estatusUrl;
let THEFACTORY_EMAIL_URL = _prodUrls.emailUrl;
let THEFACTORY_ANULACION_URL = _prodUrls.anulacionUrl;
let THEFACTORY_DESCARGA_URL = _prodUrls.descargaUrl;
let THEFACTORY_USUARIO = process.env.THEFACTORY_USUARIO;
let THEFACTORY_CLAVE = process.env.THEFACTORY_CLAVE;
let THEFACTORY_RNC = process.env.THEFACTORY_RNC;

module.exports = {
  FILEMAKER_URL,
  FILEMAKER_DATABASE,
  FILEMAKER_CREDENTIALS_BASE64,
  FILEMAKER_RESULTADOSLAYOUT,
  FILEMAKER_MEDICOSLAYOUT,
  FILEMAKER_PUBLICACIONESLAYOUT,
  THEFACTORY_BASE_URL,
  THEFACTORY_BASE_URL_DEMO,
  buildTheFactoryUrls,
  THEFACTORY_AUTH_URL,
  THEFACTORY_ENVIAR_URL,
  THEFACTORY_ESTATUS_URL,
  THEFACTORY_EMAIL_URL,
  THEFACTORY_ANULACION_URL,
  THEFACTORY_DESCARGA_URL,
  THEFACTORY_USUARIO,
  THEFACTORY_CLAVE,
  THEFACTORY_RNC,
};
