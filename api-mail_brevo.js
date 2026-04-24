/**
 * Envía un email transaccional usando Brevo API REST
 * @param {Object} emailData - Datos del email
 * @param {string} emailData.to - Email del destinatario
 * @param {string} emailData.subject - Asunto del email
 * @param {string} emailData.htmlContent - Contenido HTML del email
 * @param {string} emailData.textContent - Contenido en texto plano (opcional)
 * @param {string} emailData.fromEmail - Email del remitente (opcional)
 * @param {string} emailData.fromName - Nombre del remitente (opcional)
 * @returns {Promise<Object>} Respuesta de la API de Brevo
 */
const sendEmail = async (emailData) => {
  try {
    const {
      to,
      subject,
      htmlContent,
      textContent = "",
      fromEmail = process.env.BREVO_FROM_EMAIL || process.env.EMAIL_FROM || "noreply@example.com",
      fromName = process.env.BREVO_FROM_NAME || "Giganet",
    } = emailData;

    // Validar que tenemos API Key
    if (!process.env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY no está configurada en las variables de entorno");
    }

    // Preparar el payload para la API de Brevo
    const payload = {
      sender: {
        name: fromName,
        email: fromEmail,
      },
      to: [
        {
          email: to,
        },
      ],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent,
    };

    // Enviar el email usando fetch
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let result;
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      console.error(
        "Error de Brevo API (respuesta no JSON):",
        response.status,
        raw?.slice?.(0, 500),
      );
      throw new Error(`Brevo HTTP ${response.status}`);
    }

    if (!response.ok) {
      console.error("Error de Brevo API:", result);
      const msg =
        (typeof result?.message === "string" && result.message) ||
        (Array.isArray(result?.message) && result.message.join("; ")) ||
        (raw && raw.length < 400 ? raw : JSON.stringify(result));
      throw new Error(msg || `Error al enviar email (HTTP ${response.status})`);
    }

    console.log("Email enviado exitosamente:", result);
    return {
      success: true,
      messageId: result.messageId,
      data: result,
    };
  } catch (error) {
    console.error("Error al enviar email con Brevo:", error);
    throw {
      success: false,
      error: error.message || "Error desconocido al enviar email",
      details: error,
    };
  }
};

export { sendEmail };