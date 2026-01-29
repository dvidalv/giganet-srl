# Documentación: Proceso de Login

## Archivo

`app/login/page.js`

## Descripción General

Página de inicio de sesión que permite a los usuarios autenticarse en la aplicación. Incluye manejo de verificación de email, reenvío de correos de verificación y redirección post-login.

## Características Principales

### 1. **Componente Principal: `Login`**

- Componente exportado por defecto que envuelve `LoginForm` en un `Suspense`
- Muestra un mensaje de carga mientras se resuelven los parámetros de búsqueda

### 2. **Componente Interno: `LoginForm`**

Maneja toda la lógica del formulario de inicio de sesión.

## Flujo del Proceso

### Inicialización

1. **Obtención de Parámetros URL:**
   - `callbackUrl`: URL de redirección después del login exitoso (default: `/dashboard`)
   - `verified`: Indica si el email fue verificado exitosamente
   - `error`: Código de error de verificación si existe

2. **Estado del Formulario:**
   - Utiliza `useActionState` con la acción `loginUsuario`
   - Estado inicial: `{ error: null, success: null, redirect: null }`

### Mensajes de Verificación

El componente muestra diferentes mensajes basados en los parámetros URL:

- `verified=true` → "¡Email verificado correctamente! Ya puedes iniciar sesión."
- `error=token-missing` → "Token de verificación no proporcionado."
- `error=token-invalid` → "Token de verificación inválido o expirado."
- `error=verification-failed` → "Error al verificar el email. Por favor intenta de nuevo."

### Formulario de Login

**Campos:**

- Email (requerido)
- Contraseña (requerido)
- `callbackUrl` (campo oculto)

**Acciones:**

- Botón "Iniciar Sesión" que ejecuta la acción `loginUsuario`
- Link a "¿Olvidaste tu contraseña?" → `/forgot-password`
- Link a "Regístrate" → `/register`

### Funcionalidad de Reenvío de Verificación

#### Cuándo se muestra

Se activa cuando el error de login indica que el email no está verificado (detecta "verifica tu email" en el mensaje de error).

#### Proceso de Reenvío (`handleResendVerification`)

1. Usuario ingresa su email
2. Se envía petición POST a `/api/auth/resend-verification`
3. **Estados durante el proceso:**
   - `isResending: true` → Muestra "Enviando..."
   - Limpia mensajes previos
4. **Respuesta exitosa:**
   - Muestra mensaje de éxito
   - Limpia el campo de email
5. **Respuesta con error:**
   - Muestra mensaje de error específico
6. **Error de red:**
   - Muestra "Error al enviar el email de verificación"

## Estados del Componente

### Estados Locales

```javascript
- resendEmail: string (email para reenvío)
- resendMessage: { type: 'success' | 'error', text: string } | null
- isResending: boolean (estado de carga del reenvío)
```

### Estados del Formulario (via useActionState)

```javascript
- state.error: mensaje de error del login
- state.success: mensaje de éxito del login
- state.redirect: URL de redirección (si aplica)
- isPending: indica si la acción está en progreso
```

## Integración con API

### Endpoint de Login

- **Acción:** `loginUsuario` (desde `@/actions/loginUsuario-action`)
- **Método:** Server Action de Next.js
- **Datos enviados:**
  - email
  - password
  - callbackUrl

### Endpoint de Reenvío de Verificación

- **URL:** `/api/auth/resend-verification`
- **Método:** POST
- **Body:** `{ email: string }`
- **Respuestas:**
  - `200 OK`: `{ message: string }`
  - `4xx/5xx`: `{ error: string }`

## Estilos

Utiliza módulos CSS importados desde `./page.module.css` con las siguientes clases:

- `login`: contenedor principal
- `formContainer`: contenedor del formulario
- `title`, `subtitle`: encabezados
- `form`: formulario
- `input`: campos de entrada
- `submitButton`: botón principal
- `forgotPasswordLink`: enlace de contraseña olvidada
- `messages`: contenedor de mensajes
- `success`, `error`, `pending`: estilos de estado
- `resendSection`, `resendForm`, `resendButton`, `resendTitle`: sección de reenvío

## Casos de Uso

### Caso 1: Login Exitoso

1. Usuario ingresa credenciales válidas
2. Email está verificado
3. Sistema autentica al usuario
4. Redirección a `callbackUrl` o `/dashboard`

### Caso 2: Email No Verificado

1. Usuario intenta login
2. Sistema detecta email no verificado
3. Muestra error y sección de reenvío
4. Usuario puede solicitar nuevo email de verificación

### Caso 3: Verificación desde Email

1. Usuario hace clic en link de verificación en email
2. Redirección a `/login?verified=true`
3. Muestra mensaje de éxito
4. Usuario puede iniciar sesión

### Caso 4: Token de Verificación Inválido

1. Link de verificación expira o es inválido
2. Redirección a `/login?error=token-invalid`
3. Muestra mensaje de error
4. Usuario puede solicitar nuevo email

## Dependencias

- `next/link`: navegación entre páginas
- `next/navigation`: hook `useSearchParams`
- `react`: hooks `useActionState`, `useState`, `Suspense`
- `@/actions/loginUsuario-action`: acción de login

## Seguridad

- Validación de campos requeridos en frontend
- Autenticación manejada por server action
- Tokens de verificación con expiración
- Mensajes de error genéricos para proteger información sensible
