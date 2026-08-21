# Webhook Meta WhatsApp Cloud API

Endpoint: `GET|POST /api/webhooks/whatsapp`

Archivo: `app/api/webhooks/whatsapp/route.js`

## Variable de entorno

En `.env.local` (y en Vercel → Environment Variables):

```env
WHATSAPP_VERIFY_TOKEN=
```

Elige un string secreto largo. Debe coincidir exactamente con el **Token de verificación** configurado en Meta (App → WhatsApp → Configuration → Webhook).

No hardcodees el token en el código. `.env*` ya está en `.gitignore`.

## Phone Number ID esperado

Los eventos deberían reportar `metadata.phone_number_id`:

`1196990906839969`

## Nota

En esta fase el webhook solo verifica la suscripción y registra en consola estados (`sent` / `delivered` / `read` / `failed`) y mensajes entrantes. No responde automáticamente ni conecta OpenAI.
