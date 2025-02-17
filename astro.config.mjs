// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';

import cloudflare from '@astrojs/cloudflare';

import db from '@astrojs/db';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte(), db()],
  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()]
  }
});