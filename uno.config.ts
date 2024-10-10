import { defineConfig } from "unocss";

export default defineConfig({
  content: {
    pipeline: { include: ["**/*.{templ,html}"] },
  },
});
