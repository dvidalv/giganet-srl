import { revalidatePath } from "next/cache";

/** Invalidate the public homepage so testimonials refresh immediately. */
export function revalidateHomepageTestimonials() {
  try {
    revalidatePath("/", "page");
  } catch (err) {
    console.error("revalidateHomepageTestimonials:", err);
  }
}

/** Keep admin encuestas UI in sync after publishOnHome changes. */
export function revalidateEncuestaAdmin(encuestaId) {
  try {
    revalidatePath("/dashboard/encuestas", "page");
    if (encuestaId) {
      revalidatePath(`/dashboard/encuestas/${encuestaId}`, "page");
    }
  } catch (err) {
    console.error("revalidateEncuestaAdmin:", err);
  }
}
