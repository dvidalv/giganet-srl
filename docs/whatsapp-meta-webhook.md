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
AI_GATEWAY_API_KEY=
# opcional, alternativa a AI Gateway:
# OPENAI_API_KEY=
# WHATSAPP_BOT_AI_MODEL=openai/gpt-4o-mini
```

**Importante:** el usuario de WhatsApp **no** envía API key ni usuario de The Factory. Solo manda RNC / NCF. Las credenciales TheFactory se resuelven en el servidor.

- `WHATSAPP_VERIFY_TOKEN`: token de verificación del webhook en Meta.
- `WHATSAPP_ACCESS_TOKEN`: Bearer de Graph API para enviar respuestas.
- `WHATSAPP_PHONE_NUMBER_ID`: Phone Number ID (`1196990906839969` por defecto).
- `WHATSAPP_BOT_USER_ID` *(servidor)*: `_id` Mongo de la cuenta de servicio Giganet con credenciales TheFactory en “Mi Empresa”.
- `WHATSAPP_BOT_RNC_EMISOR` *(servidor)*: RNC de esa cuenta de servicio. Si no hay `WHATSAPP_BOT_USER_ID`, el bot busca un usuario con `empresa.rnc` igual a este valor. También se usa como emisor en `ConsultaRNC`.
- `AI_GATEWAY_API_KEY` *(recomendado)*: habilita el asistente con lenguaje natural vía Vercel AI Gateway. Sin esta key (ni `OPENAI_API_KEY`), el bot usa heurísticas en español + el mismo saludo.
- `OPENAI_API_KEY` *(opcional)*: alternativa si no usas AI Gateway.
- `WHATSAPP_BOT_AI_MODEL` *(opcional)*: modelo, por defecto `openai/gpt-4o-mini`.

`.env*` ya está en `.gitignore`.

## Phone Number ID esperado

`1196990906839969`

## Bot — asistente virtual (lenguaje natural)

Al escribir `hola`, `ayuda`, `menu` o al iniciar, el bot se presenta y lista lo que puede hacer (definido en `lib/whatsappBotCapabilities.js`).

Ejemplos:

- “Quiero saber el estado del comprobante E320000000001” → pide RNC si falta, luego consulta
- “Consulta el RNC 101609921” → consulta contribuyente

Los comandos legacy `ESTADO` / `RNC` / `CANCELAR` siguen funcionando.

Sesión conversacional en Mongo (`whatsapp_sessions`), TTL ~15 min.

Si no hay empresa Giganet con ese RNC emisor, avisa que no está registrada.

Deduplicación de webhooks por `message.id` (máx. 500).
