import { NextResponse } from "next/server";
import { getPublicTestimonials } from "@/lib/encuestas/getPublicTestimonials";

/**
 * Public testimonials for the homepage.
 * Always fresh (helper uses noStore) so new publishes appear without rebuild.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") || "9", 10);
  const testimonials = await getPublicTestimonials(limitRaw);

  return NextResponse.json(
    { testimonials },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
