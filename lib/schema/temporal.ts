import { z } from "zod";

/** An ISO 8601 timestamp with an offset, e.g. `2026-03-18T04:00:00.000Z`. */
export const instant = z.string().transform((value, ctx) => {
  try {
    return Temporal.Instant.from(value);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid timestamp: ${value}` });
    return z.NEVER;
  }
});
