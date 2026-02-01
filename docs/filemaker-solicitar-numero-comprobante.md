# Script FileMaker: Solicitar número de comprobante

Este documento describe cómo llamar al endpoint **POST /api/comprobantes/solicitar-numero** desde FileMaker, enviando la API Key en cabecera y RNC + tipo de comprobante en el cuerpo.

---

## Requisitos previos

- **API Key:** La que copiaste en el dashboard (sección API Key). Guárdala en un campo global o variable en FileMaker.
- **URL base:** La de tu app, por ejemplo `https://tu-dominio.com` o `http://localhost:3000` en desarrollo.
- **RNC:** 9 a 11 dígitos de la compañía.
- **tipo_comprobante:** Uno de: 31, 32, 33, 34, 41, 43, 44, 45.

**Funciones JSON nativas de FileMaker usadas:** `JSONSetElement`, `JSONGetElement`. Tipos: `JSONString`, `JSONBoolean`. Disponibles desde FileMaker 17.

---

## Script FileMaker (solicitar número y consumirlo)

Asume que tienes:

- Un **campo global** o variable `$$API_KEY` con la API Key.
- Un **campo** o variable con el RNC (ej. `Comprobantes::RNC` o `$RNC`).
- Un **campo** o variable con el tipo de comprobante (ej. `Comprobantes::TipoComprobante` o `$TipoComprobante`).

Puedes usar también campos de tabla en lugar de variables si lo prefieres.

```filemaker
# ============================================================
# Solicitar número de comprobante (consumir de la secuencia)
# ============================================================

# 1. Configuración
Set Variable [ $URL_BASE ; Value: "https://tu-dominio.com" ]
# En desarrollo: "http://localhost:3000"

Set Variable [ $API_KEY ; Value: $$API_KEY ]
Set Variable [ $RNC ; Value: Comprobantes::RNC ]
Set Variable [ $TipoComprobante ; Value: Comprobantes::TipoComprobante ]

# 2. Validar que tengamos los datos
If [ IsEmpty ( $API_KEY ) or IsEmpty ( $RNC ) or IsEmpty ( $TipoComprobante ) ]
    Show Custom Dialog [ "Faltan datos" ; "Configure API Key, RNC y Tipo de comprobante." ]
    Exit Script [ Result: "" ]
End If

# 3. Armar el JSON del cuerpo con funciones nativas (solo dígitos en RNC)
Set Variable [ $RNC_Limpio ; Value: Substitute ( $RNC ; [ "-" ; "" ] ; [ " " ; "" ] ; [ "." ; "" ] ) ]
Set Variable [ $JSON ; Value: JSONSetElement ( "{}" ; "rnc" ; $RNC_Limpio ; JSONString ) ]
Set Variable [ $JSON ; Value: JSONSetElement ( $JSON ; "tipo_comprobante" ; $TipoComprobante ; JSONString ) ]

# 4. URL del endpoint
Set Variable [ $URL ; Value: $URL_BASE & "/api/comprobantes/solicitar-numero" ]

# 5. Insert from URL (POST con cabeceras y cuerpo)
# cURL options: -X POST, Authorization Bearer, Content-Type, -d body
Set Variable [ $cURLOptions ; Value: 
    "-X POST " &
    "-H \"Authorization: Bearer " & $API_KEY & "\" " &
    "-H \"Content-Type: application/json\" " &
    "-d " & Quote ( $JSON )
]

Insert from URL [
    Select ;
    No dialog ;
    Target: $response ;
    $cURLOptions
]

# 6. Revisar resultado
If [ Get ( LastError ) ≠ 0 ]
    Show Custom Dialog [ "Error de conexión" ; "No se pudo conectar. Código: " & Get ( LastError ) ]
    Exit Script [ Result: "" ]
End If

# 7. Parsear JSON de respuesta (FileMaker 19+ tiene JSONGetElement)
# Si usas versión anterior, tendrás que extraer con funciones de texto o un plug-in
Set Variable [ $status ; Value: JSONGetElement ( $response ; "status" ) ]
Set Variable [ $errorMsg ; Value: JSONGetElement ( $response ; "error" ) ]

If [ $status ≠ "success" ]
    # Error del servidor
    Set Variable [ $msg ; Value: If ( not IsEmpty ( $errorMsg ) ; $errorMsg ; $response ) ]
    Show Custom Dialog [ "Error al solicitar número" ; $msg ]
    Exit Script [ Result: "" ]
End If

# 8. Extraer datos útiles
Set Variable [ $numeroFormateado ; Value: JSONGetElement ( $response ; "data.numeroFormateado" ) ]
Set Variable [ $numeroConsumido ; Value: JSONGetElement ( $response ; "data.numeroConsumido" ) ]
Set Variable [ $numerosDisponibles ; Value: JSONGetElement ( $response ; "data.numerosDisponibles" ) ]
Set Variable [ $estadoRango ; Value: JSONGetElement ( $response ; "data.estadoRango" ) ]
Set Variable [ $mensajeAlerta ; Value: JSONGetElement ( $response ; "data.mensajeAlerta" ) ]

# 9. Opcional: guardar en campo del registro actual
Set Field [ Comprobantes::NumeroFormateado ; $numeroFormateado ]
Set Field [ Comprobantes::NumeroSecuencial ; $numeroConsumido ]
# Si hay alerta, notificar
If [ not IsEmpty ( $mensajeAlerta ) ]
    Show Custom Dialog [ "Aviso" ; $mensajeAlerta ]
End If

# 10. Devolver el número formateado para usar en el script que llamó
Exit Script [ Result: $numeroFormateado ]
```

