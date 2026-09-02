# Guía de Metadatos SEO - Giganet

## Metadatos implementados en el Layout Principal

### 1. Metadatos Básicos
- **title**: Título con template para páginas individuales
- **description**: Descripción principal del sitio
- **keywords**: Palabras clave relevantes para búsquedas
- **authors/creator/publisher**: Información de autoría

### 2. Robots y Control de Indexación
```javascript
robots: {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  }
}
```

### 3. Open Graph (Facebook, LinkedIn, WhatsApp)
- Título, descripción e imagen optimizados para compartir
- Tipo de contenido: website
- Locale: es_ES
- Imagen recomendada: 1200x630px

### 4. Twitter Cards
- Card tipo: summary_large_image
- Metadatos específicos para Twitter/X

### 5. URLs Canónicas
- `metadataBase`: URL base del sitio
- `alternates.canonical`: URL canónica de cada página

### 6. Verificación
- Google Search Console: Necesitas agregar tu código de verificación

### 7. JSON-LD (Datos Estructurados)
- Schema.org Organization
- Información estructurada que Google puede usar en rich snippets

## Cómo Personalizar Metadatos en Páginas Específicas

### Ejemplo 1: Página de Servicios
```javascript
// app/servicios/page.js
export const metadata = {
  title: "Nuestros Servicios",
  description: "Descubre nuestros servicios de desarrollo web, apps móviles, consultoría tecnológica y más.",
  openGraph: {
    title: "Servicios - Giganet",
    description: "Descubre nuestros servicios de desarrollo web, apps móviles, consultoría tecnológica y más.",
    images: ["/servicios-og.jpg"],
  },
  alternates: {
    canonical: "/servicios",
  },
};
```

### Ejemplo 2: Blog Post Individual
```javascript
// app/blog/[slug]/page.js
export async function generateMetadata({ params }) {
  const post = await getPost(params.slug);
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: [post.image],
    },
    alternates: {
      canonical: `/blog/${params.slug}`,
    },
  };
}
```

### Ejemplo 3: Agregar JSON-LD Específico
```javascript
// En cualquier página
import JsonLd from "@/components/JsonLd";

export default function ProductPage() {
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Nombre del Producto",
    description: "Descripción del producto",
    offers: {
      "@type": "Offer",
      price: "99.00",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <JsonLd data={productSchema} />
      {/* Contenido de la página */}
    </>
  );
}
```

## Tareas Pendientes

### 1. ✅ Crear Sitemap.xml
**COMPLETADO** - Archivo `app/sitemap.js` creado con las páginas públicas del sitio.

### 2. ✅ Crear Robots.txt
**COMPLETADO** - Archivo `app/robots.js` creado con reglas para proteger dashboard y API.

### 3. ✅ Crear Imagen Open Graph
**COMPLETADO** - Archivo `/public/og-image.jpg` creado y optimizado (1200x630px, 77KB)

### 4. ⚠️ Verificar Google Search Console
1. Ir a https://search.google.com/search-console
2. Hacer clic en "Agregar propiedad"
3. Elegir "Prefijo de URL" e ingresar tu dominio
4. Seleccionar método "Etiqueta HTML"
5. Copiar el código que aparece (ejemplo: `google-site-verification=ABC123XYZ...`)
6. Editar `app/layout.js` línea 29:
   ```javascript
   verification: {
     google: "PEGAR-AQUI-TU-CODIGO",
   },
   ```
7. Hacer deploy de los cambios
8. Volver a Google Search Console y hacer clic en "Verificar"

### 5. ⚠️ Actualizar URLs Reales
En `app/layout.js`, buscar y reemplazar:

**Línea 33 y 37**: Cambiar el dominio
```javascript
url: "https://TU-DOMINIO-REAL.com",
```

**Línea 48**: Redes sociales (eliminar las que no uses)
```javascript
sameAs: [
  "https://facebook.com/TU-PAGINA",
  "https://twitter.com/TU-HANDLE",
  "https://linkedin.com/company/TU-EMPRESA",
],
```

**Línea 42**: Handle de Twitter
```javascript
creator: "@TU-HANDLE-TWITTER",
```

**Línea 69**: URL del logo
```javascript
logo: "https://TU-DOMINIO.com/logo.png",
```

**En `app/sitemap.js` línea 2** y **`app/robots.js` línea 12**: Cambiar dominio
```javascript
const baseUrl = 'https://TU-DOMINIO-REAL.com';
```

### 6. ⚠️ Agregar páginas adicionales al Sitemap (opcional)
Si tienes más páginas públicas (servicios, blog, about, etc.), agrégalas en `app/sitemap.js`:
```javascript
{
  url: `${baseUrl}/tu-nueva-pagina`,
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.8,
},
```

## Tipos de Schema.org Útiles

### LocalBusiness (si tienes oficina física)
```javascript
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Giganet",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Calle Principal 123",
    addressLocality: "Ciudad",
    addressRegion: "Región",
    postalCode: "12345",
    addressCountry: "ES"
  },
  telephone: "+34-XXX-XXX-XXX"
}
```

### Service (para páginas de servicios)
```javascript
{
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Desarrollo de Software",
  provider: {
    "@type": "Organization",
    name: "Giganet"
  },
  areaServed: "España"
}
```

### FAQPage (para página de preguntas frecuentes)
```javascript
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Qué servicios ofrecen?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ofrecemos desarrollo de software personalizado..."
      }
    }
  ]
}
```

## Herramientas de Verificación

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema.org Validator**: https://validator.schema.org/
3. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
4. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
5. **Google Search Console**: https://search.google.com/search-console

## Mejores Prácticas

1. Mantén los títulos entre 50-60 caracteres
2. Mantén las descripciones entre 150-160 caracteres
3. Usa imágenes de alta calidad para Open Graph (mínimo 1200x630px)
4. Actualiza el sitemap regularmente
5. Monitorea Google Search Console semanalmente
6. Usa palabras clave naturales, no hagas keyword stuffing
7. Cada página debe tener metadatos únicos
