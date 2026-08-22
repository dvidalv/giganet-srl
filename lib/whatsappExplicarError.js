import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import fs from "fs";
import path from "path";

/**
 * Resuelve el modelo AI a usar.
 */
function resolveModel() {
  const modelId =
    process.env.WHATSAPP_BOT_AI_MODEL?.trim() || "openai/gpt-4o-mini";

  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return modelId;
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY.trim(),
    });
    const bare = modelId.includes("/")
      ? modelId.split("/").slice(1).join("/")
      : modelId;
    return openai(bare);
  }

  return modelId;
}

/**
 * Busca el último envío fallido de un comprobante en MongoDB.
 * @param {string} ncf
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function buscarErrorComprobante(ncf, userId) {
  try {
    const registro = await ComprobanteEnvio.findOne({
      ncf: String(ncf).toUpperCase().trim(),
      usuario: userId,
      exitoso: false,
    })
      .sort({ fechaCreacion: -1 })
      .lean();

    return registro;
  } catch (error) {
    console.error("Error al buscar comprobante en MongoDB:", error);
    return null;
  }
}

/**
 * Carga la documentación relevante de DGII y The Factory.
 * @returns {Promise<string>}
 */
async function cargarDocumentacion() {
  try {
    const docsPath = path.join(process.cwd(), "docs");
    let docs = "";

    // Cargar ejemplos JSON de errores comunes
    const ejemplosPath = path.join(docsPath, "dgii", "ejemplos_json");
    if (fs.existsSync(ejemplosPath)) {
      const files = fs.readdirSync(ejemplosPath).filter((f) => f.includes("404"));
      for (const file of files.slice(0, 5)) {
        const content = fs.readFileSync(path.join(ejemplosPath, file), "utf-8");
        docs += `\n### Ejemplo de error (${file}):\n${content}\n`;
      }
    }

    // Cargar documentación markdown relevante
    const mdFiles = [
      "filemaker-envio-datos-api.md",
      "controllers-comprobantes-nextjs.md",
    ];
    for (const file of mdFiles) {
      const mdPath = path.join(docsPath, file);
      if (fs.existsSync(mdPath)) {
        const content = fs.readFileSync(mdPath, "utf-8");
        docs += `\n### Documentación (${file}):\n${content.slice(0, 5000)}\n`;
      }
    }

    return docs;
  } catch (error) {
    console.error("Error al cargar documentación:", error);
    return "";
  }
}

/**
 * Genera una explicación del error usando AI.
 * @param {Object} params
 * @param {string|null} params.errorMongoDB - Error guardado en MongoDB
 * @param {string|null} params.errorUsuario - Error copiado por el usuario
 * @param {string} params.ncf - NCF del comprobante
 * @returns {Promise<string>}
 */
export async function explicarErrorConAI({
  errorMongoDB,
  errorUsuario,
  ncf,
}) {
  try {
    const docs = await cargarDocumentacion();

    let contextError = "";
    if (errorMongoDB) {
      contextError = `Error registrado en el sistema:
- Código: ${errorMongoDB.codigoRespuesta || "N/A"}
- Mensaje: ${errorMongoDB.mensajeRespuesta || "N/A"}
- Tipo: ${errorMongoDB.tipoError || "N/A"}
- Detalles: ${JSON.stringify(errorMongoDB.detallesError || {}, null, 2)}
- Respuesta completa: ${JSON.stringify(errorMongoDB.respuestaCompleta || {}, null, 2)}`;
    } else if (errorUsuario) {
      contextError = `Error proporcionado por el usuario:
${errorUsuario}`;
    } else {
      return "No tengo información sobre el error de ese comprobante. Por favor cópiame el mensaje de error completo que aparece en tu sistema.";
    }

    const system = `Eres un experto en facturación electrónica de República Dominicana (DGII) y la plataforma The Factory HKA.

Tu trabajo es explicar errores de comprobantes electrónicos (e-CF) de forma clara y proponer soluciones.

Documentación disponible:
${docs}

Códigos de error comunes:
- 108: NCF ya fue presentado anteriormente
- 109: NCF vencido o inválido
- 110: RNC no autorizado para este tipo de comprobante
- 111: Datos de la factura inválidos
- 120: Documento no encontrado en TheFactory
- 7777: Secuencia reutilizable (postulación inactiva o rango e-NCF inválido)
- 401/403: Error de autenticación
- 404: Recurso no encontrado

Instrucciones:
1. Analiza el error y explica qué significa en español claro
2. Identifica la causa más probable
3. Proporciona pasos específicos para solucionarlo
4. Si es un error de configuración, indica dónde revisar
5. Menciona si necesita contactar a DGII o The Factory

Responde en máximo 500 palabras, formato de WhatsApp (sin markdown complejo).`;

    const prompt = `NCF: ${ncf}

${contextError}

Explica este error y cómo solucionarlo:`;

    const { text } = await generateText({
      model: resolveModel(),
      system,
      prompt,
      temperature: 0.3,
      maxTokens: 1000,
    });

    return text.trim();
  } catch (error) {
    console.error("Error al generar explicación con AI:", error);
    return "No pude analizar el error en este momento. Por favor intenta nuevamente o contacta a soporte técnico.";
  }
}

