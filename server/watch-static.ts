import esbuild from "esbuild";
import events from "node:events";
import { exec } from "child_process";

// Event emitter to notify clients of successful builds
const reloadNotifier = new events.EventEmitter();
reloadNotifier.on("build-success", () => {
  console.log(`Build successful, notifying templ proxy`);
  exec("templ generate --notify-proxy");
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
  entryPoints: ["templates/*.ts"],
  bundle: true,
  outdir: "static",
  define: {
    "process.env.ENVIRONMENT": '"development"',
  },
  plugins: [reloadNotifierPlugin],
});

await ctx.watch();
console.log("Watching for file changes");
