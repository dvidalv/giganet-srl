# Explicación de Errores de Comprobantes en WhatsApp Bot

## Descripción

El chatbot de WhatsApp ahora puede explicar por qué un comprobante electrónico (e-CF) devolvió error. Esta funcionalidad ayuda a los usuarios a entender y resolver problemas con sus facturas electrónicas.

## Cómo Funciona

### 1. Almacenamiento de Errores

Cuando se envía un comprobante a The Factory/DGII, el sistema guarda automáticamente el resultado en MongoDB:

- **Colección**: `comprobantes_envios`
- **Modelo**: `ComprobanteEnvio` (`app/models/comprobanteEnvio.js`)
- **Datos guardados**:
  - NCF del comprobante
  - RNC del emisor
  - Si fue exitoso o falló
  - Código y mensaje de error
  - Respuesta completa de The Factory
  - Tipo de error (negocio, técnico, validación, etc.)
  - Fecha de envío

### 2. Consulta por WhatsApp

Los usuarios pueden preguntar sobre errores de varias formas:

```
¿Por qué me dio error el comprobante E320000000005?
Me falló E320000000001
Error en factura E320000000003
```

El bot también puede recibir el mensaje de error completo copiado:

```
{
  "codigo": 109,
  "mensaje": "NCF vencido o inválido",
  "procesado": false
}
```

### 3. Análisis del Error

El bot sigue este flujo:

1. **Busca en MongoDB**: Consulta si hay un registro del error de ese NCF
2. **Analiza con AI** (si está disponible):
   - Lee la documentación de DGII y The Factory
   - Consulta ejemplos de errores comunes
   - Genera una explicación personalizada
3. **Fallback sin AI**: Proporciona explicaciones predefinidas para códigos comunes

### 4. Respuesta al Usuario

El bot responde con:

- **Explicación clara** del error en español
- **Causa probable** del problema
- **Pasos específicos** para solucionarlo
- **Indicaciones** sobre dónde revisar configuraciones
- **Cuándo contactar** a DGII o The Factory

## Códigos de Error Soportados

### Errores de Negocio
- **108**: NCF ya fue presentado anteriormente
- **109**: NCF vencido o inválido
- **110**: RNC no autorizado para este tipo de comprobante
- **111**: Datos de la factura inválidos

### Errores del Sistema
- **120**: Documento no encontrado en TheFactory
- **7777**: Secuencia reutilizable (problema de postulación)

### Errores Técnicos
- **401/403**: Error de autenticación
- **404**: Recurso no encontrado
- **500+**: Errores del servidor

## Configuración

### Variables de Entorno

```env
# Para análisis con AI (opcional pero recomendado)
OPENAI_API_KEY=sk-...
AI_GATEWAY_API_KEY=...
WHATSAPP_BOT_AI_MODEL=openai/gpt-4o-mini

# Bot configurado con cuenta de servicio
WHATSAPP_BOT_USER_ID=...
WHATSAPP_BOT_RNC_EMISOR=...
```

### MongoDB

La colección `comprobantes_envios` se crea automáticamente al enviar el primer comprobante.

**Índices creados**:
- `{ rnc: 1, ncf: 1, fechaCreacion: -1 }`
- `{ usuario: 1, fechaCreacion: -1 }`
- `{ exitoso: 1, fechaCreacion: -1 }`

## Archivos Modificados/Creados

### Nuevos Archivos

1. **`app/models/comprobanteEnvio.js`**
   - Modelo Mongoose para registros de envío
   - Schema con validaciones
   - Índices para búsquedas rápidas

2. **`lib/whatsappExplicarError.js`**
   - Lógica de búsqueda de errores en MongoDB
   - Generación de explicaciones con AI
   - Explicaciones predefinidas (fallback)
   - Carga de documentación para contexto

3. **`docs/whatsapp-explicar-errores.md`**
   - Esta documentación

### Archivos Modificados

1. **`app/controllers/comprobantes.js`**
   - Import de `ComprobanteEnvio`
   - Función `guardarRegistroEnvio()`
   - Llamadas en `enviarFacturaElectronicaLogic()` para guardar envíos exitosos y fallidos

2. **`lib/whatsappBotCapabilities.js`**
   - Nueva capacidad: `explicar_error`
   - Actualización del menú de ayuda

