# Sistema de Verificación de Email

## Descripción

Se ha implementado un sistema completo de verificación de email para nuevos usuarios. Cuando un usuario se registra, debe verificar su correo electrónico antes de poder iniciar sesión.

## Cambios Realizados

### 1. Modelo de Usuario Actualizado (`app/models/user.js`)

- **Nuevos campos:**
  - `verificationToken`: Token único para verificar el email
  - `verificationTokenExpires`: Fecha de expiración del token (24 horas)

### 2. Registro de Usuario (`app/api/auth/signup/route.js`)

- Genera un token de verificación único al crear un usuario
- Envía un email de bienvenida con enlace de verificación
- El enlace expira en 24 horas
- No expone el token en la respuesta de la API

### 3. Verificación de Email (`app/api/auth/verify-email/route.js`)

- Nueva ruta API para verificar el email: `/api/auth/verify-email?token={token}`
- Valida el token y verifica que no haya expirado
- Marca el usuario como verificado (`isVerified: true`)
- Limpia el token después de usarlo
- Redirige al login con mensaje de éxito o error

### 4. Autenticación Actualizada (`auth.js`)

- Verifica que el usuario tenga su email verificado antes de permitir el login
- Muestra error específico si el email no está verificado

### 5. Página de Login Actualizada (`app/login/page.js`)

- Muestra mensajes de verificación:
  - Éxito al verificar email
  - Errores de token inválido o expirado
  - Error si intenta iniciar sesión sin verificar email
- **Sección de reenvío de email:**
  - Aparece cuando el usuario intenta iniciar sesión sin verificar
  - Permite reenviar el email de verificación
  - Formulario simple con validación

### 6. Reenvío de Email de Verificación (`app/api/auth/resend-verification/route.js`)

- Nueva ruta API: `/api/auth/resend-verification`
- Permite reenviar el email de verificación
- Genera un nuevo token
- No revela si el email existe o no (seguridad)
- No envía email si el usuario ya está verificado

## Flujo de Usuario

### Registro

1. Usuario completa el formulario de registro
2. Sistema crea la cuenta con `isVerified: false`
3. Sistema genera token de verificación (válido 24 horas)
4. Sistema envía email con enlace de verificación
5. Usuario ve mensaje: "¡Cuenta creada! Por favor verifica tu email para activar tu cuenta."

### Verificación

1. Usuario hace clic en el enlace del email
2. Sistema valida el token
3. Si es válido: marca usuario como verificado y redirige a login con mensaje de éxito
4. Si es inválido o expirado: redirige a login con mensaje de error

### Primer Login

1. Usuario intenta iniciar sesión
2. Si email no está verificado: muestra error y formulario para reenviar email
3. Si email está verificado: permite el acceso

### Reenvío de Verificación

1. Usuario ingresa su email en el formulario de reenvío
2. Sistema genera nuevo token
3. Sistema envía nuevo email de verificación
4. Usuario recibe mensaje de éxito

## Configuración Requerida

### Variables de Entorno (`.env.local`)

```env
# URL pública de la aplicación (para enlaces de verificación en emails)
# En producción/staging usa tu dominio real para que los enlaces no apunten a localhost
APP_URL=https://tu-dominio.com
# Alternativa: NEXTAUTH_URL (se usa si APP_URL no está definida)
# NEXTAUTH_URL=http://localhost:3000   # solo desarrollo local

# Configuración de Brevo
BREVO_API_KEY=tu_api_key
BREVO_FROM_EMAIL=tu_email@dominio.com
BREVO_FROM_NAME=Tu Nombre
```

### Dependencias

- `sib-api-v3-sdk`: SDK de Brevo para envío de emails (ya instalado)
- `crypto`: Nativo de Node.js (generación de tokens)

## Seguridad

- **Tokens únicos y seguros:** Se usan 32 bytes aleatorios (crypto.randomBytes)
- **Expiración de tokens:** 24 horas de validez
- **No exposición de información:** La API no revela si un email existe
- **Limpieza de tokens:** Se eliminan después de usarse
- **Password protegido:** No se incluye en las respuestas

## Estructura de Email de Verificación

El email incluye:

- Saludo personalizado con nombre del usuario
- Instrucciones claras
- Botón/enlace de verificación prominente
- Información de expiración (24 horas)
- Nota de seguridad si no solicitó la cuenta

## Pruebas Recomendadas

1. **Registro exitoso:**
   - Crear usuario nuevo
   - Verificar que llega el email
   - Hacer clic en enlace de verificación
   - Confirmar que puede iniciar sesión

2. **Token expirado:**
   - Esperar 24 horas o modificar manualmente en BD
   - Intentar verificar con token expirado
   - Verificar mensaje de error apropiado

3. **Token inválido:**
   - Usar un token incorrecto en la URL
   - Verificar mensaje de error

4. **Login sin verificar:**
   - Crear usuario pero no verificar email
   - Intentar iniciar sesión
   - Verificar que muestra error y formulario de reenvío

5. **Reenvío de verificación:**
   - Usar formulario de reenvío
   - Verificar que llega nuevo email
   - Confirmar que funciona el nuevo enlace

## Próximas Mejoras Sugeridas

- [ ] Agregar recordatorio automático después de X días sin verificar
- [ ] Dashboard de administración para ver usuarios no verificados
- [ ] Personalización de templates de email
- [ ] Estadísticas de verificación
- [ ] Rate limiting para reenvío de emails
- [ ] Soporte para cambio de email con verificación

## Soporte

Si tienes problemas:

1. Verifica que Brevo API Key sea válida
2. Revisa los logs del servidor para errores de email
3. Confirma que NEXTAUTH_URL esté correctamente configurado
4. Verifica la conexión a MongoDB
