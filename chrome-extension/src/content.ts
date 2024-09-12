import type { FullAuth, PolitemallAuth } from "./types";
import { getBrightspaceToken } from "./utils";

async function getFullAuth(): Promise<FullAuth> {
  const politemallAuth: PolitemallAuth = await chrome.runtime.sendMessage("get-politemall-auth");
  const brightspaceToken = getBrightspaceToken();

  return { ...politemallAuth, brightspaceToken };
}

getFullAuth().then(console.log);
