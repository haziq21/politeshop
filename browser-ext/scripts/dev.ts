import esbuild from "esbuild";
import { contentConfig, workerConfig } from "./shared-config";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

const ESBUILD_PORT = 3001;
const PROXY_PORT = 3002;

const ctxContent = await esbuild.context({
  ...contentConfig,
  define: {
    "process.env.ENVIRONMENT": JSON.stringify("development"),
    "process.env.LIVE_RELOAD_URL": JSON.stringify(`http://localhost:${PROXY_PORT}/esbuild`),
    "process.env.POLITESHOP_URL": JSON.stringify(process.env.POLITESHOP_URL),
    "process.env.IN_WORKER": JSON.stringify(false),
  },
});

const ctxWorker = await esbuild.context({
  ...workerConfig,
  define: {
    "process.env.ENVIRONMENT": JSON.stringify("development"),
    "process.env.LIVE_RELOAD_URL": JSON.stringify(`http://localhost:${PROXY_PORT}/esbuild`),
    "process.env.POLITESHOP_URL": JSON.stringify(process.env.POLITESHOP_URL),
    "process.env.IN_WORKER": JSON.stringify(true),
  },
});

await ctxContent.watch();
await ctxWorker.watch();

// No need to serve ctxWorker because the content script depends on the
// background (worker) script, so changes to the background script will
// already notify SSE clients connected to the serve endpoint for ctxContent.
await ctxContent.serve({
  servedir: "dist",
  port: ESBUILD_PORT,
});

// Proxy server to enable CORS so that the extension running
// on *.polite.edu.sg can access the live reload SSE endpoint
express()
  .use(cors({ origin: /^https:\/\/.+\.polite\.edu\.sg$/ }))
  .use(
    createProxyMiddleware({
      target: `http://localhost:${ESBUILD_PORT}`,
      changeOrigin: true,
    })
  )
  .listen(PROXY_PORT);
