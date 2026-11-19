import { dev } from "$app/env";

import { mockwright } from "#lib/server/mockwright.ts";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response(null, { status: 404 });
  return Response.json(mockwright.handle(await request.json(), request.headers.get("x-test-id")));
};
