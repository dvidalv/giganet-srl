# FileMaker: el PDF no se ve después de descargar

Si el base64 llega en el JSON con saltos de línea, `Base64Decode` puede fallar o generar datos inválidos. Además, en FileMaker a veces es más fiable cargar el PDF en un contenedor con **Insert from URL** usando una data URL.

## Opción 1: Limpiar el base64 antes de Base64Decode

Después de obtener `$archivoBase64` con `JSONGetElement ( $response ; "data.archivo" )`, **quita saltos de línea** y luego decodifica:

**Nuevo paso Set Variable (antes de los Set Field):**
- **Nombre:** `$archivoBase64`
- **Valor (sustituir el que tienes):**
  ```
  Substitute ( Substitute ( Substitute ( JSONGetElement ( $response ; "data.archivo" ) ; Char ( 10 ) ; "" ) ; Char ( 13 ) ; "" ) ; " " ; "" )
  ```

Así eliminas retornos de línea (Char 10 y 13) y espacios que a veces vienen en el JSON y rompen el base64.

Luego mantén:
- **Set Field** `FACTURAS::ArchivoPDF_Base64` = `$archivoBase64`
- **Set Field** `FACTURAS::ArchivoPDF` = `Base64Decode ( $archivoBase64 )`

---

## Opción 2: Usar Insert from URL con data URL (recomendado)

En lugar de **Set Field** con `Base64Decode`, carga el PDF en el contenedor con **Insert from URL** usando una data URL. Suele mostrar mejor el PDF en FileMaker.

**Después de tener `$archivoBase64` (ya limpio):**

1. **Set Variable**
   - **Nombre:** `$dataURL`
   - **Valor:**
     ```
     "data:application/pdf;base64," & Substitute ( Substitute ( Substitute ( $archivoBase64 ; Char ( 10 ) ; "" ) ; Char ( 13 ) ; "" ) ; " " ; "" )
     ```

2. **Insert from URL**
   - **URL (Calculation):** `$dataURL`
   - **Target:** `FACTURAS::ArchivoPDF` (campo contenedor)
   - **Select entire contents:** Sí
   - **No dialog:** Sí
   - **No cURL options** (dejar vacío; es una data URL local)

Así el contenedor recibe el PDF desde la data URL y el visor de FileMaker suele mostrarlo bien.

---

## Resumen de pasos a cambiar en tu script

1. Al obtener el base64, **siempre limpiarlo**:
   ```
   $archivoBase64 = Substitute ( Substitute ( Substitute ( JSONGetElement ( $response ; "data.archivo" ) ; Char ( 10 ) ; "" ) ; Char ( 13 ) ; "" ) ; " " ; "" )
   ```

2. **O bien** usar **Insert from URL** con:
   ```
   $dataURL = "data:application/pdf;base64," & $archivoBase64
   ```
   (usando el mismo `$archivoBase64` ya limpio) y **Target** = `FACTURAS::ArchivoPDF`.

3. Si sigues usando **Set Field** con **Base64Decode**, que el argumento sea siempre el **mismo** `$archivoBase64` limpio (no volver a leer de JSON en ese paso).

Con esto el PDF debería guardarse y verse correctamente en el contenedor.
