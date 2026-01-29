# Documentación: Proceso de Reenvío de Verificación de Email

## Archivos

- **API:** `app/api/auth/resend-verification/route.js`
- **Uso desde:** `app/login/page.js` (sección de reenvío cuando el email no está verificado)

## Descripción General

Endpoint que permite reenviar el correo de verificación a un usuario que aún no ha verificado su email. Por seguridad, **no se revela si el email existe o no** cuando el usuario no existe; si el usuario ya está verificado, se devuelve un mensaje específico. El **token de verificación solo se persiste en base de datos después de que el email se envía correctamente**, evitando tokens huérfanos si el envío falla.

## Características Principales

- Validación de email requerido (400 si falta).
- Búsqueda de usuario por email (normalizado a minúsculas y trim).
- No revelar existencia de usuario cuando no existe (mensaje genérico 200).
- No enviar email ni generar token si el usuario ya está verificado.
- Generación de token en memoria; construcción de URL con `headers()` (host + `x-forwarded-proto`).
- Envío de email con Brevo; **solo si el envío tiene éxito** se guardan `verificationToken` y `verificationTokenExpires` en el usuario.
- Expiración del token: 24 horas.

## Flujo del Proceso (API)

### 1. Request

```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "usuario@ejemplo.com"
}
```

### 2. Validaciones

1. **Email ausente** → `400` con `{ "error": "Email es requerido" }`.
2. **Usuario no encontrado** → `200` con mensaje genérico (no revelar si existe o no):
   ```json
   { "message": "Si el email existe, se enviará un correo de verificación" }
   ```
3. **Usuario ya verificado** (`user.isVerified === true`) → `200` con:
   ```json
   { "message": "Este email ya está verificado" }
   ```

### 3. Generación de token y URL

- Se genera `verificationToken` con `crypto.randomBytes(32).toString("hex")`.
- Se define `verificationTokenExpires` = ahora + 24 horas.
- Se obtiene la URL base con `headers()` de Next.js:
  - `host` y `x-forwarded-proto` (por defecto `"http"`) para soportar proxy/HTTPS.
  - `verificationUrl = ${baseUrl}/api/auth/verify-email?token=${verificationToken}`.

El token **no se guarda aún** en el usuario; solo se usa para construir el enlace del correo.

### 4. Envío del email

- Se llama a `sendEmail` (Brevo) con asunto "Verifica tu cuenta", HTML y texto con el enlace.
- **Si el envío falla:** se devuelve `500` con:

  ```json
  {
    "error": "Error al enviar el email de verificación. Por favor, inténtalo de nuevo."
  }
  ```

  No se persiste ningún token; el usuario puede reintentar.

- **Si el envío tiene éxito:** se asignan `user.verificationToken` y `user.verificationTokenExpires`, se hace `user.save()` y se responde `200` con:
  ```json
  { "message": "Email de verificación enviado correctamente" }
  ```

## Respuestas del API

| Código | Condición             | Body (resumen)                                                                            |
| ------ | --------------------- | ----------------------------------------------------------------------------------------- |
| 200    | Email no existe       | `{ "message": "Si el email existe, se enviará un correo de verificación" }`               |
| 200    | Usuario ya verificado | `{ "message": "Este email ya está verificado" }`                                          |
| 200    | Email enviado OK      | `{ "message": "Email de verificación enviado correctamente" }`                            |
| 400    | Email faltante        | `{ "error": "Email es requerido" }`                                                       |
| 500    | Fallo envío email     | `{ "error": "Error al enviar el email de verificación. Por favor, inténtalo de nuevo." }` |
| 500    | Otro error servidor   | `{ "error": "Error al enviar el email de verificación" }`                                 |

## Integración desde el frontend (Login)

En `app/login/page.js`, cuando el login falla porque el email no está verificado, se muestra la sección de reenvío. El usuario introduce su email y se hace:

- **POST** a `/api/auth/resend-verification` con `{ email }`.
- En éxito (200): se muestra el mensaje recibido (éxito o "ya verificado").
- En error (4xx/5xx): se muestra `data.error` o mensaje genérico.

## Dependencias del API

- `NextResponse` (`next/server`)
- `headers` (`next/headers`) para construir la URL base
- `User` (modelo MongoDB)
- `sendEmail` (`@/api-mail_brevo`)
- `crypto` (Node.js)

## Seguridad y Buenas Prácticas

### Implementadas

- No revelar si el email existe cuando el usuario no existe (mensaje genérico 200).
- Token solo persistido **tras envío exitoso** del email; si Brevo falla, no se guarda token.
- URL base construida con `host` y `x-forwarded-proto` para entornos detrás de proxy/HTTPS.
- Token seguro (32 bytes hex) y expiración de 24 horas.
- No enviar correos ni generar tokens para usuarios ya verificados.

### Recomendaciones

- Rate limiting por IP o por email para evitar abuso (reenvíos masivos).
- Considerar cooldown entre reenvíos para el mismo email (ej. 1 minuto).

---

**Última actualización:** Enero 2026
