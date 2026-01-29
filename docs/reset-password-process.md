# Documentación: Proceso de Restablecimiento de Contraseña

## Archivo

`app/reset-password/page.js`

## Descripción General

Página que permite a los usuarios establecer una nueva contraseña después de haber solicitado la recuperación mediante el proceso de forgot-password. Requiere un token válido enviado por email y valida que ambas contraseñas coincidan antes de procesar el cambio.

## Características Principales

### Componente Principal: `ResetPassword`

- Componente de cliente (Client Component)
- Envuelve `ResetPasswordForm` en un `Suspense` para manejar la carga de parámetros URL
- Muestra mensaje de carga mientras se resuelven los parámetros

### Componente Interno: `ResetPasswordForm`

Maneja toda la lógica del formulario de restablecimiento.

## Flujo del Proceso

### 1. Inicialización y Obtención del Token

**Parámetros URL:**

```javascript
const token = searchParams.get("token");
// Ejemplo: /reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Estados Locales:**

```javascript
- password: "" (string) - Nueva contraseña
- confirmPassword: "" (string) - Confirmación de contraseña
- message: null (object | null) - Mensaje de respuesta
- isLoading: false (boolean) - Estado de carga
- passwordsMatch: true (boolean) - Validación en tiempo real
```

### 2. Validación Inicial del Token

Si el token NO está presente en la URL:

- Renderiza vista de error
- Muestra: "Token no proporcionado"
- Botón "Volver al inicio de sesión"
- NO muestra el formulario

### 3. Validación en Tiempo Real de Contraseñas

**Hook useEffect:**

```javascript
useEffect(() => {
  if (confirmPassword) {
    setPasswordsMatch(password === confirmPassword);
  }
}, [password, confirmPassword]);
```

**Comportamiento:**

- Se ejecuta cada vez que cambia `password` o `confirmPassword`
- Solo valida si `confirmPassword` tiene contenido
- Actualiza `passwordsMatch` instantáneamente
- Muestra feedback visual en el segundo campo

### 4. Interfaz de Usuario

#### Formulario

**Campo 1: Nueva Contraseña**

- Tipo: password
- Campo requerido
- Atributo `minLength={8}`
- Hint: "Mínimo 8 caracteres"
- Valor controlado (`value={password}`)

**Campo 2: Confirmar Contraseña**

- Tipo: password
- Campo requerido
- Validación visual en tiempo real
- Clase dinámica: `inputError` si no coinciden
- Mensaje de error: "Las contraseñas no coinciden"
- Valor controlado (`value={confirmPassword}`)

**Botón de Envío:**

- Texto normal: "Resetear contraseña"
- Durante carga: "Reseteando..."
- **Deshabilitado cuando:**
  - `isLoading === true`
  - `passwordsMatch === false`

#### Navegación

- Link "Volver al inicio de sesión" → `/login`

### 5. Proceso de Envío del Formulario

#### Función: `handleSubmit`

**Validaciones Pre-envío:**

1. **Verificación de Token**

```javascript
if (!token) {
  setMessage({ type: "error", text: "Token no proporcionado" });
  return;
}
```

2. **Verificación de Coincidencia**

```javascript
if (password !== confirmPassword) {
  setMessage({ type: "error", text: "Las contraseñas no coinciden" });
  return;
}
```

3. **Validación de Longitud**

```javascript
if (password.length < 8) {
  setMessage({
    type: "error",
    text: "La contraseña debe tener al menos 8 caracteres",
  });
  return;
}
```

**Petición al API:**

```javascript
setIsLoading(true);
setMessage(null);

fetch("/api/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token, password }),
});
```

### 6. Respuestas del Servidor

#### Caso: Restablecimiento Exitoso (200 OK)

```javascript
{
  message: "Contraseña actualizada exitosamente";
}
```

**Acciones:**

1. Muestra mensaje de éxito
2. Limpia ambos campos de contraseña
3. Inicia temporizador de 3 segundos
4. Redirige automáticamente a `/login`

```javascript
setMessage({ type: "success", text: data.message });
setPassword("");
setConfirmPassword("");

