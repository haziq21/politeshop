import tsParser from "@typescript-eslint/parser";
import tailwind from "eslint-plugin-better-tailwindcss";
import svelteParser from "svelte-eslint-parser";

const shared = {
  plugins: { "better-tailwindcss": tailwind },
  settings: { "better-tailwindcss": { cwd: "app", entryPoint: "src/routes/layout.css" } },
  rules: { "better-tailwindcss/enforce-canonical-classes": "error" },
};

// Only the Tailwind class rules live here; everything else is handled by `vp check`.
export default [
  { ignores: ["**/node_modules/**", "**/.svelte-kit/**", "**/.output/**", "**/build/**"] },
  { ...shared, files: ["app/**/*.ts"], languageOptions: { parser: tsParser } },
  {
    ...shared,
    files: ["app/**/*.svelte"],
    languageOptions: { parser: svelteParser, parserOptions: { parser: tsParser } },
  },
];
