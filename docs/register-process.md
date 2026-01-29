# Documentación: Proceso de Registro

## Archivo

`app/register/page.js`

## Descripción General

Página de registro que permite a nuevos usuarios crear una cuenta en la aplicación. Implementa validación de formularios y manejo de errores en tiempo real.

## Características Principales

### Componente Principal: `Register`

- Componente de cliente (Client Component)
- Utiliza el patrón de Server Actions de Next.js para el envío de formularios
- Maneja el estado del formulario con `useActionState`

## Flujo del Proceso

### 1. Inicialización del Estado

El componente inicializa el estado usando `useActionState` con la acción `crearUsuario`:

**Estado Inicial:**

```javascript
{
  values: {
    name: "",
    email: "",
    password: ""
  },
  errors: {
    name: null,
    email: null,
    password: null
  },
  success: null,
  error: null
}
```

### 2. Renderizado del Formulario

#### Campos del Formulario

1. **Nombre completo**
   - Tipo: text
   - Campo requerido
   - Preserva el valor ingresado en caso de error
   - Placeholder: "Tu nombre completo"

2. **Email**
   - Tipo: email
   - Campo requerido
   - Validación nativa HTML5
   - Preserva el valor ingresado en caso de error
   - Placeholder: "Tu email"

3. **Contraseña**
   - Tipo: password
   - Campo requerido
   - Preserva el valor ingresado en caso de error
   - Placeholder: "Tu contraseña"

### 3. Proceso de Envío

#### Al hacer clic en "Registrarse"

1. **Prevención del comportamiento por defecto:**
   - Next.js intercepta el envío del formulario
   - Los datos se envían a través de la Server Action

2. **Ejecución de la acción:**
   - Se llama a `crearUsuario` con los datos del formulario
   - `isPending` se establece en `true`
   - Muestra mensaje "Creando usuario..."

3. **Procesamiento en el servidor:**
   - Validación de datos (manejado por `crearUsuario-action`)
   - Verificación de email duplicado
   - Hash de contraseña
   - Creación del usuario en base de datos
   - Envío de email de verificación (si aplica)

### 4. Respuestas del Servidor

#### Caso: Registro Exitoso

```javascript
{
  success: "Usuario creado exitosamente. Por favor verifica tu email.",
  error: null,
  errors: { name: null, email: null, password: null },
  values: { name: "", email: "", password: "" } // Limpia el formulario
}
```

- Muestra mensaje de éxito en verde
- El formulario puede limpiarse o redirigir al usuario

#### Caso: Errores de Validación por Campo

```javascript
{
  success: null,
  error: null,
  errors: {
    name: "El nombre es requerido",
    email: "Email inválido",
    password: "La contraseña debe tener al menos 8 caracteres"
  },
  values: { name: "Juan", email: "juan@", password: "123" } // Preserva valores
}
```

- Muestra errores específicos debajo de cada campo
- Preserva los valores ingresados

#### Caso: Error General

```javascript
{
  success: null,
  error: "El email ya está registrado",
  errors: { name: null, email: null, password: null },
  values: { name: "Juan", email: "juan@example.com", password: "12345678" }
}
```

- Muestra mensaje de error general en rojo
- Preserva los valores ingresados

## Estados del Componente

### Estado del Formulario (via useActionState)

- **values:** Objeto con los valores actuales del formulario
- **errors:** Objeto con errores específicos por campo
- **success:** Mensaje de éxito general
- **error:** Mensaje de error general
- **isPending:** Boolean que indica si la acción está en progreso

### Indicadores Visuales

Durante el envío (`isPending === true`):

- Botón muestra "Registrarse" (sin cambio visual específico)
- Muestra mensaje "Creando usuario..." en estado pendiente

## Interfaz de Usuario

### Sección de Mensajes

Muestra dinámicamente:

1. **Errores por campo** (si existen):
   - Error de nombre
   - Error de email
   - Error de contraseña

