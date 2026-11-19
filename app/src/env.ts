import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  DATABASE_URL: {},
  OPENROUTER_API_KEY: {},
});
