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

**Importante:** el usuario de WhatsApp **no** envía API key ni usuario de The Factory. Solo manda RNC / NCF. Las credenciales TheFactory se resuelven en el servidor.

- `WHATSAPP_VERIFY_TOKEN`: token de verificación del webhook en Meta.
- `WHATSAPP_ACCESS_TOKEN`: Bearer de Graph API para enviar respuestas.
- `WHATSAPP_PHONE_NUMBER_ID`: Phone Number ID (`1196990906839969` por defecto).
- `WHATSAPP_BOT_USER_ID` *(servidor)*: `_id` Mongo de la cuenta de servicio Giganet con credenciales TheFactory en “Mi Empresa”.
- `WHATSAPP_BOT_RNC_EMISOR` *(servidor)*: RNC de esa cuenta de servicio. Si no hay `WHATSAPP_BOT_USER_ID`, el bot busca un usuario con `empresa.rnc` igual a este valor. También se usa como emisor en `ConsultaRNC`.

`.env*` ya está en `.gitignore`.

## Phone Number ID esperado

`1196990906839969`

## Bot Fase A — consulta por NCF + RNC (sin API key)

El usuario de WhatsApp **no** envía API key ni registra su teléfono.

| Mensaje | Qué hace |
|---------|----------|
| `ESTADO E320000000001 131098193` | Busca usuario con `empresa.rnc = 131098193` → usa sus credenciales TheFactory (igual que tras resolver un API key) |
| `RNC 101609921` | Consulta contribuyente (opcional; requiere cuenta de servicio `WHATSAPP_BOT_*`) |
| `HOLA` / `MENU` | Menú |

Si no hay empresa Giganet con ese RNC emisor, responde que no está registrada.

Deduplicación en memoria por `message.id` (máx. 500).
