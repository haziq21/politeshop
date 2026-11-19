import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  test: {
    include: ["app/src/**/*.test.ts"],
    setupFiles: ["app/src/vitest-setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      viewport: { width: 1280, height: 720 },
      instances: [{ browser: "chromium" }],
    },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    rules: { "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
  fmt: {
    svelte: true,
    sortImports: {
      groups: [
        "type-import",
        ["value-builtin", "value-external"],
        "type-internal",
        "value-internal",
        ["type-parent", "type-sibling", "type-index"],
        ["value-parent", "value-sibling", "value-index"],
        "unknown",
      ],
    },
    printWidth: 120,
    sortTailwindcss: { stylesheet: "app/src/routes/layout.css" },
  },
});
