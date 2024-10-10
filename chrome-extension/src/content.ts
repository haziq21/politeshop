import type { D2lAuth, PoliteshopAuth } from "../../shared-ts/types";
import { getBrightspaceToken, getCSRFToken } from "./utils";

async function getPoliteshopAuth(): Promise<PoliteshopAuth> {
  const politemallAuth: D2lAuth = await chrome.runtime.sendMessage("get-politemall-auth");

  return {
    ...politemallAuth,
    brightspaceToken: getBrightspaceToken(),
    politeDomain: window.location.hostname.split(".")[0],
    csrfToken: getCSRFToken(),
  };
}

const POLITESHOP_SERVER = process.env.POLITESHOP_SERVER!;

async function main() {
  const res = await fetch(chrome.runtime.getURL("static/base.html"));
  const iframeUrl = POLITESHOP_SERVER + window.location.pathname;
  const baseHTML = (await res.text()).replace("{{iframeUrl}}", iframeUrl);

  document.open();
  document.write(baseHTML);
  document.close();

  // Send the POLITEMall credentials to the iframe
  const iframe = document.getElementById("politeshop") as HTMLIFrameElement;
  const auth = await getPoliteshopAuth();
  window.onmessage = (event) => {
    if (event.origin !== POLITESHOP_SERVER) {
      console.log(`Received message from unexpected origin: ${event.origin}`);
      return;
    }

    if (event.data === "get-auth") {
      console.log("Received request for POLITEShop authentication");
      iframe.contentWindow!.postMessage(auth, POLITESHOP_SERVER);
    }

    console.log(`Received message from POLITEShop: ${event.data}`);
  };
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
