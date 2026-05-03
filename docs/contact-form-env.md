# Formulario de contacto: variables de entorno

El formulario en `app/contacto` usa **Cloudflare Turnstile**, un campo **honeypot** y **rate limiting por IP** (MongoDB). Configura lo siguiente en Vercel (o en `.env.local`).

## Obligatorio en producción

| Variable | Dónde se usa |
|----------|----------------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cliente: widget Turnstile en la página de contacto. |
| `TURNSTILE_SECRET_KEY` | Servidor: verificación en `actions/enviarFormularioContacto-action.js` vía `lib/verifyTurnstile.js`. |

Pasos:

1. En Cloudflare Dashboard: **Turnstile** → crear widget (modo gestionado o invisible según prefieras).
2. Copiar **Site key** → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Copiar **Secret key** → `TURNSTILE_SECRET_KEY` (solo servidor; no exponer al cliente).

Sin la site key pública, el botón de envío permanece deshabilitado. Sin el secret en **producción**, la verificación falla y el usuario verá un mensaje genérico de error.

En **desarrollo** (`NODE_ENV=development`), si falta `TURNSTILE_SECRET_KEY`, la verificación se omite para poder probar sin Cloudflare.

## Correo

| Variable | Descripción |
|----------|-------------|
| `CONTACT_FORM_TO_EMAIL` | Buzón que recibe los mensajes (si no está, se usan otras variables de Brevo según `enviarFormularioContacto-action.js`). |

## Rate limit (MongoDB)

Requiere `MONGODB_URI` conectado. Límite: **5 envíos por IP por hora** (constante `CONTACT_SUBMISSIONS_PER_HOUR` en `lib/contactFormRateLimit.js`).

| Variable | Descripción |
|----------|-------------|
| `CONTACT_RATE_LIMIT_SALT` | Opcional. Sal para el hash SHA-256 de la IP. Conviene fijar un valor secreto en producción. |

Los registros se guardan en la colección `contact_form_rate_limits` y caducan automáticamente (TTL).
