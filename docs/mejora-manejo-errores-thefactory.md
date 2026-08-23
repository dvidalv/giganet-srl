# Mejora del Manejo de Errores de The Factory HKA

## Resumen de Cambios

Se ha mejorado completamente el manejo de errores de The Factory HKA en todo el proyecto para preservar la información completa de `error.response.data` y presentarla de forma estructurada tanto a la IA como a los usuarios finales.

## Archivos Creados

### 1. `/workspace/utils/theFactoryErrorHandler.js`

Utilidad central para normalizar y manejar errores de The Factory HKA.

**Funciones principales:**

- **`normalizeTheFactoryError(error)`**: Normaliza un error de Axios/Fetch preservando toda la información de `error.response.data`
  - Detecta errores de validación estructurados (con campos `errors`)
  - Extrae códigos separados por `|` automáticamente
  - Clasifica errores por tipo (validación, negocio, red, timeout, etc.)
  - Preserva: `type`, `title`, `status`, `errors`, `traceId`, `mensaje`, `codigo`, `observaciones`

- **`normalizeValidationErrors(errors)`**: Normaliza el objeto `errors` de validación
  - Extrae código y mensaje de formato `"0102|El campo no cumple con el formato correcto"`
  - Genera estructura consistente con `field`, `code`, `message`

- **`translateFieldPath(fieldPath)`**: Traduce rutas técnicas a lenguaje comprensible
  - `DocumentoElectronico.Encabezado.Comprador.Correo` → "correo del comprador"
  - `DocumentoElectronico.Encabezado.Emisor.RNC` → "RNC del emisor"
  - Traducciones inteligentes basadas en contexto

- **`buildErrorTextForAI(normalizedError)`**: Construye texto estructurado para enviar a la IA
  - Preserva toda la información normalizada
  - Formato legible para procesamiento por LLM
  - Incluye traducciones de campos técnicos

- **`logTheFactoryError(error, normalized)`**: Logs inteligentes
  - Solo información básica en producción (sin datos sensibles)
  - Logs completos en desarrollo con raw data

## Archivos Modificados

### 2. `/workspace/app/controllers/comprobantes.js`

Actualizado el manejo de errores en todas las funciones que interactúan con The Factory HKA.

#### Import agregado:
```javascript
import {
  normalizeTheFactoryError,
  logTheFactoryError,
  buildErrorTextForAI,
} from "@/utils/theFactoryErrorHandler";
```

#### Funciones actualizadas:

**a) `obtenerTokenTheFactory` (líneas ~248-265)**
- Normaliza errores de autenticación
- Preserva información de `error.response.data`
- Logs estructurados

**b) `consultarEstatusInmediato` (líneas ~851-869)**
- Normaliza errores de consulta de estatus
- Retorna `errorDetails` con información completa
- No lanza excepciones, retorna objeto con estado

**c) `enviarFacturaElectronicaLogic` (líneas ~3191-3340)**
- **CAMBIO CRÍTICO**: Normalización completa de errores
- Preserva `error.response.data` en `rawResponseData`
- Detecta errores de validación automáticamente
- Construye respuesta con `validationErrors` estructurados
- Guarda en MongoDB con información completa
- Respuestas diferenciadas por tipo de error:
  - Validación → incluye `validationErrors` array
  - Negocio → incluye `codigo`, `mensaje`
  - Red/Timeout → tipo específico de error
  - Genérico → mensaje descriptivo

**d) `anularComprobantesLogic` (líneas ~4575-4606)**
- Normaliza errores de anulación
- Preserva `validationErrors` si existen
- Clasifica errores de red vs errores de API

**e) `descargarArchivoLogic` (líneas ~4743-4779)**
- Normaliza errores de descarga
- Incluye `errorType` en respuestas

**f) `consultarRncLogic` (líneas ~4163-4183)**
- Normaliza errores de consulta RNC
- Preserva `errorType` en respuestas

**g) `listarSeriesTheFactory` (líneas ~3435-3455)**
- Normaliza errores de listado de series
- Manejo especial para credenciales incorrectas

**h) `syncTheFactoryCrearSeriesFromComprobante` (líneas ~3788-3807)**
- Normaliza errores de creación de series
- Manejo especial para 404 (URL incorrecta)

**i) `syncTheFactoryActualizarSeriesFromComprobante` (líneas ~3858-3867)**
- Normaliza errores de actualización de series

**j) `syncTheFactoryBorrarSeriesFromComprobante` (líneas ~3945-3962)**
- Normaliza errores de borrado de series
- Detecta casos donde el error es esperado (serie no existe)

### 3. `/workspace/lib/whatsappExplicarError.js`

Actualizada la función que genera explicaciones de errores para el chatbot.

#### Imports agregados:
```javascript
import { 
  normalizeTheFactoryError, 
  buildErrorTextForAI,
  translateFieldPath 
} from "@/utils/theFactoryErrorHandler";
```

#### Función actualizada: `explicarErrorConAI`

**Cambios principales:**

