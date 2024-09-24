import type { FullAuth, PolitemallAuth } from "./types";
import { getBrightspaceToken, getPoliteDomain } from "./utils";

async function getFullAuth(): Promise<FullAuth> {
  const politemallAuth: PolitemallAuth = await chrome.runtime.sendMessage("get-politemall-auth");
  const brightspaceToken = getBrightspaceToken();

  return { ...politemallAuth, brightspaceToken };
}

function envrcFromAuth(auth: FullAuth): string {
  return Object.entries(auth)
    .map(([k, v]) => `export ${k.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}="${v}"`)
    .join("\n");
}

const POLITESHOP_SERVER = "http://localhost:8080";

async function main() {
  const auth = await getFullAuth();

  console.log(envrcFromAuth(auth));

  const res = await fetch(POLITESHOP_SERVER, {
    headers: {
      "X-Polite-Domain": getPoliteDomain(),
      "X-D2l-Session-Val": auth.d2lSessionVal,
      "X-D2l-Secure-Session-Val": auth.d2lSecureSessionVal,
      "X-Brightspace-Token": auth.brightspaceToken,
    },
  });

  console.log(res);
}

main();
