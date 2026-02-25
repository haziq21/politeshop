import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "./index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["date-fns", "jose", "zod"],
    },
  },
  plugins: [
    dts({
      tsconfigPath: "./tsconfig.build.json",
      include: ["./**/*.ts"],
      exclude: ["dist", "node_modules", "scripts", "vite.config.ts"],
    }),
  ],
});