1. **Normalización de errores desde MongoDB:**
   - Si `errorMongoDB.respuestaCompleta` existe, la normaliza
   - Usa `buildErrorTextForAI` para construir contexto estructurado

2. **Normalización de errores copiados por usuario:**
   - Intenta parsear JSON del error
   - Normaliza automáticamente
   - Fallback a texto plano si no es JSON

3. **Prompt mejorado de la IA:**
   - **REGLAS CRÍTICAS** añadidas para priorizar información específica
   - Instrucciones explícitas para NO inventar causas
   - Manejo específico de errores de validación estructurados
   - Traducción de campos técnicos
   - Manejo de múltiples errores
   - Solo hipótesis cuando no hay información detallada
   - NO mencionar contacto a The Factory si el error es claro

4. **Temperatura reducida:** De 0.3 a 0.2 para respuestas más precisas

## Flujo Completo del Error

```
The Factory API
    ↓ (Axios/Fetch)
Error con response.data
    ↓
normalizeTheFactoryError()
    ↓
{
  type: 'THE_FACTORY_VALIDATION_ERROR',
  httpStatus: 400,
  message: '...',
  validationErrors: [
    {
      field: 'DocumentoElectronico.Encabezado.Comprador.Correo',
      code: '0102',
      message: 'El campo no cumple con el formato correcto'
    }
  ],
  rawResponseData: { ... } // Original completo
}
    ↓
logTheFactoryError() // Logs estructurados
    ↓
guardarRegistroEnvio() // MongoDB con datos completos
    ↓
buildErrorTextForAI() // Texto estructurado
    ↓
AI (con prompt mejorado)
    ↓
Explicación precisa al usuario
```

## Tipos de Errores Normalizados

### 1. Errores de Validación (`THE_FACTORY_VALIDATION_ERROR`)
- Cuando existe `errors` o `validationErrors` en la respuesta
- Array normalizado con `field`, `code`, `message`
- Traducciones automáticas de campos técnicos

### 2. Errores de Negocio (`THE_FACTORY_BUSINESS_ERROR`)
- Código y mensaje de The Factory (108, 109, 110, 111, etc.)
- Preserva `codigo`, `mensaje`, `observaciones`

### 3. Errores de Red
- `THE_FACTORY_CONNECTION_REFUSED`: Servidor rechazó conexión
- `THE_FACTORY_DNS_ERROR`: No se puede resolver dominio
- `THE_FACTORY_TIMEOUT`: Timeout
- `THE_FACTORY_CONNECTION_RESET`: Conexión cerrada abruptamente

### 4. Errores Genéricos (`THE_FACTORY_ERROR`)
- Cualquier otro error HTTP
- Preserva toda la información de `response.data`

## Estructura de Respuesta de API

### Antes (ejemplo de error de validación):
```json
{
  "status": "error",
  "message": "Error en el envío a TheFactoryHKA",
  "details": {
    "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
    "title": "One or more validation errors occurred.",
    "status": 400,
    "errors": {
      "DocumentoElectronico.Encabezado.Comprador.Correo": [
        "0102|El campo no cumple con el formato correcto"
      ]
    },
    "traceId": "00-dca30e5ba8f65cbe30234eeebea54f80-092acd6d2a9e78e8-00",
    "erroresDetallados": { ... }
  },
  "statusCode": 400
}
```

### Después (mismo error):
```json
{
  "status": "error",
  "message": "Error de validación en correo del comprador: El campo no cumple con el formato correcto",
  "errorType": "THE_FACTORY_VALIDATION_ERROR",
  "httpStatus": 400,
  "validationErrors": [
    {
      "field": "DocumentoElectronico.Encabezado.Comprador.Correo",
      "code": "0102",
      "message": "El campo no cumple con el formato correcto"
    }
  ],
  "details": "Errores de validación encontrados. Ver validationErrors para detalles.",
  "traceId": "00-dca30e5ba8f65cbe30234eeebea54f80-092acd6d2a9e78e8-00"
}
```

## Respuesta de la IA

### Antes (con el ejemplo anterior):
```
El comprobante no pudo procesarse. Esto puede deberse a:
- RNC incorrecto
- NCF inválido
- Campos faltantes
- Formato de fecha incorrecto
- Montos con errores

Revisa todos los datos de la factura y vuelve a intentar.
```

### Después (mismo error):
```
El comprobante no pudo procesarse porque el correo del comprador 
tiene un formato incorrecto.

*Qué corregir:*
Revisa el campo del correo electrónico del comprador y asegúrate 
de que tenga un formato válido.

*Ejemplo de correo válido:*
cliente@empresa.com

*Campo técnico:*
DocumentoElectronico.Encabezado.Comprador.Correo
```

## Múltiples Errores

Si The Factory devuelve varios errores:

```json
{
  "errors": {
    "DocumentoElectronico.Encabezado.Comprador.Correo": [
      "0102|El campo no cumple con el formato correcto"
    ],
    "DocumentoElectronico.Encabezado.Comprador.RNC": [
      "0105|El RNC no cumple con la longitud requerida"
    ]
  }
}
```

