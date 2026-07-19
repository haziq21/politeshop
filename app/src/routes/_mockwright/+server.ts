import { dev } from "$app/environment";
import { mockwright } from "$lib/server/mockwright";
import { json } from "@sveltejs/kit";

export const POST = async ({ request }) => {
  if (!dev) return new Response(null, { status: 404 });
  return json(mockwright.handle(await request.json(), request.headers.get("x-test-id")));
};