/**
 * Genera explicación sin AI (fallback).
 * @param {Object} errorData
 * @returns {string}
 */
export function explicarErrorSinAI(errorData) {
  if (!errorData) {
    return "No encontré información sobre ese error. Por favor cópiame el mensaje de error completo que aparece en tu sistema.";
  }

  const codigo = errorData.codigoRespuesta;
  const mensaje = errorData.mensajeRespuesta || "Error desconocido";

  const explicaciones = {
    108: `*Error 108: NCF duplicado*

Este NCF ya fue enviado anteriormente a la DGII.

*Causa:* Estás intentando enviar un comprobante con un número que ya fue usado.

*Solución:*
1. Verifica en tu sistema si este comprobante ya fue enviado
2. Si fue enviado por error, usa un nuevo NCF del rango disponible
3. Si necesitas corregir datos, debes anular el anterior y generar uno nuevo`,

    109: `*Error 109: NCF vencido o inválido*

El número de comprobante (NCF) no es válido o está vencido.

*Causas posibles:*
- El rango de secuencia está vencido
- El formato del NCF es incorrecto
- El tipo de comprobante no coincide con la secuencia

*Solución:*
1. Verifica que el NCF tenga el formato correcto (Ej: E320000000001)
2. Revisa en Mi Empresa que tengas un rango de secuencias activo
3. Confirma que la fecha de vencimiento del rango no haya pasado
4. Solicita un nuevo rango de secuencias si es necesario`,

    110: `*Error 110: RNC no autorizado*

El RNC del emisor no tiene autorización para usar este tipo de comprobante.

*Causa:* La empresa no está postulada en DGII para emitir este tipo de e-CF.

*Solución:*
1. Verifica tu postulación en el portal de DGII
2. Confirma que el tipo de comprobante (31, 32, etc.) esté autorizado
3. Si necesitas autorización, debes solicitarla en DGII
4. Contacta a tu oficina de DGII para verificar tu estatus`,

    111: `*Error 111: Datos inválidos*

La factura tiene datos incorrectos o faltantes.

*Causas posibles:*
- Campos obligatorios vacíos
- Formato de fecha incorrecto
- Montos con errores de cálculo
- RNC del comprador inválido

*Solución:*
1. Revisa todos los campos obligatorios
2. Verifica que las fechas estén en formato DD-MM-YYYY
3. Confirma que los montos sumen correctamente
4. Valida que el RNC del comprador exista en DGII`,

    120: `*Error 120: Comprobante no encontrado*

El comprobante no está en la base de datos de The Factory.

*Causas posibles:*
- El comprobante nunca fue enviado
- Diferencia de ambiente (Demo vs Producción)
- RNC incorrecto en la consulta
- Delay en sincronización

*Solución:*
1. Verifica que usas el ambiente correcto (Demo o Producción)
2. Confirma que el RNC emisor coincide con tu empresa
3. Si acabas de enviar, espera 1-2 minutos
4. Intenta enviar el comprobante nuevamente`,

    7777: `*Error 7777: Secuencia reutilizable*

Este error indica problemas con la postulación o el rango de secuencias.

*Causas posibles:*
- No tienes postulación activa en DGII
- El rango e-NCF no es válido en este ambiente
- La secuencia no está configurada en The Factory

*Solución:*
1. Verifica tu postulación en el portal de DGII
2. Revisa que el rango de secuencias esté activo
3. Confirma que estés en el ambiente correcto
4. Contacta a The Factory si el problema persiste`,
  };

  const explicacion = explicaciones[codigo];
  if (explicacion) {
    return explicacion;
  }

  return `*Error ${codigo || "desconocido"}*

${mensaje}

*Recomendaciones generales:*
1. Revisa los datos del comprobante
2. Verifica tu configuración en Mi Empresa
3. Confirma que tus credenciales de The Factory estén actualizadas
4. Si el error persiste, contacta a soporte técnico con el NCF y el código de error

Puedes copiarme el mensaje de error completo para darte una explicación más detallada.`;
}