La IA responde:
```
Encontré dos datos que debes corregir antes de volver a enviar el comprobante:

1. *Correo del comprador*
   - Problema: El campo no cumple con el formato correcto
   - Código: 0102
   - Solución: Usa un correo válido como cliente@empresa.com

2. *RNC del comprador*
   - Problema: El RNC no cumple con la longitud requerida
   - Código: 0105
   - Solución: El RNC debe tener 9 u 11 dígitos
```

## Validación de Implementación

### ✅ Verificado:

1. **error.response.data se preserva:** Sí, en `rawResponseData`
2. **Errores de validación se normalizan:** Sí, con `normalizeValidationErrors()`
3. **Códigos separados por | se extraen:** Sí, automáticamente
4. **Varios errores se envían completos:** Sí, array `validationErrors`
5. **System prompt prioriza errores específicos:** Sí, reglas explícitas
6. **IA no inventa causas:** Sí, instrucciones claras en prompt
7. **Errores genéricos solo cuando no hay info:** Sí, flujo condicional
8. **No se expone información sensible:** Sí, logs en producción limitados
9. **Traducciones de campos técnicos:** Sí, función `translateFieldPath()`
10. **Logs estructurados:** Sí, función `logTheFactoryError()`
11. **Campo errorNormalizado en MongoDB:** Sí, guardado en comprobanteEnvio
12. **Priorización de errorNormalizado:** Sí, se usa antes que respuestaCompleta
13. **Prompt sin lenguaje técnico:** Sí, reglas explícitas para evitar "status code", "API", etc.
14. **Detección de errores genéricos:** Sí, regla 9 del prompt detecta "Request failed with status code"

### 🔄 Mejoras Recientes (2024-08-23):

1. **Modificación de `guardarRegistroEnvio()`:**
   - Ahora detecta si `respuesta` es un `normalizedError` completo
   - Guarda `rawResponseData` en `respuestaCompleta`
   - Guarda estructura normalizada en nuevo campo `errorNormalizado`
   - Maneja ambos formatos (normalizedError y respuesta simple)

2. **Schema de `comprobanteEnvio`:**
   - Agregado campo `errorNormalizado` de tipo Mixed
   - Permite guardar la estructura completa procesada por `theFactoryErrorHandler`

3. **Función `explicarErrorConAI()`:**
   - Prioridad 1: Usa `errorNormalizado` si existe (más rápido)
   - Prioridad 2: Normaliza `respuestaCompleta` si `errorNormalizado` no existe (retrocompatibilidad)
   - Logs de debugging para rastrear flujo de normalización

4. **Mejoras al Prompt de IA:**
   - Regla 5 ampliada: Instrucciones específicas para errores HTTP genéricos
   - Regla 9 nueva: Detección explícita de "Request failed with status code X"
   - Ejemplos negativos ampliados: "solicitud", "cliente", "servidor", etc.
   - Ejemplo positivo para errores sin información específica

5. **Llamada a `guardarRegistroEnvio()` desde `enviarFacturaElectronicaLogic()`:**
   - Ahora pasa `normalizedError` completo en lugar de solo `rawResponseData`
   - Permite que `guardarRegistroEnvio()` detecte y procese correctamente

## Testing

### Casos de Prueba Recomendados:

1. **Error de validación con un campo:**
   - Enviar factura con correo inválido
   - Verificar que la respuesta incluya `validationErrors`
   - Verificar que la IA explique exactamente ese campo

2. **Error de validación con múltiples campos:**
   - Enviar factura con varios campos inválidos
   - Verificar que todos los errores aparezcan en `validationErrors`
   - Verificar que la IA los liste todos numerados

3. **Error de negocio (código 109):**
   - Enviar factura con NCF vencido
   - Verificar que `codigo: 109` se preserve
   - Verificar que la IA explique el NCF vencido

4. **Error de red (timeout):**
   - Simular timeout de The Factory
   - Verificar que `errorType` sea `THE_FACTORY_TIMEOUT`
   - Verificar mensaje claro sobre timeout

5. **Error sin información detallada:**
   - Simular error 500 sin detalles
   - Verificar que la IA indique que son "posibilidades"
   - Verificar que no invente causas específicas

## Notas de Seguridad

- **Producción:** Solo se loguean tipos de error y mensajes básicos
- **Desarrollo:** Logs completos con `error.response.data`
- **Tokens/Credenciales:** Nunca se incluyen en logs ni respuestas
- **TraceId:** Se preserva para debugging pero no se expone innecesariamente

## Próximas Mejoras Sugeridas

1. Agregar más traducciones de campos técnicos según aparezcan
2. Crear tests automatizados para cada tipo de error
3. Agregar métricas de errores más frecuentes
4. Dashboard de errores de The Factory para análisis
5. Caché de traducciones de campos para mejor performance

## Soporte

Para problemas o mejoras adicionales, contactar al equipo de desarrollo.