---

## Versión sin JSONGetElement (FileMaker &lt; 19 o parsing manual)

Si no tienes `JSONGetElement`, puedes extraer valores con funciones de texto. Ejemplo para `numeroFormateado` (asumiendo que la respuesta es un string en `$response`):

```filemaker
# Ejemplo: extraer "numeroFormateado" del JSON en $response
# Buscar "numeroFormateado":" y luego tomar hasta la siguiente "
Set Variable [ $inicio ; Value: Position ( $response ; "\"numeroFormateado\":\"" ; 1 ; 1 ) ]
Set Variable [ $numeroFormateado ; Value: 
    If ( $inicio > 0 ;
        Middle ( $response ; $inicio + 20 ; 
            Position ( $response ; "\"" ; $inicio + 20 ; 1 ) - ( $inicio + 20 )
        ) ;
        ""
    )
]
```

O usar un plug-in de JSON si lo tienes instalado.

---

## Solo consultar el próximo número (sin consumir)

Si quieres solo ver el próximo número sin consumirlo, añade `solo_preview: true` al JSON con la función nativa:

```filemaker
Set Variable [ $JSON ; Value: JSONSetElement ( "{}" ; "rnc" ; $RNC_Limpio ; JSONString ) ]
Set Variable [ $JSON ; Value: JSONSetElement ( $JSON ; "tipo_comprobante" ; $TipoComprobante ; JSONString ) ]
Set Variable [ $JSON ; Value: JSONSetElement ( $JSON ; "solo_preview" ; 1 ; JSONBoolean ) ]
```

La respuesta traerá `data.proximoNumero` y `data.numeroFormateado` (el próximo), sin restar de la secuencia.

---

## Resumen de campos/variables

| Dónde        | Nombre sugerido   | Uso                                      |
|-------------|-------------------|------------------------------------------|
| Global      | `$$API_KEY`       | API Key copiada del dashboard            |
| Campo/var   | RNC               | RNC de la empresa (9–11 dígitos)         |
| Campo/var   | TipoComprobante   | 31, 32, 33, 34, 41, 43, 44, 45            |
| Respuesta   | `data.numeroFormateado` | Número e-CF para el comprobante  |
| Respuesta   | `data.numerosDisponibles` | Cuántos quedan en la secuencia   |

---

## Ejemplo de respuesta exitosa

```json
{
  "status": "success",
  "message": "Número consumido exitosamente",
  "data": {
    "numeroConsumido": 1,
    "numeroFormateado": "E3200000001",
    "numerosDisponibles": 99,
    "estadoRango": "activo",
    "alertaAgotamiento": false,
    "mensajeAlerta": null,
    "rnc": "130476896",
    "tipoComprobante": "32",
    "prefijo": "E"
  }
}
```

Si hay error (401, 404, 400), el cuerpo tendrá `"error": "mensaje"`; úsalo en el diálogo de error del script.
