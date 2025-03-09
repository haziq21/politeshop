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
      DATABASE_URL: envField.string({ context: "server", access: "secret" }),
      SIGNING_KEY: envField.string({ context: "server", access: "secret" }),
      GEMINI_API_KEY: envField.string({ context: "server", access: "secret" }),
    },
  },
  redirects: {
    "/": "/d2l/home",
  },
});