3. **`lib/whatsappBotAi.js`**
   - Nuevo campo `errorMessage` en el schema
   - Detección de mensajes de error copiados
   - Intent `explicar_error` en heurísticas

4. **`lib/whatsappBot.js`**
   - Import de funciones de explicación
   - Handler `handleExplicarError()`
   - Dispatch del intent `explicar_error`

## Ejemplos de Uso

### Ejemplo 1: Error Guardado en MongoDB

**Usuario:**
```
¿Por qué me dio error E320000000005?
```

**Bot:**
```
Buscando información sobre el error del comprobante E320000000005…

*Error 109: NCF vencido o inválido*

El número de comprobante (NCF) no es válido o está vencido.

*Causas posibles:*
- El rango de secuencia está vencido
- El formato del NCF es incorrecto
- El tipo de comprobante no coincide con la secuencia

*Solución:*
1. Verifica que el NCF tenga el formato correcto (Ej: E320000000001)
2. Revisa en Mi Empresa que tengas un rango de secuencias activo
3. Confirma que la fecha de vencimiento del rango no haya pasado
4. Solicita un nuevo rango de secuencias si es necesario
```

### Ejemplo 2: Error Copiado por Usuario

**Usuario:**
```
Me da este error:
{
  "codigo": 110,
  "mensaje": "RNC no autorizado",
  "procesado": false
}
```

**Bot:**
```
*Error 110: RNC no autorizado*

El RNC del emisor no tiene autorización para usar este tipo de comprobante.

*Causa:* La empresa no está postulada en DGII para emitir este tipo de e-CF.

*Solución:*
1. Verifica tu postulación en el portal de DGII
2. Confirma que el tipo de comprobante (31, 32, etc.) esté autorizado
3. Si necesitas autorización, debes solicitarla en DGII
4. Contacta a tu oficina de DGII para verificar tu estatus
```

### Ejemplo 3: Con Análisis AI (cuando está disponible)

**Usuario:**
```
Error E310000000123 RNC 101609921
```

**Bot:**
```
Buscando información sobre el error del comprobante E310000000123…

Basándome en el error registrado (código 7777), el problema está relacionado con la postulación y el rango de secuencias.

Este error suele ocurrir cuando:

1. **No hay postulación activa**: Tu empresa debe estar postulada en DGII para emitir e-CF. Verifica en el portal de DGII (dgii.gov.do) que tu postulación esté activa.

2. **Rango no válido en este ambiente**: Si estás usando el ambiente Demo de The Factory, asegúrate de que el rango de secuencias esté configurado para Demo. Lo mismo aplica para Producción.

3. **Secuencia no configurada**: En The Factory, ve a tu configuración de series y verifica que la secuencia para el tipo 31 (Factura de Crédito Fiscal) esté activa.

*Pasos recomendados:*
1. Entra a dgii.gov.do → Oficina Virtual → Facturación Electrónica
2. Verifica que tengas postulación activa para tipo 31
3. En The Factory, revisa que el ambiente coincida (Demo o Producción)
4. Si todo está correcto y persiste, contacta a soporte de The Factory

¿Te ayudo con algo más?
```

## Ventajas

1. **Autoservicio**: Los usuarios resuelven problemas sin contactar soporte
2. **Histórico**: Todos los errores quedan registrados para análisis
3. **Contexto**: La AI usa documentación real de DGII y The Factory
4. **Multicanal**: Funciona 24/7 por WhatsApp
5. **Escalable**: Aprende de los errores más comunes

## Limitaciones

- Solo explica errores de comprobantes ya enviados
- Requiere que el usuario tenga su empresa registrada en Giganet
- La AI necesita API key (OpenAI o AI Gateway) para análisis avanzado
- Sin AI, solo proporciona explicaciones predefinidas

## Próximas Mejoras

1. Agregar más códigos de error a las explicaciones predefinidas
2. Incluir capturas de pantalla de dónde configurar
3. Links directos a secciones relevantes de DGII
4. Sugerencias basadas en errores frecuentes del usuario
5. Integración con tickets de soporte si no se puede resolver automáticamente

## Soporte

Para problemas con esta funcionalidad, contacta a:
- Soporte técnico Giganet
- Email: soporte@giganetsystems.com
