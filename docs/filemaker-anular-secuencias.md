# Script FileMaker: Anular secuencias de comprobantes

Script para cancelar NCF no usados ante DGII/TheFactoryHKA desde FileMaker. Útil cuando los comprobantes están vencidos y hay secuencias que nunca se utilizaron (ej. DGII asigna 1-10 para tipo gubernamental, solo usaste el 1; debes anular 2-10).

## Requisitos

- **API Key:** La del dashboard (sección API Key). Variables globales `$$API_KEY` y `$$API_URL_BASE`.
- **Campos o variables:** RNC, TipoDocumento, NCF_Desde, NCF_Hasta (opcional), FechaHoraAnulacion (opcional).

## Endpoint

**POST** `/api/comprobantes/anular`  
**Auth:** API Key (`Authorization: Bearer <api_key>` o `X-API-Key`).

## Campos del layout/tabla Comprobantes

El script usa estos campos por defecto. Crea los que falten o cambia las referencias:

| Campo                 | Descripción                                              |
| --------------------- | -------------------------------------------------------- |
| `Comprobantes::RNC`   | RNC del emisor (9-11 dígitos)                           |
| `Comprobantes::TipoComprobante` | Tipo: 31, 32, 33, 34, 41, 43, 44, 45, 46, 47     |
| `Comprobantes::NCF_Desde` | NCF inicial del rango a anular (ej. E310000000002) |
| `Comprobantes::NCF_Hasta` | NCF final (ej. E310000000010). Si vacío = solo NCF_Desde |
| `Comprobantes::FechaHoraAnulacion` | Opcional. Formato `DD-MM-YYYY HH:mm:ss`       |

### Alternativa: variables en lugar de campos

Si prefieres no usar campos, reemplaza en el script:

```filemaker
# En lugar de Comprobantes::NCF_Desde, usa:
Set Variable [ $NCF_Desde ; Value: "E310000000002" ]

# Para un rango:
Set Variable [ $NCF_Hasta ; Value: "E310000000010" ]
```

## Importar el script FMXML

1. Abre el archivo `filemaker-anular-secuencias-script.fmxml` en un editor de texto.
2. Copia todo el contenido (Cmd+A, Cmd+C).
3. En FileMaker: Script Workspace → nuevo script → pegar (Cmd+V).
4. Ajusta las referencias a campos si tu tabla/layout tiene otros nombres.
5. Asegúrate de que `$$API_URL_BASE` y `$$API_KEY` estén definidos (por ejemplo en script de apertura).

## Ejemplo de uso

Para anular el rango E310000000002 a E310000000010 (9 NCF no usados):

- **NCF_Desde:** E310000000002  
- **NCF_Hasta:** E310000000010  
- **TipoDocumento:** 31  
- **RNC:** 130476896  

Tras la anulación exitosa, la API también actualiza los comprobantes locales (numeros_utilizados, estado) para que el sistema no vuelva a asignar esos NCF.
