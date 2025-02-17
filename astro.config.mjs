// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import db from "@astrojs/db";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte(), db()],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
