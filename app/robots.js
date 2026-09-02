export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/encuesta/',
          '/reset-password',
          '/forgot-password',
        ],
      },
    ],
    sitemap: 'https://giganet.com/sitemap.xml',
  };
}
