# Competencia: facturación electrónica y punto de venta en República Dominicana

Resumen permanente de la investigación del 24 de noviembre de 2026. Precios públicos de las páginas de cada proveedor. Alegra se incluye además de los doce competidores. Los planes de Giganet punto de venta son los sembrados en el catálogo (Gratis, Básico, Comercial, Pro); el admin puede cambiarlos.

## Competidores

### Facturación, contabilidad y API

| Producto | Qué es | Precios y planes |
| --- | --- | --- |
| Alegra | Facturación, POS, ERP, nómina y contabilidad en la nube. Emite e-CF a través de Alanube. | Facturación desde US$15 (25 facturas, 1 usuario) hasta US$45 (ilimitadas, 3 usuarios). POS desde US$25. ERP desde US$79. Nómina desde US$29. Contabilidad para contadores desde US$59. Prueba 15 días. |
| Galileo | Contabilidad y e-CF. | Gratis (10 e-CF al mes). Básico US$19, e-CF sin límite mensual. Premium US$60 por empresa, con POS, inventario y nómina. Genera 606, 607 e IT-1. |
| Pacioli | ERP con POS y e-CF. | Desde US$5 al mes en promoción (lista US$10). El descuento del 50 % dura 3 meses. Precios más ITBIS. Planes más altos incluyen POS, inventario y nómina. |
| ADM Cloud | ERP. | Desde unos US$18 a US$24 al mes. Contabilidad, inventario, reportes 606, 607 y 608, y API. En algunas páginas la moneda no queda clara. La certificación ante la DGII se cobra aparte. |
| Alanube | API de e-CF. Es el proveedor que usa Alegra. | Cobra por emisión. No publica tarifa. |
| EF2 | Facturador. | RD$1,000 al mes, facturas ilimitadas, reportes 606 y 607, PDF por WhatsApp o correo. Estándar RD$2,500 (5 usuarios). Avanzado RD$5,000. |
| Facturador DGII | Emisor oficial. | Gratis, hasta 150 facturas al mes. Sin inventario ni caja. |
| eCF MSeller | Emisor. | 250 comprobantes gratis al mes. |

### Punto de venta

| Producto | Precios y planes |
| --- | --- |
| Nexo | RD$900, RD$2,250 y RD$5,625. El e-CF sale al cobrar. Hay cola si la DGII no responde. |
| Poszy | RD$950 (1,500 e-CF), RD$1,850 (5,000) y RD$3,000 (15,000). El excedente cuesta RD$1.20 por e-CF. Trae 606, 607, 608, cotizaciones, compras y crédito. |
| Cuadre | Un solo plan: RD$4,000 más ITBIS (RD$4,720). Usuarios y sucursales ilimitados. Tipos E31 a E47. |
| Factun POS | RD$2,095 por una caja, comprobantes ilimitados. Caja extra RD$1,195. |
| Terminal X | Solo emisor desde RD$490. Punto de venta completo RD$2,490, sin cobro por comprobante. |

La entrada de un POS con e-CF en el mercado está entre RD$900 y RD$1,000. El plazo de e-CF para pequeños, micro y no clasificados es el 15 de noviembre de 2026.

## Giganet punto de venta hoy

| Plan | Precio | Folios e-CF |
| --- | --- | --- |
| Gratis | RD$0 | Sin e-CF |
| Básico | RD$995 | 100 al mes |
| Comercial | RD$1,995 | 500 al mes |
| Pro | RD$2,995 | 2,000 al mes |

Ya cobra en caja, lleva inventario y emite el comprobante en la venta (folios, vía el portal y The Factory). El portal de Giganet-SRL administra empresas, folios y comprobantes, y ya es multi-empresa, con API key por empresa.

## Qué le falta

- Reportes 606, 607 y 608 (en el punto de venta los reportes siguen marcados como pendientes).
- Cotizaciones.
- Compras, proveedores y cuentas por pagar.
- Cola de contingencia si la DGII o The Factory se caen.
- Envío del PDF del comprobante al cliente por correo y WhatsApp.
- IT-1, nómina y contabilidad completa: no están, y no conviene copiarlas ahora.

El Básico cuesta lo mismo que Nexo o Poszy y trae 100 folios, no 1,500.

## Qué implementar para competir

1. Exportar 606, 607 y 608, y subir los folios del Básico o cobrar RD$1.20 por cada folio extra, para que la caja no se apague al llegar al tope.
2. Cola de contingencia si la DGII se cae.
3. Enviar el PDF por correo y WhatsApp al emitir.
4. Cotización que se convierte en factura.
5. Compras y cuentas por pagar.
6. Ticket de 58 mm y 80 mm.
7. Asistente de certificación, a partir del intake de DGII que ya existe.

Nómina, partida doble y conciliación bancaria quedan para después. Giganet compite mejor como caja, más e-CF, más archivos fiscales.

## Planes sugeridos

Precios mensuales en pesos, ITBIS aparte.

Solo emitir, sin caja:

- Prueba: RD$0, 30 e-CF, 1 usuario, 14 días.
- Emisor: RD$590, 400 e-CF, 2 usuarios, 606 y 607.
- Emisor Pro: RD$1,190, 2,000 e-CF, facturas recurrentes y API.
- Contador: RD$2,490, 10 RNC en el portal, sin POS.

Punto de venta:

- Caja: RD$990, 1 caja, 2 usuarios, 800 e-CF.
- Tienda: RD$1,890, 3 cajas, 5 usuarios, 2,500 e-CF y compras.
- Operación: RD$3,490, 8 cajas, 15 usuarios, 8,000 e-CF.

Solo emitir arranca desde RD$590. El punto de venta arranca en Caja a RD$990.
