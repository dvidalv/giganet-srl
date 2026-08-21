const GRAPH_API_VERSION = "v26.0";
const FALLBACK_PHONE_NUMBER_ID = "1196990906839969";

/**
 * Envía un mensaje de texto vía WhatsApp Cloud API (ventana de 24h).
 * No usa plantillas.
 *
 * @param {string} to Número destino (ej. "16825602093")
 * @param {string} text Cuerpo del mensaje
 * @returns {Promise<{ ok: boolean, messageId?: string, status?: string, httpStatus?: number, errorBody?: unknown }>}
 */
export async function sendWhatsAppTextMessage(to, text) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID || FALLBACK_PHONE_NUMBER_ID;

  if (!accessToken) {
    console.error(
      "==============================\n" +
        "WHATSAPP SEND ERROR\n" +
        `Recipient: ${to ?? "(none)"}\n` +
        "HTTP Status: (none)\n" +
        "Meta response: WHATSAPP_ACCESS_TOKEN is not configured\n" +
        "==============================",
    );
    return { ok: false, errorBody: "WHATSAPP_ACCESS_TOKEN is not configured" };
  }

  if (!to) {
    console.error(
      "==============================\n" +
        "WHATSAPP SEND ERROR\n" +
        "Recipient: (none)\n" +
        "HTTP Status: (none)\n" +
        "Meta response: Missing recipient number\n" +
        "==============================",
    );
    return { ok: false, errorBody: "Missing recipient number" };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: String(to),
        type: "text",
        text: { body: text },
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error("==============================");
      console.error("WHATSAPP SEND ERROR");
      console.error(`Recipient: ${to}`);
      console.error(`HTTP Status: ${response.status}`);
      console.error(
        `Meta response: ${data != null ? JSON.stringify(data, null, 2) : "(unreadable)"}`,
      );
      console.error("==============================");
      return {
        ok: false,
        httpStatus: response.status,
        errorBody: data,
      };
    }

    const messageId = data?.messages?.[0]?.id;
    const status = data?.messages?.[0]?.message_status ?? "accepted";

    console.log("==============================");
    console.log("WHATSAPP OUTGOING MESSAGE");
    console.log(`To: ${to}`);
    console.log(`Text: ${text}`);
    console.log(`Status: ${status}`);
    console.log(`Message ID: ${messageId ?? "(none)"}`);
    console.log("==============================");

    return {
      ok: true,
      messageId,
      status,
      httpStatus: response.status,
    };
  } catch (error) {
    console.error("==============================");
    console.error("WHATSAPP SEND ERROR");
    console.error(`Recipient: ${to}`);
    console.error("HTTP Status: (network error)");
    console.error(
      `Meta response: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error("==============================");
    return { ok: false, errorBody: String(error) };
  }
}
