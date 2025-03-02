import { defineConfig } from "vite";
import chromeExtReloader from "./dev/chrome-ext-reloader";

export default defineConfig({
  define: {
    "process.env.ENVIRONMENT": `"${process.env.ENVIRONMENT || "development"}"`,
    "process.env.POLITESHOP_URL": `"${process.env.POLITESHOP_URL || "http://localhost:4321"}"`,
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/background.ts",
      name: "background",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: process.env.ENVIRONMENT === "development" ? [chromeExtReloader] : [],
});