setTimeout(() => {
  window.location.href = "/login";
}, 3000);
```

#### Caso: Token Inválido o Expirado (401/400)

```javascript
{
  error: "Token inválido o expirado";
}
```

**Acciones:**

- Muestra mensaje de error
- Usuario puede solicitar nuevo email en forgot-password

#### Caso: Error del Servidor (500)

```javascript
{
  error: "Error al resetear la contraseña";
}
```

**Acciones:**

- Muestra error genérico
- Usuario puede intentar nuevamente

#### Caso: Error de Red

```javascript
catch (error) {
  message = { type: "error", text: "Error al procesar la solicitud" }
}
```

## Estados del Componente

### Matriz de Estados

| Estado                   | isLoading | passwordsMatch | Botón         | Acción           |
| ------------------------ | --------- | -------------- | ------------- | ---------------- |
| Inicial                  | false     | true           | Habilitado    | Puede enviar     |
| Contraseñas no coinciden | false     | false          | Deshabilitado | No puede enviar  |
| Enviando                 | true      | true           | Deshabilitado | Procesando       |
| Éxito                    | false     | true           | Habilitado    | Redirigiendo...  |
| Error                    | false     | varies         | Según match   | Puede reintentar |

### Feedback Visual por Estado

1. **Contraseñas no coinciden:**
   - Campo confirmPassword con clase `inputError`
   - Mensaje rojo: "Las contraseñas no coinciden"
   - Botón deshabilitado

2. **Durante envío:**
   - Botón muestra "Reseteando..."
   - Botón deshabilitado
   - Mensaje anterior oculto

3. **Éxito:**
   - Mensaje verde de confirmación
   - "Redirigiendo a login..." (implícito por el timeout)

4. **Error:**
   - Mensaje rojo con el error específico

## Integración con API

### Endpoint: `/api/auth/reset-password`

#### Request

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "password": "nuevaContraseña123"
}
```

#### Response - Éxito (200)

```json
{
  "message": "Contraseña actualizada exitosamente"
}
```

#### Response - Token Inválido (401)

```json
{
  "error": "Token inválido o expirado"
}
```

#### Response - Token Usado (400)

```json
{
  "error": "Este link ya fue utilizado"
}
```

#### Response - Error Servidor (500)

```json
{
  "error": "Error al resetear la contraseña"
}
```

### Proceso en el Backend (esperado)

1. **Recibe token y nueva contraseña**
2. **Valida el token:**
   - Verifica firma/integridad
   - Verifica que no haya expirado
   - Verifica que no haya sido usado
3. **Obtiene usuario asociado al token**
4. **Hashea la nueva contraseña** (bcrypt/argon2)
5. **Actualiza contraseña en BD**
6. **Invalida el token** (marca como usado)
7. **Opcional:** Envía email de confirmación del cambio
8. **Opcional:** Invalida sesiones activas

## Estilos

Utiliza módulos CSS importados desde `./page.module.css`:

- `resetPassword`: contenedor principal
- `formContainer`: contenedor del formulario
- `title`: título "Resetear Contraseña"
- `subtitle`: subtítulo "Ingresa tu nueva contraseña"
- `form`: formulario
- `input`: campos de entrada de contraseña
- `inputError`: clase adicional cuando las contraseñas no coinciden
- `hint`: texto de ayuda ("Mínimo 8 caracteres")
- `errorHint`: mensaje de error inline ("Las contraseñas no coinciden")
- `submitButton`: botón de envío
- `messages`: contenedor de mensajes
- `success`: estilo para mensajes exitosos (verde)
- `error`: estilo para mensajes de error (rojo)
- `backLink`: enlace de navegación

## Casos de Uso Completos

### Caso 1: Restablecimiento Exitoso

1. Usuario recibe email con link de recuperación
2. Hace clic en el link → `/reset-password?token=XXXXX`
3. Página valida que el token existe
4. Usuario ingresa nueva contraseña (ej: "MiNueva123")
5. Usuario confirma contraseña (ej: "MiNueva123")
6. Sistema valida en tiempo real que coinciden ✓
7. Usuario hace clic en "Resetear contraseña"
8. Validaciones locales pasan (longitud ≥8, coinciden)
9. Se envía petición al backend
10. Backend valida token, actualiza contraseña
11. Muestra mensaje de éxito
12. Después de 3 segundos, redirige a `/login`
13. Usuario puede iniciar sesión con nueva contraseña

### Caso 2: Contraseñas No Coinciden

1. Usuario llega a la página con token válido
2. Ingresa contraseña: "MiNueva123"
3. Ingresa confirmación: "MiNueva124" (typo)
4. Campo de confirmación se pone rojo
5. Muestra mensaje: "Las contraseñas no coinciden"
6. Botón "Resetear contraseña" está deshabilitado
7. Usuario corrige la confirmación: "MiNueva123"
8. Campo vuelve a estilo normal
9. Mensaje de error desaparece
10. Botón se habilita
11. Usuario puede continuar

### Caso 3: Contraseña Muy Corta

1. Usuario ingresa contraseña: "corta1"
2. Confirma contraseña: "corta1"
3. Validación visual pasa (coinciden)
4. Hace clic en "Resetear contraseña"
5. Validación local detecta longitud < 8
6. Muestra error: "La contraseña debe tener al menos 8 caracteres"
7. Usuario ingresa contraseña más larga
8. Reintenta el envío

### Caso 4: Token Inválido o Expirado

