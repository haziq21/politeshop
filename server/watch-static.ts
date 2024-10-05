import express from "express";
import cors from "cors";
import esbuild from "esbuild";
import events from "node:events";
import { watch, cp, rm, glob } from "node:fs/promises";

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

const entryPoints: string[] = [];
for await (const filepath of glob("templates/*.ts")) {
  entryPoints.push(filepath);
}

const ctx = await esbuild.context({
  entryPoints,
  bundle: true,
  outdir: "static",
  define: {
    "process.env.ENVIRONMENT": '"development"',
  },
  plugins: [reloadNotifierPlugin],
});

await ctx.watch();
console.log("Watching for file changes");
