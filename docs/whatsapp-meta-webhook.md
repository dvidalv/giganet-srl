# Webhook Meta WhatsApp Cloud API

Endpoint: `GET|POST /api/webhooks/whatsapp`

Archivo: `app/api/webhooks/whatsapp/route.js`

## Variables de entorno

En `.env.local` (y en Vercel → Environment Variables):

```env
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=1196990906839969
WHATSAPP_BOT_USER_ID=
WHATSAPP_BOT_RNC_EMISOR=
```

- `WHATSAPP_VERIFY_TOKEN`: string secreto largo. Debe coincidir con el **Token de verificación** en Meta.
- `WHATSAPP_ACCESS_TOKEN`: token de la Graph API (Bearer) para enviar mensajes.
- `WHATSAPP_PHONE_NUMBER_ID`: Phone Number ID de Cloud API. Si falta, fallback `1196990906839969`.
- `WHATSAPP_BOT_USER_ID`: `_id` Mongo del usuario cuyas credenciales TheFactory / `empresa.rnc` usa el bot para `RNC` y `ESTADO`.
- `WHATSAPP_BOT_RNC_EMISOR`: (opcional) RNC emisor por defecto para `ESTADO` si no se indica en el comando.

`.env*` ya está en `.gitignore`.

## Phone Number ID esperado

`1196990906839969`

## Bot Fase A (sin OpenAI)

Archivo: `lib/whatsappBot.js`

Comandos (ventana 24h, texto libre):

| Mensaje | Acción |
|---------|--------|
| `HOLA` / `MENU` / `AYUDA` / `1` | Menú de ayuda |
| `RNC 101609921` | Consulta contribuyente (TheFactory) |
| `ESTADO E320000000001` | Estatus e-CF (RNC emisor por defecto) |
| `ESTADO E320000000001 131098193` | Estatus e-CF con RNC emisor explícito |

Deduplicación en memoria por `message.id` (máx. 500).