1. Usuario hace clic en link antiguo (>1 hora)
2. Página carga con token en URL
3. Usuario completa formulario correctamente
4. Hace clic en "Resetear contraseña"
5. Backend valida el token
6. Token ha expirado o es inválido
7. Devuelve error 401
8. Muestra: "Token inválido o expirado"
9. Usuario debe volver a `/forgot-password`
10. Solicita nuevo email de recuperación

### Caso 5: Token Ya Usado

1. Usuario resetea contraseña exitosamente
2. No cierra el tab del navegador
3. Intenta usar el mismo link nuevamente
4. Token fue invalidado después del primer uso
5. Backend rechaza la petición
6. Muestra: "Este link ya fue utilizado"
7. Usuario puede ir a login con su nueva contraseña

### Caso 6: Sin Token en URL

1. Usuario intenta acceder directamente a `/reset-password`
2. URL no tiene parámetro `token`
3. Componente detecta ausencia de token
4. Renderiza vista de error
5. Muestra: "Token no proporcionado"
6. Solo muestra botón "Volver al inicio de sesión"
7. No muestra formulario

### Caso 7: Error de Red durante Envío

1. Usuario completa formulario correctamente
2. Hace clic en "Resetear contraseña"
3. Pierde conexión a internet
4. Fetch falla y cae en bloque catch
5. Muestra: "Error al procesar la solicitud"
6. Usuario recupera conexión
7. Puede intentar nuevamente

## Seguridad y Mejores Prácticas

### Implementadas

1. **Validación Multi-nivel:**
   - Frontend: longitud mínima, coincidencia
   - Backend: validación de token, hash seguro

2. **Feedback en Tiempo Real:**
   - Validación instantánea de coincidencia
   - Previene errores antes de enviar

3. **Tokens Seguros:**
   - Requiere token válido para acceder
   - Sin token = no hay formulario

4. **UX Mejorada:**
   - Redirección automática después de éxito
   - Deshabilita botón durante proceso
   - Mensajes claros y específicos

5. **Protección de Contraseñas:**
   - Input type="password" oculta caracteres
   - Limpieza de campos después de éxito

### Consideraciones Adicionales de Seguridad

1. **Tokens:**
   - Usar tokens criptográficamente seguros (JWT/crypto.randomBytes)
   - Expiración corta (15-60 minutos)
   - Un solo uso (invalidar después de usar)
   - Almacenar hash del token, no token plano

2. **Contraseñas:**
   - Hashear con bcrypt o argon2 (backend)
   - Validar fortaleza (mayúsculas, números, símbolos)
   - No almacenar nunca en texto plano
   - Salt único por contraseña

3. **Rate Limiting:**
   - Limitar intentos por IP
   - Prevenir ataques de fuerza bruta

4. **Auditoría:**
   - Registrar cambios de contraseña
   - Enviar email de notificación al usuario
   - Incluir IP y timestamp

5. **Sesiones:**
   - Invalidar todas las sesiones activas tras cambio
   - Requerir nuevo login en todos los dispositivos

6. **HTTPS:**
   - Siempre usar HTTPS en producción
   - Proteger tokens en tránsito

## Dependencias

- `next/link`: navegación a la página de login
- `next/navigation`: hook `useSearchParams`
- `react`: hooks `useState`, `useEffect`, `Suspense`

## Mejoras Sugeridas

1. **Indicador de Fortaleza de Contraseña:**
   - Barra visual de fortaleza
   - Criterios: mayúsculas, números, símbolos
   - Color: rojo (débil) → amarillo (media) → verde (fuerte)

2. **Requisitos Visibles:**
   - Lista de requisitos con checkmarks
   - ✓ Mínimo 8 caracteres
   - ✓ Al menos una mayúscula
   - ✓ Al menos un número

3. **Ver/Ocultar Contraseña:**
   - Icono de ojo para toggle
   - Permite verificar typos

4. **Progress Indicator:**
   - Barra de progreso durante el proceso
   - Pasos: Validando → Actualizando → Completado

5. **Confirmación por Email:**
   - Enviar email notificando el cambio
   - Incluir link para reportar actividad sospechosa

6. **Validación de Contraseña Anterior:**
   - Opcional: verificar que no sea la misma contraseña
   - Prevenir reutilización inmediata

7. **Contador de Redirección:**
   - "Redirigiendo en 3... 2... 1..."
   - Botón para ir inmediatamente

8. **Info de Seguridad:**
   - Mensaje sobre invalidación de sesiones
   - Aviso de que necesitará iniciar sesión nuevamente

9. **Manejo de Errores Mejorado:**
   - Diferentes mensajes para cada tipo de error de token
   - Sugerencias de acción para cada error

10. **Accesibilidad:**
    - Labels descriptivos
    - ARIA attributes
    - Anuncios de errores para screen readers
