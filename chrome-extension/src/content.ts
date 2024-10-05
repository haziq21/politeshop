import type { FullAuth, HTMXConfigRequestEvent, PolitemallAuth } from "./types";
import { getBrightspaceToken } from "./utils";

async function getFullAuth(): Promise<FullAuth> {
  const politemallAuth: PolitemallAuth = await chrome.runtime.sendMessage("get-politemall-auth");
  const brightspaceToken = getBrightspaceToken();

  return { ...politemallAuth, brightspaceToken };
}

const POLITESHOP_SERVER = "http://localhost:8080";

async function main() {
  const auth = await getFullAuth();

  const baseHTML = (await fetch(chrome.runtime.getURL("static/base.html")).then((res) => res.text())).replace(
    "{{iframeUrl}}",
    `${POLITESHOP_SERVER}/login?redirect=${encodeURIComponent(window.location.pathname)}`
  );

  document.open();
  document.write(baseHTML);
  document.close();

  const politeDomain = window.location.hostname.split(".")[0];

  // Send the POLITEMall credentials to the iframe
  const iframe = document.getElementById("politeshop") as HTMLIFrameElement;
  iframe.onload = () => iframe.contentWindow!.postMessage({ ...auth, politeDomain }, POLITESHOP_SERVER);
}

main();

// Auto-reload the extension in development
if (process.env.ENVIRONMENT === "development") {
  console.log("Connecting to extension reload server...");

  const evtSource = new EventSource("http://localhost:8081");
  evtSource.onmessage = async () => {
    console.log("Reloading extension...");
    await chrome.runtime.sendMessage("reload");
    window.location.reload();
  };
}
