import { config } from "dotenv";
config({ path: ".env.local" });

import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

async function enviarAvisoComprobantes(
  nombreCliente,
  cantidadRestante,
  telefonoCliente,
) {
  const message = await client.messages.create({
    from: "whatsapp:+15558586932",
    to: `whatsapp:${telefonoCliente}`,
    contentSid: "HX9d7b1da0372bfdb95a75d3071b352a52",
    contentVariables: JSON.stringify({
      1: nombreCliente,
      2: String(cantidadRestante),
    }),
  });

  console.log(`Mensaje enviado a ${telefonoCliente}: ${message.sid}`);
  return message.sid;
}

// Prueba
enviarAvisoComprobantes("David Ricardo", 50, "+18295200087");