2. **Error general** (si existe):
   - Mostrado en estilo de error

3. **Mensaje de éxito** (si existe):
   - Mostrado en estilo de éxito

4. **Estado de carga** (cuando `isPending`):
   - "Creando usuario..."

### Navegación

- **Link a Login:** "¿Ya tienes una cuenta? Inicia sesión"
  - Redirecciona a `/login`

## Integración con API

### Server Action: `crearUsuario`

- **Origen:** `@/actions/crearUsuario-action`
- **Tipo:** Server Action de Next.js
- **Datos recibidos:**
  ```javascript
  FormData {
    name: string,
    email: string,
    password: string
  }
  ```
- **Validaciones esperadas:**
  - Nombre: no vacío
  - Email: formato válido, no duplicado
  - Contraseña: mínimo 8 caracteres (o según política)

## Estilos

Utiliza módulos CSS importados desde `./page.module.css`:

- `register`: contenedor principal
- `formContainer`: contenedor del formulario
- `title`: título "Crear Cuenta"
- `subtitle`: subtítulo "Regístrate para comenzar"
- `form`: formulario
- `input`: campos de entrada
- `submitButton`: botón de envío
- `messages`: contenedor de mensajes
- `error`: estilo para mensajes de error (rojo)
- `success`: estilo para mensajes de éxito (verde)
- `pending`: estilo para estado de carga
- `loginLink`: enlace al login

## Flujo Completo de Casos de Uso

### Caso 1: Registro Exitoso

1. Usuario ingresa nombre, email y contraseña válidos
2. Hace clic en "Registrarse"
3. Sistema valida los datos
4. Email no existe en base de datos
5. Se crea el usuario con contraseña hasheada
6. Se envía email de verificación
7. Muestra mensaje de éxito
8. Usuario debe verificar su email antes de iniciar sesión

### Caso 2: Email Duplicado

1. Usuario ingresa email ya registrado
2. Hace clic en "Registrarse"
3. Sistema detecta email duplicado
4. Muestra error: "El email ya está registrado"
5. Preserva los datos ingresados excepto contraseña (por seguridad)
6. Usuario puede corregir el email o ir a login

### Caso 3: Validación de Campos

1. Usuario ingresa datos inválidos
2. Hace clic en "Registrarse"
3. Sistema valida cada campo
4. Muestra errores específicos bajo cada campo inválido
5. Preserva los valores ingresados
6. Usuario corrige los errores
7. Reenvía el formulario

### Caso 4: Error de Servidor

1. Usuario completa el formulario correctamente
2. Ocurre un error en el servidor (conexión BD, email service, etc.)
3. Muestra mensaje de error general
4. Usuario puede intentar nuevamente

## Dependencias

- `next/link`: navegación a la página de login
- `react`: hook `useActionState`
- `@/actions/crearUsuario-action`: Server Action para crear usuario

## Seguridad y Mejores Prácticas

### Implementadas

- Validación en cliente con HTML5 (`required`, `type="email"`)
- Validación en servidor (en la Server Action)
- Preservación de valores en caso de error (UX)
- Server Actions para evitar exposición de lógica

### Consideraciones Adicionales

- Las contraseñas deben hashearse en el servidor (bcrypt/argon2)
- Implementar rate limiting para prevenir spam
- Validar formato y fortaleza de contraseñas
- Sanitizar inputs para prevenir XSS
- Implementar CAPTCHA para prevenir bots
- Verificación de email obligatoria antes de acceso completo

## Mejoras Sugeridas

1. **Indicador de fortaleza de contraseña** en tiempo real
2. **Confirmación de contraseña** (segundo campo)
3. **Validación en tiempo real** mientras el usuario escribe
4. **Deshabilitar botón** durante `isPending`
5. **Términos y condiciones** checkbox
6. **Redirección automática** tras registro exitoso a página de "Verifica tu email"
7. **Timeout de sesión** para el token de verificación
