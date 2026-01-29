# Documentación: Proceso de Recuperación de Contraseña

## Archivos

- **Frontend:** `app/forgot-password/page.js`
- **API:** `app/api/auth/forgot-password/route.js`

## Descripción General

Página que permite a los usuarios solicitar el restablecimiento de su contraseña mediante el envío de un email con instrucciones. Implementa un flujo simple y seguro para la recuperación de contraseñas olvidadas. Por seguridad, **nunca se revela si el email existe o no**; siempre se devuelve el mismo mensaje genérico en caso de éxito.

## Características Principales

### Componente Principal: `ForgotPassword`

- Componente de cliente (Client Component)
- Maneja el estado del formulario con hooks nativos de React
- Realiza petición directa a API endpoint

## Flujo del Proceso

### 1. Inicialización del Estado

**Estados Locales:**

```javascript
- email: "" (string) - Email del usuario
- message: null (object | null) - Mensaje de respuesta
- isLoading: false (boolean) - Estado de carga
```

### 2. Interfaz de Usuario

#### Formulario

**Campos:**

- **Email**
  - Tipo: email
  - Campo requerido
  - Validación nativa HTML5
  - Placeholder: "Tu email"
  - Valor controlado (`value={email}`)

**Botón de Envío:**

- Texto normal: "Enviar instrucciones"
- Durante carga: "Enviando..."
- Se deshabilita cuando `isLoading === true`

#### Navegación

- Link "Volver al inicio de sesión" → `/login`

### 3. Proceso de Envío del Formulario

#### Función: `handleSubmit`

**Paso 1: Inicialización**

```javascript
e.preventDefault(); // Previene recarga de página
setIsLoading(true); // Activa estado de carga
setMessage(null); // Limpia mensajes previos
```

**Paso 2: Petición al API**

- **Endpoint:** `/api/auth/forgot-password`
- **Método:** POST
- **Headers:** `Content-Type: application/json`
- **Body:** `{ email: string }`

**Paso 3: Procesamiento de Respuesta**

##### Respuesta Exitosa (200 OK)

```javascript
{
  message: "Si el email existe, recibirás instrucciones para resetear tu contraseña";
}
```

(Se usa el mismo mensaje tanto si el usuario existe como si no, para evitar enumeración de usuarios.)

**Acciones:**

- Establece `message = { type: "success", text: data.message }`
- Limpia el campo email: `setEmail("")`
- Muestra mensaje de éxito al usuario

##### Respuesta con Error (4xx/5xx)

```javascript
{
  error: "Email es requerido";
} // 400
{
  error: "Error al enviar el email de reseteo. Por favor, inténtalo de nuevo.";
} // 500 (fallo envío email)
{
  error: "Error al procesar la solicitud";
} // 500 (otro error)
```

**Acciones:**

- Establece `message = { type: "error", text: data.error || "Error al procesar la solicitud" }`
- Muestra mensaje de error al usuario
- El campo email NO se limpia (permite corrección)

##### Error de Red/Catch

```javascript
catch (error) {
  message = { type: "error", text: "Error al enviar la solicitud" }
}
```

**Acciones:**

- Muestra error genérico
- Útil para problemas de conectividad

**Paso 4: Finalización**

```javascript
finally {
  setIsLoading(false) // Desactiva estado de carga
}
```

## Estados del Componente

### Estados de Carga

| Estado     | isLoading | Botón                    | Campo Email         |
| ---------- | --------- | ------------------------ | ------------------- |
| Inicial    | false     | "Enviar instrucciones"   | Habilitado          |
| Enviando   | true      | "Enviando..." (disabled) | Habilitado          |
| Completado | false     | "Enviar instrucciones"   | Limpiado (si éxito) |

### Tipos de Mensajes

```javascript
message: {
  type: "success" | "error",
  text: string
}
```

## Integración con API

### Endpoint: `/api/auth/forgot-password`

#### Request

```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "usuario@ejemplo.com"
}
```

#### Response - Éxito (200)

