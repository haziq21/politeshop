import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: "./index.ts",
    format: "esm",
    fixedExtension: false,
    dts: true,
    deps: { neverBundle: ["jose", "zod"] },
  },
});
