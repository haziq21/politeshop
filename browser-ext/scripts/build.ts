import esbuild from "esbuild";
import { contentConfig, workerConfig } from "./shared-config";

await esbuild.build({
  ...contentConfig,
  minify: true,
  define: {
    "process.env.ENVIRONMENT": JSON.stringify("production"),
    "process.env.POLITESHOP_URL": JSON.stringify(process.env.POLITESHOP_URL),
    "process.env.IN_WORKER": JSON.stringify(false),
  },
});

await esbuild.build({
  ...workerConfig,
  minify: true,
  define: {
    "process.env.ENVIRONMENT": JSON.stringify("production"),
    "process.env.POLITESHOP_URL": JSON.stringify(process.env.POLITESHOP_URL),
    "process.env.IN_WORKER": JSON.stringify(true),
  },
});
