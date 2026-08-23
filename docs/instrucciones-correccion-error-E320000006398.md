# Instrucciones para Corregir Error E320000006398

## El Problema

El comprobante con NCF **E320000006398** tiene guardado en MongoDB solo un mensaje genérico:
```
Request failed with status code 400
```

Pero el error real de The Factory fue:
```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "DocumentoElectronico.Encabezado.Comprador.Direccion": [
      "0107|El campo excede la longitud permitida"
    ]
  },
  "traceId": "00-502eb8e03f3050ac4e673252f024cd49-80e98f1a63d1a38e-00"
}
```

Esta información no se guardó en MongoDB cuando ocurrió el error (antes de implementar `errorNormalizado`).

---

## La Solución

He creado un endpoint especial para corregir manualmente la información de errores antiguos:

**POST /api/debug/fix-error-data**

### Paso 1: Despliega los cambios

Asegúrate de que los últimos commits están en tu servidor de producción:

```bash
git pull origin main
npm install  # Si es necesario
# Reinicia tu servidor Next.js
```

### Paso 2: Ejecuta el endpoint de corrección

Una vez que tu aplicación esté corriendo con MongoDB conectado, ejecuta este comando:

```bash
curl -X POST https://TU-DOMINIO.com/api/debug/fix-error-data \
  -H "Content-Type: application/json" \
  -d '{
    "ncf": "E320000006398",
    "errorData": {
      "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
      "title": "One or more validation errors occurred.",
      "status": 400,
      "errors": {
        "DocumentoElectronico.Encabezado.Comprador.Direccion": [
          "0107|El campo excede la longitud permitida"
        ]
      },
      "traceId": "00-502eb8e03f3050ac4e673252f024cd49-80e98f1a63d1a38e-00"
    }
  }'
```

**Nota:** Reemplaza `https://TU-DOMINIO.com` con la URL de tu aplicación.

### Paso 3: Verifica el resultado

Deberías recibir una respuesta como esta:

```json
{
  "message": "Error actualizado correctamente",
  "ncf": "E320000006398",
  "before": {
    "codigoRespuesta": 400,
    "mensajeRespuesta": "Request failed with status code 400",
    "hasErrorNormalizado": false
  },
  "after": {
    "hasValidationErrors": true,
    "validationErrorsCount": 1,
    "errorNormalizado": {
      "type": "THE_FACTORY_VALIDATION_ERROR",
      "httpStatus": 400,
      "validationErrors": [
        {
          "field": "DocumentoElectronico.Encabezado.Comprador.Direccion",
          "code": "0107",
          "message": "El campo excede la longitud permitida"
        }
      ],
      "message": "Error de validación en dirección del comprador: El campo excede la longitud permitida"
    }
  },
  "textForAI": "..."
}
```

### Paso 4: Prueba el chatbot

Ahora pide al chatbot que explique el error del NCF E320000006398:

```
¿Por qué dio error el comprobante E320000006398?
```

**Respuesta esperada:**

> El comprobante fue rechazado porque la **dirección del comprador** excede la longitud permitida.
> 
> **Campo con problema:** Dirección del comprador  
> **Código de error:** 0107  
> 
> **Qué hacer:** Acorta la dirección del cliente. El sistema tiene un límite de caracteres para este campo. Intenta usar una dirección más breve o abreviada.

---

## Para Otros Errores Antiguos (Opcional)

Si tienes muchos errores antiguos guardados sin `errorNormalizado`, puedes migrarlos todos de una vez:

```bash
# Dry run (no modifica nada, solo simula)
curl -X POST https://TU-DOMINIO.com/api/debug/migrate-errors \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "dryRun": true}'

# Migración real (actualiza MongoDB)
curl -X POST https://TU-DOMINIO.com/api/debug/migrate-errors \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "dryRun": false}'
```

**Nota:** Esto solo funciona si los errores antiguos tienen `respuestaCompleta` guardada. Si no tienen esa información, deberás usar `fix-error-data` manualmente para cada uno.

---

## Para Errores Nuevos

Todos los errores que ocurran **de ahora en adelante** se guardarán automáticamente con:
- ✅ `respuestaCompleta`: El JSON completo de The Factory
- ✅ `errorNormalizado`: La estructura procesada
- ✅ `detallesError.validationErrors`: Errores de validación parseados

Y la IA los explicará correctamente sin lenguaje técnico.

---

## Commits Relacionados

- `caf502d`: fix: mejorar captura y uso de errorNormalizado en explicación de errores
- `7052d3e`: docs: actualizar documentación con mejoras a errorNormalizado y prompt IA
- `4ad7481`: feat: agregar endpoints de debug y migración de errores antiguos
- `274f231`: feat: agregar endpoint para corregir manualmente datos de error
- `ed05d45`: refactor: mejorar prompt de IA para explicaciones no técnicas

---

## Contacto

Si tienes problemas o necesitas ayuda, contacta al equipo de desarrollo.
