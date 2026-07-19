import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("pnpm --filter @politeshop/ext build", {
    cwd: new URL("../..", import.meta.url),
    stdio: "inherit",
  });
}
