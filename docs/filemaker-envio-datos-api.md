# Cómo enviar datos desde FileMaker a la API (RNC dinámico)

El **RNC** ya no es una variable fija del servidor: debe enviarse en **cada petición** según la empresa/comprobante. Desde FileMaker debes incluir el RNC en el cuerpo (body) de cada llamada, según la tabla siguiente.

---

## Autenticación

- **Solicitar número:** se usa **API Key** (header `Authorization: Bearer <api_key>` o `X-API-Key: <api_key>`).
- **Resto de endpoints** (enviar factura, consultar estatus, anular, descargar, enviar email): por ahora requieren **sesión** (login en la web). Si en el futuro se exponen con API Key, el cuerpo de la petición será el mismo; solo cambiaría la forma de autenticar.

---

## 1. Solicitar número de comprobante (consumir NCF)

**POST** `/api/comprobantes/solicitar-numero`  
**Auth:** API Key en cabecera.

El RNC va en el body (ya estaba así). Sin cambios para FileMaker.

```json
{
  "rnc": "130476896",
  "tipo_comprobante": "32",
  "solo_preview": false
}
```

| Campo              | Tipo    | Obligatorio | Descripción                                             |
| ------------------ | ------- | ----------- | ------------------------------------------------------- |
| `rnc`              | string  | Sí          | RNC del emisor (9–11 dígitos). Sin guiones ni espacios. |
| `tipo_comprobante` | string  | Sí          | Uno de: 31, 32, 33, 34, 41, 43, 44, 45.                 |
| `solo_preview`     | boolean | No          | Si `true`, devuelve el próximo número sin consumirlo.   |

**Ejemplo en FileMaker (armar JSON y POST):**

```filemaker
Set Variable [ $RNC_Limpio ; Value: Substitute ( $RNC ; [ "-" ; "" ] ; [ " " ; "" ] ; [ "." ; "" ] ) ]
Set Variable [ $JSON ; Value: JSONSetElement ( "{}" ; "rnc" ; $RNC_Limpio ; JSONString ) ]
Set Variable [ $JSON ; Value: JSONSetElement ( $JSON ; "tipo_comprobante" ; $TipoComprobante ; JSONString ) ]
Set Variable [ $cURLOptions ; Value:
    "-X POST " &
    "-H \"Authorization: Bearer " & $API_KEY & "\" " &
    "-H \"Content-Type: application/json\" " &
    "-d " & Quote ( $JSON )
]
Insert from URL [ Select ; No dialog ; Target: $response ; $cURLOptions ]
```

---

## 2. Enviar factura electrónica a TheFactory

**POST** `/api/comprobantes/enviar-factura`  
**Auth:** API Key (igual que solicitar-numero: `Authorization: Bearer <api_key>` o `X-API-Key: <api_key>`). También acepta sesión si se llama desde la web.  
**Body:** JSON con la factura. El **RNC del emisor** va siempre en `emisor.rnc`.

Estructura mínima de referencia:

```json
{
  "factura": {
    "ncf": "E3200000001",
    "tipo": "32",
    "fecha": "2025-02-03",
    "total": "118.00",
    "id": "FM-001"
  },
  "emisor": {
    "rnc": "130476896",
    "razonSocial": "Mi Empresa SRL",
    "direccion": "Calle 1",
    "municipio": "Santo Domingo",
    "provincia": "Distrito Nacional"
  },
  "comprador": {
    "rnc": null,
    "nombre": "Consumidor final",
    "correo": "",
    "direccion": "",
    "municipio": "",
    "provincia": ""
  },
  "items": [{ "nombre": "Producto 1", "precio": "100.00", "cantidad": "1" }]
}
```

**Importante:** El RNC del emisor es obligatorio y **siempre se toma de `emisor.rnc`**. No se usa `factura.rnc`.

Para tipos 33/34 (notas de débito/crédito) se envían además `modificacion`, `ItemsDevueltos`, etc., según la documentación del controlador.

---

## 3. Consultar estatus de un documento (NCF)

**POST** (ruta que use `consultarEstatusDocumento`)  
**Auth:** Sesión (o la que exponga la app).  
**Body:** NCF + **RNC del emisor**.

