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

## Bot Fase A — flujo interactivo (sin API key)

El usuario de WhatsApp **no** envía API key ni registra su teléfono.

### Consulta de estatus (recomendado)

1. Escribe `ESTADO`
2. El bot pide el *RNC emisor*
3. Luego pide el *NCF*
4. Responde el estatus

También vale el atajo en un solo mensaje: `ESTADO E320000000001 131098193`

Sesión conversacional en Mongo (`whatsapp_sessions`), TTL ~15 min. `CANCELAR` / `MENU` limpia el flujo.

Si no hay empresa Giganet con ese RNC emisor, avisa que no está registrada.

Deduplicación de webhooks por `message.id` (máx. 500).
