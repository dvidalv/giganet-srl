import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import ComprobanteEnvio from "@/app/models/comprobanteEnvio";
import { 
  normalizeTheFactoryError, 
  buildErrorTextForAI,
  translateFieldPath 
} from "@/utils/theFactoryErrorHandler";
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
    let normalizedError = null;

    // Preferir detalle del usuario si trae errores de validación (más completo que un 400 genérico en DB)
    if (errorUsuario) {
      try {
        const parsed = JSON.parse(errorUsuario);
        const simulatedError = {
          response: {
            status: parsed.status || parsed.codigo || 400,
            data: parsed,
          },
          message: parsed.mensaje || parsed.message || "Error",
        };
        const fromUser = normalizeTheFactoryError(simulatedError);
        if (fromUser?.validationErrors?.length) {
          normalizedError = fromUser;
          console.log("✅ Usando error pegado por el usuario (validationErrors)");
        }
      } catch {
        // no es JSON limpio; se intenta más abajo
      }
    }

    if (!normalizedError && errorMongoDB) {
      // Prioridad 1: Si ya hay errorNormalizado guardado, úsalo
      if (errorMongoDB.errorNormalizado) {
        normalizedError = errorMongoDB.errorNormalizado;
        console.log("✅ Usando errorNormalizado guardado en MongoDB");
        console.log("Error normalizado:", JSON.stringify(normalizedError, null, 2));
      }
      // Prioridad 2: Si hay respuestaCompleta, normalízala
      else if (errorMongoDB.respuestaCompleta) {
        const simulatedError = {
          response: {
            status: errorMongoDB.codigoRespuesta || 400,
            data: errorMongoDB.respuestaCompleta,
          },
          message: errorMongoDB.mensajeRespuesta || "Error",
        };
        normalizedError = normalizeTheFactoryError(simulatedError);
        console.log("✅ Normalicé respuestaCompleta de MongoDB");
        console.log("Error normalizado:", JSON.stringify(normalizedError, null, 2));
      }
    }

    // Si el usuario pegó JSON/texto y aún no hay validationErrors, usarlo como contexto
    if (!normalizedError && errorUsuario) {
      try {
        const parsed = JSON.parse(errorUsuario);
        const simulatedError = {
          response: {
            status: parsed.status || parsed.codigo || 400,
            data: parsed,
          },
          message: parsed.mensaje || parsed.message || "Error",
        };
        normalizedError = normalizeTheFactoryError(simulatedError);
      } catch {
        contextError = `Error proporcionado por el usuario:
${errorUsuario}`;
      }
    }

    // Construir contexto a partir del error normalizado
    if (normalizedError) {
      // Respuesta determinística si hay validationErrors claros
      const { explicarValidacionCorta } = await import(
        "@/utils/theFactoryErrorHandler"
      );
      const corta = explicarValidacionCorta(normalizedError);
      if (corta) return corta;

      contextError = `Error registrado en el sistema para el comprobante ${ncf || "(sin NCF)"}:

${buildErrorTextForAI(normalizedError)}`;
      console.log("📋 Contexto de error construido:");
      console.log(contextError);
    } else if (errorMongoDB && !contextError) {
      // Fallback: solo información básica
      console.log("⚠️ No hay error normalizado, usando información básica");
      contextError = `Error registrado en el sistema:
- Código: ${errorMongoDB.codigoRespuesta || "N/A"}
- Mensaje: ${errorMongoDB.mensajeRespuesta || "N/A"}
- Tipo: ${errorMongoDB.tipoError || "N/A"}
- Fecha: ${errorMongoDB.fechaCreacion || "N/A"}

Detalles adicionales:
${JSON.stringify(errorMongoDB.detallesError || {}, null, 2)}`;
    } else if (!contextError) {
      return "No tengo información sobre el error de ese comprobante. Por favor cópiame el mensaje de error completo que aparece en tu sistema.";
    }

    const system = `Eres un asistente de facturación electrónica. Explica errores de forma ULTRA DIRECTA y CONCISA.

**REGLAS ABSOLUTAS:**

1. **SI HAY INFORMACIÓN ESPECÍFICA DEL ERROR:**
   - Di SOLO el problema exacto, nada más
   - Formato: "[Campo] tiene [problema]. [Solución en 1 línea]."
   - Ejemplo: "El correo del comprador tiene formato incorrecto. Usa un correo válido como cliente@empresa.com"
   - NO des contexto, NO expliques qué es el error, NO des múltiples pasos

2. **SI HAY MÚLTIPLES ERRORES:**
   - Lista cada uno en una línea
   - Formato: "1. [Campo]: [problema]. [Solución breve]"
   - NO agregues explicaciones adicionales

3. **SI NO HAY INFORMACIÓN ESPECÍFICA:**
   - Di: "El sistema rechazó el comprobante sin indicar el motivo exacto. Revisa RNC, NCF, correo, montos y fechas."
   - Nada más

4. **TRADUCCIÓN DE CAMPOS:**
   - DocumentoElectronico.Encabezado.Comprador.Correo → "correo del comprador"
   - DocumentoElectronico.Encabezado.Comprador.Direccion → "dirección del comprador"
   - DocumentoElectronico.Encabezado.Comprador.RNC → "RNC del comprador"
   - DocumentoElectronico.Encabezado.Emisor.RNC → "RNC del emisor"

5. **LENGUAJE PROHIBIDO:**
   - NUNCA: API, endpoint, request, response, status code, HTTP, JSON, validationErrors, solicitud, servidor, cliente
   - USA: comprobante, factura, datos, sistema

6. **MÁXIMA BREVEDAD:**
   - Respuesta ideal: 1-2 líneas
   - Máximo permitido: 5 líneas
   - NO expliques qué significa el error
   - NO des contexto adicional
   - NO enumeres todos los datos a revisar si el error es específico

Documentación disponible:
${docs}

Códigos comunes:
- 108: NCF ya usado
- 109: NCF vencido
- 110: RNC no autorizado
- 111: Datos inválidos

**EJEMPLOS CORRECTOS:**

✅ Error específico con 1 campo:
"La dirección del comprador excede la longitud permitida. Usa una dirección más corta."

✅ Error específico con múltiples campos:
"1. Correo del comprador: formato incorrecto. Usa ejemplo@dominio.com
2. RNC del comprador: longitud incorrecta. Debe tener 9 u 11 dígitos."

✅ Error sin información específica:
"El sistema rechazó el comprobante sin indicar el motivo exacto. Revisa RNC, NCF, correo, montos y fechas."

**EJEMPLOS INCORRECTOS:**

❌ Demasiado texto:
"El comprobante fue rechazado porque hay un problema con los datos enviados. El mensaje de error indica... [párrafos largos]"

❌ Explicaciones innecesarias:
"Esto generalmente ocurre cuando... Las causas pueden ser... Te recomiendo revisar..."

❌ Listas genéricas cuando el error es específico:
"Revisa: RNC del emisor, NCF, correo, montos, fechas..." (cuando el error dice exactamente qué campo falló)

Responde en máximo 3 líneas, formato WhatsApp (usa * para negrita si necesario).`;

    const prompt = `NCF: ${ncf}

${contextError}

Analiza este error y explica:
1. Qué significa exactamente (usa la información específica de la API si está disponible)
2. Cuál es la causa (SOLO la que la API indicó, no inventes otras)
3. Cómo solucionarlo paso a paso

Si hay errores de validación múltiples, explica cada uno claramente.`;

    const { text } = await generateText({
      model: resolveModel(),
      system,
      prompt,
      temperature: 0.2, // Reducido para respuestas más precisas
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