```json
{
  "ncf": "E3200000001",
  "rnc": "130476896",
  "reintentar": false
}
```

| Campo        | Tipo    | Obligatorio | Descripción                                                          |
| ------------ | ------- | ----------- | -------------------------------------------------------------------- |
| `ncf`        | string  | Sí          | Número del comprobante (ej. E3200000001).                            |
| `rnc`        | string  | Sí          | RNC del emisor del comprobante.                                      |
| `reintentar` | boolean | No          | Si `true`, espera 2 s antes de consultar (útil tras envío reciente). |

Desde FileMaker: armar el JSON con el NCF y el RNC del emisor (ej. el mismo RNC con el que se solicitó el número o se envió la factura).

---

## 4. Anular comprobantes

**POST** (ruta que use `anularComprobantes`)  
**Auth:** Sesión.  
**Body:** RNC + lista de anulaciones.

```json
{
  "rnc": "130476896",
  "anulaciones": [
    {
      "tipoDocumento": "32",
      "ncfDesde": "E3200000001",
      "ncfHasta": "E3200000001"
    }
  ],
  "fechaHoraAnulacion": "03-02-2025 14:30:00"
}
```

| Campo                | Tipo   | Obligatorio | Descripción                                                                              |
| -------------------- | ------ | ----------- | ---------------------------------------------------------------------------------------- |
| `rnc`                | string | Sí          | RNC del emisor de los NCF a anular.                                                      |
| `anulaciones`        | array  | Sí          | Lista de objetos con `tipoDocumento`, `ncfDesde`, `ncfHasta` (o solo `ncf` para un NCF). |
| `fechaHoraAnulacion` | string | No          | Formato `DD-MM-YYYY HH:mm:ss`. Si se omite, se usa la fecha/hora actual.                 |

---

## 5. Descargar archivo (XML o PDF)

**POST** (ruta que use `descargarArchivo`)  
**Auth:** Sesión.  
**Body:** RNC + documento + extensión.

```json
{
  "rnc": "130476896",
  "documento": "E3200000001",
  "extension": "pdf"
}
```

| Campo       | Tipo   | Obligatorio | Descripción        |
| ----------- | ------ | ----------- | ------------------ |
| `rnc`       | string | Sí          | RNC del emisor.    |
| `documento` | string | Sí          | Número del e-NCF.  |
| `extension` | string | Sí          | `"xml"` o `"pdf"`. |

---

## 6. Enviar email del documento

**POST** `/api/comprobantes/enviar-email`  
**Auth:** Sesión (cookie) O API Key (`Authorization: Bearer <api_key>` o `X-API-Key`).  
**Body:** RNC + documento + lista de correos.

```json
{
  "rnc": "130476896",
  "documento": "E3200000001",
  "correos": ["cliente@ejemplo.com"]
}
```

| Campo       | Tipo   | Obligatorio | Descripción       |
| ----------- | ------ | ----------- | ----------------- |
| `rnc`       | string | Sí          | RNC del emisor.   |
| `documento` | string | Sí          | Número del e-NCF. |
| `correos`   | array  | Sí          | Hasta 10 correos. |

---

## Resumen: RNC en cada petición

| Acción            | Dónde va el RNC en el body |
| ----------------- | -------------------------- |
| Solicitar número  | `rnc` (raíz)               |
| Enviar factura    | `emisor.rnc`               |
| Consultar estatus | `rnc` (raíz)               |
| Anular            | `rnc` (raíz)               |
| Descargar archivo | `rnc` (raíz)               |
| Enviar email      | `rnc` (raíz)               |

En todos los casos el RNC debe ser el del **emisor** (la empresa que emite el comprobante), con 9 a 11 dígitos, sin guiones ni espacios. En FileMaker puedes normalizarlo así antes de armar el JSON:

```filemaker
Set Variable [ $RNC_Limpio ; Value: Substitute ( $RNC ; [ "-" ; "" ] ; [ " " ; "" ] ; [ "." ; "" ] ) ]
```

Y usar `$RNC_Limpio` en `JSONSetElement` para cada campo `rnc` que envíes.
