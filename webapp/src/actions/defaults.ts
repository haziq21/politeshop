import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const setDefaultSemesterFilter = defineAction({
  input: z.string().optional(),
  handler: async (input, context) => {
    const repo = context.locals.repo;
    repo.setDefaultSemesterFilter(input);
  },
});
