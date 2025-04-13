import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  return new Response(null, { status: 500 });
};
