import { redirect } from "next/navigation";

/** La API key la gestiona solo el admin en la ficha de la empresa. */
export default function ApiKeyPage() {
  redirect("/dashboard/empresa");
}
