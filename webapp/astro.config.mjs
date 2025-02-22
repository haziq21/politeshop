// @ts-check
import { defineConfig, envField } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  adapter: vercel(),
  output: "server",
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      D2L_SESSION_VAL: envField.string({ context: "server", access: "secret", optional: true }),
      D2L_SECURE_SESSION_VAL: envField.string({ context: "server", access: "secret", optional: true }),
      BRIGHTSPACE_JWT: envField.string({ context: "server", access: "secret", optional: true }),
      POLITE_DOMAIN: envField.string({ context: "server", access: "secret", optional: true }),
      DATABASE_URL: envField.string({ context: "server", access: "secret" }),
      SIGNING_KEY: envField.string({ context: "server", access: "secret" }),
    },
  },
});
