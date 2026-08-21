# Webhook Meta WhatsApp Cloud API

Endpoint: `GET|POST /api/webhooks/whatsapp`

Archivo: `app/api/webhooks/whatsapp/route.js`

## Variables de entorno

En `.env.local` (y en Vercel → Environment Variables):

```env
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=1196990906839969
```

- `WHATSAPP_VERIFY_TOKEN`: string secreto largo. Debe coincidir con el **Token de verificación** en Meta (App → WhatsApp → Configuration → Webhook).
- `WHATSAPP_ACCESS_TOKEN`: token de la Graph API (Bearer) para enviar mensajes. No hardcodearlo.
- `WHATSAPP_PHONE_NUMBER_ID`: Phone Number ID de Cloud API. Si falta, el código usa `1196990906839969` como fallback.

`.env*` ya está en `.gitignore`.

## Phone Number ID esperado

Los eventos deberían reportar `metadata.phone_number_id`:

`1196990906839969`

## Auto-reply

Ante mensajes entrantes `type === "text"`, responde con texto fijo (ventana 24h, sin plantilla). No usa OpenAI todavía. Deduplicación en memoria por `message.id` (máx. 500).
