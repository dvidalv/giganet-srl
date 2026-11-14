import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DgiiIntakeDetailAdmin from "@/components/dashboard/DgiiIntakeDetailAdmin";

export default async function DgiiIntakeAdminDetailPage({ params }) {
  const session = await auth();
  const user = session?.user;

  if (!user || user.role !== "admin") {
    redirect("/dashboard/empresa");
  }

  const { id } = await params;
  if (!id) {
    redirect("/dashboard/dgii-intakes");
  }

  return <DgiiIntakeDetailAdmin intakeId={id} />;
}
