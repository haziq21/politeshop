import { z } from "zod";

export const brightspaceJWTBody = z.object({ tenantid: z.string(), sub: z.string() });
