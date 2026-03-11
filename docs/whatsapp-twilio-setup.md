# Configuración de WhatsApp Business con Twilio

## Resumen
Este documento describe el proceso completo para enviar mensajes de WhatsApp automáticos desde el sistema Giganet usando Twilio y la WhatsApp Business API.

---

## Requisitos previos

- Cuenta de Twilio con un número de WhatsApp Business aprobado
- Facebook Business Manager verificado
- Node.js >= 20.9.0
- Paquetes: `twilio`, `dotenv`

---

## 1. Instalación de dependencias

```bash
nvm install 22
nvm use 22
npm install twilio dotenv
```

> El proyecto usa Node.js 22. Se creó un archivo `.nvmrc` con el valor `22` para que `nvm use` lo tome automáticamente al entrar al directorio.

---

## 2. Variables de entorno (`.env.local`)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Estos valores se obtienen en [console.twilio.com](https://console.twilio.com) → Account → Account Info.

---

## 3. Número de WhatsApp Business

- **Número:** `+15558586932`
- **Nombre en Meta:** Giganet Systems
- **Estado:** Online / Conectado
- **Cuenta de Meta:** `giganet.do` (ID: `1216855787101717`)
- **Business verificado:** Giganet Services SRL (ID: `1137613023644435`)

### Dónde se configura en Twilio
`Messaging → Senders → WhatsApp senders`

---

## 4. Template de WhatsApp

### Por qué se necesita un template
WhatsApp solo permite enviar mensajes **iniciados por el negocio** (sin que el cliente haya escrito primero) si se usa un **Message Template aprobado por Meta**. Sin template, cualquier mensaje fuera de la ventana de 24 horas da el error `63016`.

### Template aprobado

| Campo | Valor |
|---|---|
| **Nombre** | `aviso_comprobantes_v2` |
| **Content SID** | `HX9d7b1da0372bfdb95a75d3071b352a52` |
| **Categoría** | Utility ✅ |
| **Idioma** | Español |
| **Estado** | Approved ✅ |

**Texto del template:**
```
Estimado {{1}}, su cuenta de comprobantes fiscales electrónicos tiene {{2}} documentos disponibles. Si necesita asistencia, comuníquese con su proveedor de servicio.
```

- `{{1}}` → Nombre del cliente
- `{{2}}` → Cantidad de comprobantes disponibles

### Por qué el primer template fue rechazado como Utility
El primer template (`aviso_comprobantes`) fue aprobado pero Meta lo categorizó como **Marketing** porque contenía la frase *"Contáctenos para renovar"*, que Meta interpreta como comercial. Fue necesario crear `aviso_comprobantes_v2` con lenguaje neutral para que Meta lo aprobara como **Utility**.

### Cómo crear un template en Twilio
1. Ir a `Messaging → Content Template Builder → Create new`
2. Nombre en minúsculas y guiones bajos (sin espacios)
3. Idioma: Spanish
4. Content Type: Text
5. Escribir el body con variables `{{1}}`, `{{2}}`, etc.
6. Al someter: seleccionar categoría **Utility** (no Marketing)
7. Ingresar valores de muestra para cada variable
8. Clic en **Save and submit**

---

## 5. Código del script de envío (`sendWhatsapp.js`)

```js
import { config } from "dotenv";
config({ path: ".env.local" });

import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function enviarAvisoComprobantes(nombreCliente, cantidadRestante, telefonoCliente) {
  const message = await client.messages.create({
    from: "whatsapp:+15558586932",
    to: `whatsapp:${telefonoCliente}`,
    contentSid: "HX9d7b1da0372bfdb95a75d3071b352a52",
    contentVariables: JSON.stringify({
      1: nombreCliente,
      2: String(cantidadRestante),
    }),
  });

  console.log(`Mensaje enviado a ${telefonoCliente}: ${message.sid}`);
  return message.sid;
}

// Ejemplo de uso:
enviarAvisoComprobantes("David", 50, "+16825602093");
```

> **Nota:** El archivo `.env.local` NO es cargado automáticamente por Node.js (solo lo hace Next.js). Por eso se usa `dotenv` con `config({ path: ".env.local" })` al inicio del script.

---

## 6. Errores encontrados y soluciones

| Error | Causa | Solución |
|---|---|---|
| `63016` | Mensaje de texto libre fuera de ventana de 24h | Usar un Message Template aprobado |
| `63049` | Meta no entregó mensaje de marketing | El template fue categorizado como Marketing; recrearlo como Utility |
| `63112` | Meta deshabilitó la cuenta del sender | Error temporal durante configuración inicial; se resolvió solo |
| `username is required` | Variables de entorno no cargadas | Agregar `dotenv` y `config({ path: ".env.local" })` |

---

## 7. Próximo paso: Integración automática

La función `enviarAvisoComprobantes` está lista para integrarse en un **cron job** que consulte MongoDB y envíe automáticamente el aviso cuando los comprobantes de un cliente estén por agotarse.

Pendiente definir:
- Umbral de alerta (ej. menos de X comprobantes)
- Campo del teléfono del cliente en MongoDB
- Frecuencia del cron job
