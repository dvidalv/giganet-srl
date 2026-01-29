# Documentación: Proceso de Recuperación de Contraseña

## Archivo

`app/forgot-password/page.js`

## Descripción General

Página que permite a los usuarios solicitar el restablecimiento de su contraseña mediante el envío de un email con instrucciones. Implementa un flujo simple y seguro para la recuperación de contraseñas olvidadas.

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
  message: "Se ha enviado un email con instrucciones para resetear tu contraseña";
}
```

**Acciones:**

- Establece `message = { type: "success", text: data.message }`
- Limpia el campo email: `setEmail("")`
- Muestra mensaje de éxito al usuario

##### Respuesta con Error (4xx/5xx)

```javascript
{
  error: "Usuario no encontrado"; // u otro mensaje
}
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

```json
{
  "message": "Se ha enviado un email con instrucciones"
}
```

#### Response - Error Usuario No Encontrado (404)

```json
{
  "error": "Usuario no encontrado"
}
```

#### Response - Error del Servidor (500)

```json
{
  "error": "Error al enviar el email"
}
```

### Proceso en el Backend (esperado)

1. Recibe email del usuario
2. Busca usuario en base de datos
3. Si existe:
   - Genera token único de restablecimiento
   - Guarda token en BD con expiración (ej: 1 hora)
   - Envía email con link: `/reset-password?token=XXXXX`
4. Si no existe:
   - Por seguridad, puede devolver éxito o error según política

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
4. Genera token único de recuperación
5. Envía email con link de restablecimiento
6. Muestra mensaje de éxito
7. Campo email se limpia
8. Usuario revisa su correo
9. Hace clic en el link del email
10. Es redirigido a `/reset-password?token=XXXXX`

### Caso 2: Email No Registrado

1. Usuario ingresa email no existente
2. Hace clic en "Enviar instrucciones"
3. Sistema verifica que el email no existe
4. **Opción A (Segura):** Muestra mensaje genérico de éxito
   - Previene enumeración de usuarios
5. **Opción B (Transparente):** Muestra "Usuario no encontrado"
   - Permite al usuario saber que debe registrarse

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
3. Genera token correctamente
4. Falla el envío del email (servicio SMTP caído)
5. Backend devuelve error 500
6. Muestra mensaje de error al usuario
7. Usuario puede intentar más tarde

### Caso 5: Múltiples Intentos

1. Usuario solicita recuperación
2. No recibe el email inmediatamente
3. Intenta enviar nuevamente
4. Sistema puede:
   - Regenerar nuevo token
   - Mantener token anterior si no ha expirado
   - Implementar rate limiting para prevenir spam

## Seguridad y Mejores Prácticas

### Implementadas

- Validación de formato de email (HTML5)
- Feedback visual durante el proceso
- Manejo de errores robusto
- Limpieza de estado entre intentos

### Consideraciones de Seguridad

#### 1. **Prevención de Enumeración de Usuarios**

- No revelar si el email existe o no
- Mismo mensaje para usuarios existentes y no existentes
- Mismo tiempo de respuesta

#### 2. **Rate Limiting**

- Limitar intentos por IP
- Limitar intentos por email
- Prevenir spam de solicitudes

#### 3. **Tokens Seguros**

- Usar tokens criptográficamente seguros
- Tokens únicos y no predecibles
- Longitud mínima de 32 caracteres

#### 4. **Expiración de Tokens**

- Tokens con tiempo de vida limitado (15-60 minutos)
- Un solo uso (invalidar después de usar)
- Invalidar tokens antiguos al generar nuevos

#### 5. **Protección del Email**

- No exponer email completo en mensajes públicos
- Verificar que el dominio del email sea válido

## Dependencias

- `next/link`: navegación a la página de login
- `react`: hooks `useState`

## Flujo de Email

### Contenido del Email (ejemplo)

```
Asunto: Recuperación de Contraseña - Giganet

Hola,

Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para continuar:

[Restablecer Contraseña](https://tuapp.com/reset-password?token=XXXXXX)

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, ignora este email.

Saludos,
El equipo de Giganet
```

### Link Generado

```
https://tuapp.com/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

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