Siempre el mismo mensaje, **sin revelar si el email existe o no**:

```json
{
  "message": "Si el email existe, recibirás instrucciones para resetear tu contraseña"
}
```

Se devuelve 200 tanto cuando el usuario existe como cuando no (prevención de enumeración).

#### Response - Error (400)

```json
{
  "error": "Email es requerido"
}
```

#### Response - Error del Servidor (500)

**Fallo al enviar el email (p. ej. Brevo caído):**

```json
{
  "error": "Error al enviar el email de reseteo. Por favor, inténtalo de nuevo."
}
```

**Otros errores (BD, JSON inválido, etc.):**

```json
{
  "error": "Error al procesar la solicitud"
}
```

### Proceso en el Backend (implementado)

1. Recibe y valida el email (400 si falta).
2. Busca usuario en BD por `email` (normalizado a minúsculas y trim).
3. **Si no existe:** responde 200 con el mensaje genérico (no se revela que no existe).
4. **Si existe:**
   - Genera token de 32 bytes (hex) y expiración 1 hora, **solo en memoria**.
   - Construye `baseUrl` con `host` y `x-forwarded-proto` y el link `{baseUrl}/reset-password?token=...`.
   - **Intenta enviar el email** con `sendEmail` (Brevo).
   - **Si el envío falla:** se hace `return` 500 con mensaje de error. **No se guarda el token**; el usuario puede reintentar.
   - **Si el envío tiene éxito:** se guardan `resetPasswordToken` y `resetPasswordExpires` en el usuario y se responde 200 con el mensaje genérico.

**Importante:** El token solo se persiste **después** de que el email se envía correctamente. Así se evita guardar tokens huérfanos y no hace falta rollback si el envío falla.

**Dependencias del API:** `User` (modelo MongoDB), `sendEmail` (`@/api-mail_brevo`), `crypto`, `headers` (Next.js).

## Estilos

Utiliza módulos CSS importados desde `./page.module.css`:

- `forgotPassword`: contenedor principal
- `formContainer`: contenedor del formulario
- `title`: título "¿Olvidaste tu contraseña?"
- `subtitle`: texto explicativo
- `form`: formulario
- `input`: campo de entrada de email
- `submitButton`: botón de envío
- `messages`: contenedor de mensajes
- `success`: estilo para mensajes exitosos (verde)
- `error`: estilo para mensajes de error (rojo)
- `backLink`: enlace de navegación

## Casos de Uso Completos

### Caso 1: Recuperación Exitosa

1. Usuario ingresa su email registrado
2. Hace clic en "Enviar instrucciones"
3. Sistema valida que el email existe
4. Genera token en memoria y envía email con link de restablecimiento
5. Si el envío tiene éxito, guarda token y expiración en BD
6. Responde 200 con mensaje genérico; el frontend muestra éxito y limpia el email
7. Usuario revisa su correo, hace clic en el link y es redirigido a `/reset-password?token=XXXXX`

### Caso 2: Email No Registrado

1. Usuario ingresa email no existente
2. Hace clic en "Enviar instrucciones"
3. Sistema verifica que el email no existe
4. Responde 200 con el **mismo mensaje genérico** que cuando sí existe: "Si el email existe, recibirás instrucciones..."
5. Previene enumeración de usuarios; el usuario no puede saber si debe registrarse o solo revisar su correo

### Caso 3: Error de Conexión

1. Usuario ingresa email válido
2. Hace clic en "Enviar instrucciones"
3. Falla la conexión al servidor
4. Se ejecuta el bloque catch
5. Muestra "Error al enviar la solicitud"
6. Email se mantiene en el campo
7. Usuario puede intentar nuevamente

### Caso 4: Error del Servicio de Email

1. Usuario ingresa email válido
2. Sistema encuentra el usuario
3. Genera token en memoria y intenta enviar el email
4. Falla el envío (p. ej. Brevo caído, límite excedido)
5. **No se guarda el token** en BD
6. Backend devuelve 500: "Error al enviar el email de reseteo. Por favor, inténtalo de nuevo."
7. Frontend muestra ese mensaje de error
8. Usuario puede reintentar; en el siguiente intento se generará un token nuevo y se intentará el envío de nuevo

