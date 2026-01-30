import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EmpresaAdminForm from "@/components/dashboard/EmpresaAdminForm";

export default async function EmpresaDetallePage({ params }) {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  const { id } = await params;
  if (!id) {
    redirect("/dashboard/empresas");
  }

  return <EmpresaAdminForm userId={id} />;
}
