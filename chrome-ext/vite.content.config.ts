import { defineConfig } from "vite";
import chromeExtReloader from "./dev/chrome-ext-reloader";

export default defineConfig({
  define: {
    "process.env.ENVIRONMENT": '"development"',
    "process.env.DEV_SERVER": '"http://localhost:3001/sse"',
    "process.env.POLITESHOP_SERVER": '"http://localhost:4321"',
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/content/index.ts",
      name: "content",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "content.js",
      },
    },
  },
  plugins: [chromeExtReloader],
});
