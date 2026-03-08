import { config } from "dotenv";
config({ path: ".env.local" });

import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function enviar() {
  const message = await client.messages.create({
    from: "whatsapp:+14155238886",
    to: "whatsapp:+16825602093",
    body: "Hola David, este es un mensaje de prueba desde Node 🚀"
  });

  console.log(message.sid);
}

enviar();