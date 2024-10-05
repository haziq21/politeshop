import express from "express";
import cors from "cors";
import esbuild from "esbuild";
import events from "node:events";
import { watch, cp, rm } from "node:fs/promises";

// Event emitter to notify clients of successful builds
const reloadNotifier = new events.EventEmitter();
reloadNotifier.on("build-success", () => {
  console.log(`Build successful, notifying ${reloadNotifier.listenerCount("build-success") - 1} clients`);
});

// Server to trigger extension reloads via SSE
const app = express().use(cors());

app.get("/", (req, res) => {
  // Headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendBuildSuccessMessage = () => {
    res.write("data: build-success\n\n");
  };

  reloadNotifier.on("build-success", sendBuildSuccessMessage);

  req.on("close", () => {
    reloadNotifier.removeListener("build-success", sendBuildSuccessMessage);
  });
});

app.listen(8081, () => {
  console.log("Reload server listening on http://localhost:8081");
});

const reloadNotifierPlugin: esbuild.Plugin = {
  name: "reload-notifier",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) reloadNotifier.emit("build-success");
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ["src/content.ts", "src/worker.ts"],
  bundle: true,
  outdir: "dist",
  define: {
    "process.env.ENVIRONMENT": '"development"',
  },
  plugins: [reloadNotifierPlugin],
});

await ctx.watch();
watchCopy("static", "dist/static");
watchCopy("manifest.json", "dist/manifest.json");
console.log("Watching for file changes");

// Watch for static assets ourselves because esbuild-plugin-copy
// depends on the `watch` ESBuild build option, which has been removed
async function watchCopy(source: string, destination: string) {
  const copy = async () => {
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
  };
  await copy();

  const watcher = watch(source, { recursive: true });
  for await (const _ of watcher) {
    await copy();
    reloadNotifier.emit("build-success");
  }
}
