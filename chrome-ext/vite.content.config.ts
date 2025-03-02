import { defineConfig } from "vite";
import chromeExtReloader from "./dev/chrome-ext-reloader";

export default defineConfig({
  define: {
    "process.env.ENVIRONMENT": `"${process.env.ENVIRONMENT || "development"}"`,
    "process.env.POLITESHOP_URL": `"${process.env.POLITESHOP_URL || "http://localhost:4321"}"`,
    "process.env.DEV_SERVER": '"http://localhost:3001/sse"',
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
  plugins: process.env.ENVIRONMENT === "development" ? [chromeExtReloader] : [],
});
