import { resolve } from "path";
import { defineConfig } from "vite";
import { chromeExtension } from "vite-plugin-chrome-extension";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env.ENVIRONMENT": '"development"',
    "process.env.POLITESHOP_SERVER": '"http://localhost:7331"',
  },
  build: {
    rollupOptions: {
      input: "src/manifest.json",
    },
  },
  plugins: [chromeExtension()],
});
