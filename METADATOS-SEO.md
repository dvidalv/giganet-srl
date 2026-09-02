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

### 1. Crear Imagen Open Graph
- Crear `/public/og-image.jpg` (1200x630px)
- Diseño profesional con logo y slogan de Giganet

### 2. Verificar Google Search Console
- Ir a https://search.google.com/search-console
- Agregar tu sitio
- Copiar el código de verificación
- Reemplazar `"tu-codigo-de-verificacion-aqui"` en `app/layout.js`

### 3. Actualizar URLs Reales
En `app/layout.js`, reemplazar:
- `https://giganet.com` con tu dominio real
- URLs de redes sociales con tus perfiles reales
- `@giganet` con tu handle real de Twitter/X

### 4. Crear Sitemap.xml
```javascript
// app/sitemap.js
export default function sitemap() {
  return [
    {
      url: 'https://giganet.com',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://giganet.com/servicios',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Agregar más páginas
  ];
}
```

### 5. Crear Robots.txt
```javascript
// app/robots.js
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/'],
    },
    sitemap: 'https://giganet.com/sitemap.xml',
  };
}
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
