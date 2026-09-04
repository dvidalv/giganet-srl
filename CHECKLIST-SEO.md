# ✅ Checklist SEO - Giganet

## Lo que YA está hecho ✅

- ✅ Metadatos básicos (title, description, keywords)
- ✅ Open Graph tags para redes sociales
- ✅ Twitter Cards
- ✅ Robots y control de indexación
- ✅ URLs canónicas
- ✅ JSON-LD (Schema.org)
- ✅ Sitemap.xml (`app/sitemap.js`)
- ✅ Robots.txt (`app/robots.js`)
- ✅ Imagen Open Graph (`/public/og-image.jpg` - 1200x630px)

## Lo que TIENES que hacer ⚠️

### 1. ✅ Crear Imagen Open Graph 📸

**COMPLETADO**

```
✅ /public/og-image.jpg
✅ 1200 x 630 píxeles
✅ 77KB (excelente tamaño)
✅ Logo + Slogan profesional
```

La imagen ya está lista y optimizada para redes sociales.

---

### 2. Google Search Console 🔍

**Prioridad: ALTA**

**Paso a paso:**

1. Ve a: https://search.google.com/search-console
2. Haz clic en **"Agregar propiedad"**
3. Selecciona **"Prefijo de URL"**
4. Ingresa tu dominio (ej: `https://www.giganet-srl.com/`)
5. Elige el método **"Etiqueta HTML"**
6. Copia el código (se ve así: `google-site-verification=AbC123XyZ...`)
7. Abre el archivo `app/layout.js`
8. En la línea 29, reemplaza:
   ```javascript
   verification: {
     google: "PEGA-AQUI-TU-CODIGO",
   },
   ```
9. Guarda y haz deploy
10. Vuelve a Google Search Console
11. Haz clic en **"Verificar"**

---

### 3. Actualizar URLs y Redes Sociales 🌐

**Prioridad: ALTA**

Edita el archivo **`app/layout.js`**:

#### Dominio principal (aparece varias veces)

```javascript
// Buscar y reemplazar TODO:
"https://www.giganet-srl.com/";
// Por:
"https://TU-DOMINIO-REAL.com";
```

#### Redes sociales (línea 48-52)

```javascript
sameAs: [
  "https://facebook.com/TU-PAGINA-REAL",
  "https://twitter.com/TU-USUARIO-REAL",
  "https://linkedin.com/company/TU-EMPRESA-REAL",
],
```

#### Handle de Twitter (línea 42)

```javascript
creator: "@TU-HANDLE-REAL",
```

#### Logo (línea 69)

```javascript
logo: "https://TU-DOMINIO.com/logo.png",
```

---

También actualiza estos archivos:

**`app/sitemap.js`** (línea 2):

```javascript
const baseUrl = "https://TU-DOMINIO-REAL.com";
```

**`app/robots.js`** (línea 12):

```javascript
sitemap: 'https://TU-DOMINIO-REAL.com/sitemap.xml',
```

---

### 4. Verificar que funciona ✅

**Prioridad: MEDIA**

Después de hacer los cambios, verifica con estas herramientas:

**Open Graph (Facebook, WhatsApp, LinkedIn):**

- https://developers.facebook.com/tools/debug/
- Ingresa tu URL y haz clic en "Depurar"

**Twitter Card:**

- https://cards-dev.twitter.com/validator
- Ingresa tu URL y verifica la vista previa

**Structured Data (Google):**

- https://search.google.com/test/rich-results
- Ingresa tu URL y verifica los resultados enriquecidos

**Schema.org:**

- https://validator.schema.org/
- Ingresa tu URL y verifica los datos estructurados

---

## Opcional pero recomendado 💡

### Google Analytics

1. Crear cuenta en https://analytics.google.com/
2. Obtener ID de medición (ej: `G-XXXXXXXXXX`)
3. Definir `NEXT_PUBLIC_GA_MEASUREMENT_ID` en `.env.local`, `.env.production` y en Vercel
4. Ya está integrado en `app/layout.js` con `@next/third-parties` (solo carga si hay ID)

### Google Tag Manager

1. Crear cuenta en https://tagmanager.google.com/
2. Obtener ID del contenedor (ej: `GTM-XXXXXXX`)
3. Agregar scripts en `app/layout.js`

### Agregar más páginas al Sitemap

Si tienes páginas de servicios, blog, sobre nosotros, etc., agrégalas en `app/sitemap.js`

---

## Resumen Visual

```
┌─────────────────────────────────────┐
│  LO MÁS IMPORTANTE (HACER AHORA)   │
└─────────────────────────────────────┘

1. ✅ Crear og-image.jpg (COMPLETADO)
2. 🔍 Configurar Google Search Console
3. 🌐 Actualizar dominio y redes sociales
4. ✅ Verificar con las herramientas

┌─────────────────────────────────────┐
│  Tiempo estimado: 20 minutos        │
└─────────────────────────────────────┘
```

---

## ¿Necesitas ayuda?

Revisa el archivo `METADATOS-SEO.md` para ver:

- Ejemplos detallados
- Más tipos de Schema.org
- Cómo personalizar metadatos por página
- Mejores prácticas de SEO