### Caso 5: Múltiples Intentos

1. Usuario solicita recuperación
2. No recibe el email inmediatamente (o falló el envío)
3. Intenta enviar nuevamente
4. En cada intento exitoso se genera un **nuevo token** y se guarda (el anterior se sobrescribe si existía)
5. Rate limiting no implementado; se recomienda añadirlo para prevenir spam

## Seguridad y Mejores Prácticas

### Implementadas

- Validación de formato de email (HTML5) y email requerido en API
- Feedback visual durante el proceso (isLoading, mensajes éxito/error)
- Manejo de errores robusto: try-catch en envío de email; nunca se indica éxito si el email falla
- Token solo persistido tras envío exitoso; sin rollback ni tokens huérfanos
- Limpieza de estado entre intentos (éxito) y mensaje genérico para evitar enumeración de usuarios

### Consideraciones de Seguridad

#### 1. **Prevención de Enumeración de Usuarios**

- No revelar si el email existe o no
- Mismo mensaje para usuarios existentes y no existentes
- Mismo tiempo de respuesta

#### 2. **Rate Limiting**

- Limitar intentos por IP
- Limitar intentos por email
- Prevenir spam de solicitudes
- _(No implementado actualmente)_

#### 3. **Tokens Seguros**

- Tokens con `crypto.randomBytes(32).toString('hex')` (64 caracteres hex)
- Tokens únicos y no predecibles
- Solo se persisten **tras envío correcto del email**; si el envío falla, no se guardan

#### 4. **Expiración de Tokens**

- Expiración de 1 hora (`resetPasswordExpires`)
- Un solo uso (invalidar después de usar en reset-password)
- Al reintentar, se genera nuevo token y se sobrescribe el anterior

#### 5. **Protección del Email**

- No exponer email completo en mensajes públicos
- Verificar que el dominio del email sea válido

## Dependencias

- `next/link`: navegación a la página de login
- `react`: hooks `useState`

## Flujo de Email

El envío se realiza con **Brevo** (`sendEmail` en `api-mail_brevo.js`). Si falla, se loguea el error, se responde 500 y **no se guarda el token**.

### Contenido del Email (implementado)

- **Asunto:** "Resetear tu contraseña"
- **HTML:** Saludo con `user.name`, párrafo explicativo, botón "Resetear Contraseña" con `resetUrl`, aviso de expiración 1 h y nota de ignorar si no lo solicitó.
- **Texto plano:** "Hola {name}! Para resetear tu contraseña, visita: {resetUrl}"

### Link generado

`{baseUrl}/reset-password?token={resetPasswordToken}`

`baseUrl` se obtiene de `host` y `x-forwarded-proto` (o `http` por defecto). El token es un hex de 64 caracteres.

## Mejoras Sugeridas

1. **CAPTCHA/reCAPTCHA**
   - Prevenir bots y solicitudes automatizadas

2. **Confirmación Visual Mejorada**
   - Animación de éxito
   - Contador de reenvío

3. **Información de Seguridad**
   - Mostrar cuándo expira el link
   - Indicar que solo se puede usar una vez

4. **Reenvío Controlado**
   - Botón para reenviar después de X minutos
   - Mensaje si ya existe una solicitud activa

5. **Logging y Auditoría**
   - Registrar intentos de recuperación
   - Alertas por actividad sospechosa

6. **Notificación de Seguridad**
   - Enviar email adicional notificando la solicitud
   - Incluir información de IP/ubicación

7. **Validación Adicional**
   - Verificar formato de email antes de enviar
   - Mostrar errores en tiempo real

8. **Estado Persistente**
   - Guardar en localStorage si se envió solicitud
   - Mostrar tiempo restante para reenvío

---

**Última actualización:** Enero 2026 — Flujo actualizado: token solo persistido tras envío exitoso del email; try-catch en envío; mensajes de API documentados.
