import { execSync } from "node:child_process";

/** Builds the extension (once, before the whole suite) so `e2e/fixtures.ts` has a `.output/chrome-mv3` to load. */
export default function globalSetup() {
  execSync("pnpm --filter @politeshop/ext build", {
    cwd: new URL("../..", import.meta.url),
    stdio: "inherit",
  });
}
