import type { D2lAuth, PoliteshopAuth } from "./types";
import { getBrightspaceToken, getCSRFToken } from "./utils";

async function getPoliteshopAuth(): Promise<PoliteshopAuth> {
  const politemallAuth: D2lAuth = await chrome.runtime.sendMessage(
    "get-politemall-auth",
  );

  return {
    ...politemallAuth,
    brightspaceToken: getBrightspaceToken(),
    politeDomain: window.location.hostname.split(".")[0],
    csrfToken: getCSRFToken(),
  };
}

const POLITESHOP_SERVER = process.env.POLITESHOP_SERVER!;

(async () => {
  const res = await fetch(chrome.runtime.getURL("base.html"));
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
})();
