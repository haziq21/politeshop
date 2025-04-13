import esbuild from "esbuild";
import { contentConfig, workerConfig } from "./shared-config";

const SSE_PORT_CONTENT = 3001;
// const SSE_PORT_WORKER = 3002;

const ctxContent = await esbuild.context({
  ...contentConfig,
  define: {
    "process.env.ENVIRONMENT": JSON.stringify("development"),
    "process.env.DEV_SERVER": JSON.stringify(`http://localhost:${SSE_PORT_CONTENT}`),
    "process.env.POLITESHOP_URL": JSON.stringify(process.env.POLITESHOP_URL),
    "process.env.IN_WORKER": JSON.stringify(false),
  },
});

const ctxWorker = await esbuild.context({
  ...workerConfig,
  define: {
    "process.env.ENVIRONMENT": JSON.stringify("development"),
    "process.env.DEV_SERVER": JSON.stringify(`http://localhost:${SSE_PORT_CONTENT}`),
    "process.env.POLITESHOP_URL": JSON.stringify(process.env.POLITESHOP_URL),
    "process.env.IN_WORKER": JSON.stringify(true),
  },
});

await ctxContent.watch();
await ctxWorker.watch();
await Promise.all([
  ctxContent.serve({
    servedir: "dist",
    port: SSE_PORT_CONTENT,
  }),
  // ctxWorker.serve({
  //   servedir: "dist",
  //   port: SSE_PORT_WORKER,
  // }),
]);
