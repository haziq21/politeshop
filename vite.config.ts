import { defineConfig } from "vite-plus";

export default defineConfig({
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
