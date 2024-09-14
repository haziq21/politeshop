import type { FullAuth, PolitemallAuth } from "./types";
import { getBrightspaceToken } from "./utils";

async function getFullAuth(): Promise<FullAuth> {
  const politemallAuth: PolitemallAuth = await chrome.runtime.sendMessage("get-politemall-auth");
  const brightspaceToken = getBrightspaceToken();

  return { ...politemallAuth, brightspaceToken };
}

getFullAuth().then((a) => {
  console.log(
    Object.entries(a)
      .map(([k, v]) => `export ${k.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}="${v}"`)
      .join("\n")
  );
});
