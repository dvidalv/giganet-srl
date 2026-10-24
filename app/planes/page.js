import PlanesFolios from "@/components/PlanesFolios";
import JsonLd from "@/components/JsonLd";
import {
  PLANES_FOLIOS,
  formatPrecioRD,
  formatTransacciones,
} from "@/lib/folios/planesCatalogo";

export const metadata = {
  title: "Planes de folios e-CF",
  description:
    "Planes de folios electrónicos e-CF de Giganet. Opciones y precios en pesos dominicanos (RD$) desde 200 hasta 150.000 transacciones.",
  keywords: [
    "planes de folios",
    "folios electrónicos",
    "e-CF",
    "facturación electrónica DGII",
    "precios folios República Dominicana",
  ],
  alternates: {
    canonical: "/planes",
  },
  openGraph: {
    title: "Planes de folios e-CF | Giganet",
    description:
      "Opciones y precios en pesos dominicanos (RD$) para paquetes de folios electrónicos.",
    url: "/planes",
  },
};

function schemaPlanes() {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Planes de folios e-CF",
    description: "Opciones y precios en pesos dominicanos (RD$)",
    url: "https://www.giganet-srl.com/planes",
    itemListElement: PLANES_FOLIOS.map((plan, index) => ({
      "@type": "Offer",
      position: index + 1,
      name: plan.nombre,
      description: `${formatTransacciones(plan.transacciones)} transacciones e-CF. Precio anual ${formatPrecioRD(plan.precioAnual)}.`,
      priceCurrency: "DOP",
      price: plan.precioAnual,
      availability: "https://schema.org/InStock",
      url: `https://www.giganet-srl.com/contacto?plan=${plan.slug}`,
    })),
  };
}

export default function PlanesPage() {
  return (
    <>
      <JsonLd data={schemaPlanes()} />
      <PlanesFolios variant="page" />
    </>
  );
}
