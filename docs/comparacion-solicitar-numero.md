# Comparación: solicitar número (route Next.js vs controller Express)

## Resumen

| Aspecto | Route Next.js (`/api/comprobantes/solicitar-numero`) | Controller (`consumirNumeroPorRnc`) |
|--------|------------------------------------------------------|-------------------------------------|
| **Integración** | Integrado en la app Next.js (FileMaker llama a esta URL) | No conectado: requiere servidor Express que exponga la ruta |
| **Autorización** | API Key por usuario (solo secuencias de ese usuario) | Sin auth: cualquiera que llegue al endpoint puede consumir cualquier secuencia con ese RNC+tipo |
| **Filtro por usuario** | Sí (`usuario: userId` de la API Key) | No (comenta "SIN filtrar por usuario") |
| **Orden de rangos** | `fechaCreacion` (correcto, coincide con el schema) | `fecha_creacion` (nombre incorrecto: en el schema es `fechaCreacion`) |
| **solo_preview** | Sí (opción para ver próximo número sin consumir) | No |
| **Respuesta** | Incluye lo esencial | Incluye además: `fechaVencimiento`, `descripcion`, `rangoId` |

---

## Ventajas de la route Next.js (`route.js`)

1. **Seguridad**
   - Exige API Key; sin key → 401.
   - La key identifica al usuario; solo se consumen secuencias de **ese** usuario.
   - El RNC enviado debe coincidir con secuencias de la misma cuenta (no se pueden consumir números de otra empresa).

2. **Integración**
   - Es parte de la app Next.js: FileMaker llama a `POST /api/comprobantes/solicitar-numero` con la API Key en cabecera.
   - No necesitas un servidor Express aparte.

3. **Orden correcto**
   - Usa `sort({ fechaCreacion: 1 })`, que coincide con el campo del modelo (`fechaCreacion`). Se usa el rango más antiguo primero (FIFO).

4. **Funcionalidad extra**
   - Soporta `solo_preview: true` para obtener el próximo número sin consumirlo.

5. **Validación**
   - RNC 9–11 dígitos; tipo en la lista permitida; cuerpo JSON válido.

---

## Desventajas de la route Next.js

1. **Respuesta más reducida**
   - No devuelve `fechaVencimiento` (formato DD-MM-YYYY), `descripcion` (descripcion_tipo) ni `rangoId`.
   - Si FileMaker u otro cliente necesitan esos campos, habría que añadirlos a la respuesta de la route.

---

## Ventajas del controller (`consumirNumeroPorRnc`)

1. **Respuesta más completa**
   - Incluye `fechaVencimiento` (DD-MM-YYYY), `descripcion`, `rangoId`, útiles para FileMaker u otros consumidores.

2. **Sin auth**
   - Útil si el controller se usa en un entorno interno donde la autenticación la hace otro middleware (p. ej. IP, VPN, otro token) y no quieres duplicar lógica.

---

## Desventajas del controller

1. **Sin autorización**
   - No valida API Key ni usuario. Cualquiera que pueda llamar al endpoint puede consumir números de **cualquier** secuencia que coincida con RNC + tipo (incluidas secuencias de otros usuarios). Riesgo alto si el endpoint está expuesto.

2. **No integrado en Next.js**
   - El proyecto actual usa rutas API de Next.js; este controller es estilo Express (req/res). Para usarlo desde FileMaker tendrías que montar un servidor Express que lo exponga, o reutilizar la lógica en una route de Next.js.

3. **Bug en el orden**
   - Usa `.sort({ fecha_creacion: 1 })`. En el schema del modelo el campo es **`fechaCreacion`** (camelCase). En MongoDB el campo se guarda como `fechaCreacion`, así que `fecha_creacion` no existe y el orden puede ser impredecible. Debería ser `.sort({ fechaCreacion: 1 })`.

---

## Recomendación

- **Para FileMaker (y para la app actual):** usar la **route Next.js** (`POST /api/comprobantes/solicitar-numero`) con API Key. Es la que está integrada, segura y con el sort correcto.
- **Controller:** si lo mantienes (p. ej. en un backend Express separado), conviene:
  1. Corregir el sort a `fechaCreacion`.
  2. Añadir algún tipo de autorización (API Key, JWT, IP, etc.) si el endpoint está expuesto.
- **Route:** si quieres paridad con el controller, se pueden añadir a la respuesta de la route los campos `fechaVencimiento`, `descripcion` y `rangoId`.
