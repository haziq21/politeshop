import esbuild from "esbuild";

const shared: esbuild.BuildOptions = {
  loader: { ".json": "copy", ".html": "copy" },
  bundle: true,
  outdir: "dist",
  format: "esm",
};

export const workerConfig: esbuild.BuildOptions = {
  ...shared,
  entryPoints: {
    background: "src/background.ts",
  },
};

export const contentConfig: esbuild.BuildOptions = {
  ...shared,
  entryPoints: {
    content: "src/content/index.ts",
    manifest: "public/manifest.json",
    base: "public/base.html",
  },
};
