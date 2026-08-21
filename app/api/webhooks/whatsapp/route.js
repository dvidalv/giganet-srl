import { NextResponse } from "next/server";

const EXPECTED_PHONE_NUMBER_ID = "1196990906839969";

/**
 * Verificación del webhook de Meta WhatsApp Cloud API.
 * GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * Recepción de eventos (estados de entrega y mensajes entrantes).
 * Responde 200 de inmediato; en esta fase solo registra en consola.
 * POST /api/webhooks/whatsapp
 */
export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("WHATSAPP WEBHOOK:", JSON.stringify(body, null, 2));

  try {
    processWebhookPayload(body);
  } catch (error) {
    console.error("WHATSAPP WEBHOOK processing error:", error);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

function processWebhookPayload(body) {
  const entries = Array.isArray(body?.entry) ? body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      if (!value || typeof value !== "object") continue;

      logMetadata(value.metadata);

      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          logMessageStatus(status);
        }
      }

      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          logIncomingMessage(message);
        }
      }
    }
  }
}

function logMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return;

  const displayPhoneNumber = metadata.display_phone_number ?? "(none)";
  const phoneNumberId = metadata.phone_number_id ?? "(none)";
  const matchesExpected =
    String(phoneNumberId) === EXPECTED_PHONE_NUMBER_ID ? "YES" : "NO";

  console.log("==============================");
  console.log("WHATSAPP METADATA");
  console.log(`Display phone: ${displayPhoneNumber}`);
  console.log(`Phone number ID: ${phoneNumberId}`);
  console.log(`Matches expected (${EXPECTED_PHONE_NUMBER_ID}): ${matchesExpected}`);
  console.log("==============================");
}

function logMessageStatus(status) {
  if (!status || typeof status !== "object") return;

  console.log("==============================");
  console.log("WHATSAPP MESSAGE STATUS");
  console.log(`Message ID: ${status.id ?? "(none)"}`);
  console.log(`Recipient: ${status.recipient_id ?? "(none)"}`);
  console.log(`Status: ${status.status ?? "(none)"}`);
  console.log(`Timestamp: ${status.timestamp ?? "(none)"}`);

  const errors = Array.isArray(status.errors) ? status.errors : [];
  for (const error of errors) {
    if (!error || typeof error !== "object") continue;
    console.log(`Error code: ${error.code ?? "(none)"}`);
    console.log(`Error title: ${error.title ?? "(none)"}`);
    console.log(`Error message: ${error.message ?? "(none)"}`);
    if (error.error_data !== undefined) {
      console.log(
        `Error data: ${JSON.stringify(error.error_data, null, 2)}`,
      );
    }
    console.log(`Error details: ${error.details ?? "(none)"}`);
  }

  console.log("==============================");
}

function logIncomingMessage(message) {
  if (!message || typeof message !== "object") return;

  console.log("==============================");
  console.log("WHATSAPP INCOMING MESSAGE");
  console.log(`From: ${message.from ?? "(none)"}`);
  console.log(`Message ID: ${message.id ?? "(none)"}`);
  console.log(`Timestamp: ${message.timestamp ?? "(none)"}`);
  console.log(`Type: ${message.type ?? "(none)"}`);

  if (message.type === "text" && message.text?.body) {
    console.log(`Text: ${message.text.body}`);
  }

  console.log("==============================");
}
