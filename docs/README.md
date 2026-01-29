# Documentación del Sistema de Autenticación

Esta carpeta contiene la documentación detallada de los procesos de autenticación y gestión de usuarios de la aplicación Giganet.

## Índice de Documentos

### 1. [Login Process](./login-process.md)

**Archivo:** `app/login/page.js`

Documentación del proceso de inicio de sesión, incluyendo:

- Autenticación de usuarios
- Verificación de email
- Reenvío de emails de verificación
- Manejo de callbacks y redirecciones
- Mensajes de error y éxito

### 2. [Register Process](./register-process.md)

**Archivo:** `app/register/page.js`

Documentación del proceso de registro de nuevos usuarios:

- Creación de cuenta
- Validación de formularios
- Manejo de errores por campo
- Detección de emails duplicados
- Envío de email de verificación

### 3. [Forgot Password Process](./forgot-password-process.md)

**Archivo:** `app/forgot-password/page.js`

Documentación del proceso de recuperación de contraseña:

- Solicitud de restablecimiento
- Generación de tokens de recuperación
- Envío de emails con instrucciones
- Medidas de seguridad contra enumeración de usuarios

### 4. [Reset Password Process](./reset-password-process.md)

**Archivo:** `app/reset-password/page.js`

Documentación del proceso de restablecimiento de contraseña:

- Validación de tokens de recuperación
- Establecimiento de nueva contraseña
- Validación en tiempo real
- Redirección automática post-éxito
- Manejo de tokens expirados o inválidos

## Flujo Completo del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE AUTENTICACIÓN                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐
│   REGISTRO   │
│ /register    │
└──────┬───────┘
       │
       ├─> Crear cuenta
       ├─> Hashear contraseña
       ├─> Enviar email verificación
       │
       v
┌──────────────┐
│ Email Inbox  │
│  Verificar   │
└──────┬───────┘
       │
       ├─> Click link verificación
       │
       v
┌──────────────┐
│    LOGIN     │ <─────────┐
│   /login     │            │
└──────┬───────┘            │
       │                    │
       ├─> Autenticar       │
       ├─> Verificar email  │
       │   confirmado        │
       v                    │
┌──────────────┐            │
│  DASHBOARD   │            │
│ /dashboard   │            │
└──────────────┘            │
                            │
                            │
┌──────────────┐            │
│  ¿Olvidaste  │            │
│ contraseña?  │            │
│  /forgot-    │            │
│   password   │            │
└──────┬───────┘            │
       │                    │
       ├─> Solicitar reset  │
       ├─> Generar token    │
       ├─> Enviar email     │
       │                    │
       v                    │
┌──────────────┐            │
│ Email Inbox  │            │
│  Reset Link  │            │
└──────┬───────┘            │
       │                    │
       ├─> Click link       │
       │                    │
       v                    │
┌──────────────┐            │
│    RESET     │            │
│  PASSWORD    │            │
│   /reset-    │            │
│   password   │            │
│  ?token=XXX  │            │
└──────┬───────┘            │
       │                    │
       ├─> Nueva contraseña │
       ├─> Actualizar BD    │
       ├─> Invalidar token  │
       │                    │
       └────────────────────┘
```

## Características Comunes

Todos los procesos implementan:

- **Validación en múltiples niveles** (frontend y backend)
- **Manejo robusto de errores** con mensajes específicos
- **Estados de carga** para feedback visual
- **Seguridad** con tokens, hashing, y validaciones
- **UX optimizada** con validación en tiempo real
- **Accesibilidad** mediante formularios semánticos

## Tecnologías Utilizadas

- **Next.js 14+** (App Router)
- **React 18+** (Client Components, Hooks)
- **Server Actions** para mutaciones de datos
- **CSS Modules** para estilos aislados
- **API Routes** para endpoints REST

## Seguridad

### Implementado

- Validación de inputs en cliente y servidor
- Hashing de contraseñas (bcrypt/argon2)
- Tokens seguros con expiración
- Verificación de email obligatoria
- Rate limiting (recomendado en API)

### Recomendaciones Adicionales

- Implementar CAPTCHA en formularios públicos
- Logging y auditoría de eventos de seguridad
- Monitoreo de intentos fallidos
- Políticas de contraseñas robustas
- Sesiones seguras con HTTPS

## API Endpoints

### Autenticación

- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/signup` - Crear cuenta
- `POST /api/auth/verify-email` - Verificar email
- `POST /api/auth/resend-verification` - Reenviar verificación

### Recuperación de Contraseña

- `POST /api/auth/forgot-password` - Solicitar reset
- `POST /api/auth/reset-password` - Resetear contraseña

## Server Actions

- `loginUsuario` - Autenticación de usuario
- `crearUsuario` - Registro de nuevo usuario
- `signout` - Cerrar sesión

## Estructura de Archivos

```
giganet-web-page/
├── app/
│   ├── login/
│   │   ├── page.js
│   │   └── page.module.css
│   ├── register/
│   │   ├── page.js
│   │   └── page.module.css
│   ├── forgot-password/
│   │   ├── page.js
│   │   └── page.module.css
│   ├── reset-password/
│   │   ├── page.js
│   │   └── page.module.css
│   └── api/
│       └── auth/
│           ├── login/route.js
│           ├── signup/route.js
│           ├── verify-email/route.js
│           ├── resend-verification/route.js
│           ├── forgot-password/route.js
│           └── reset-password/route.js
├── actions/
│   ├── loginUsuario-action.js
│   ├── crearUsuario-action.js
│   └── signout-action.js
└── docs/
    ├── README.md (este archivo)
    ├── login-process.md
    ├── register-process.md
    ├── forgot-password-process.md
    └── reset-password-process.md
```

## Contribuir

Al modificar cualquier proceso de autenticación:

1. Actualizar el código correspondiente
2. Actualizar la documentación en `docs/`
3. Probar todos los flujos (éxito y error)
4. Verificar medidas de seguridad
5. Actualizar tests si aplica

## Contacto

Para preguntas sobre estos procesos, contactar al equipo de desarrollo.

---

**Última actualización:** Enero 2026
