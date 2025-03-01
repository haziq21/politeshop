import { WindowMessage } from "../../../shared";
import { msgBackground } from "../message";
import { connectDevServer, getBrightspaceToken } from "./helpers";

const POLITESHOP_URL = process.env.POLITESHOP_SERVER!;
if (process.env.ENVIRONMENT === "development") {
  connectDevServer();
}

// Top-level awaits aren't supported when bundling in IIFE mode
(async () => {
  // Set the POLITEShop cookies before the iframe is loaded so that the initial request is authenticated
  await msgBackground({ type: "SET_POLITESHOP_COOKIES", payload: { brightspaceJWT: getBrightspaceToken() } });
  console.log("POLITEShop cookies set!");

  // Replace the page contents with our base.html
  console.log("Injecting POLITEShop iframe");
  const res = await fetch(chrome.runtime.getURL("base.html"));
  const baseHTML = await res.text();
  document.open();
  document.write(baseHTML);
  document.close();

  // Load the POLITEShop iframe
  const iframe = document.getElementById("politeshop") as HTMLIFrameElement;
  iframe.src = `${POLITESHOP_URL}${window.location.pathname}`;

  window.onmessage = (event: MessageEvent<WindowMessage>) => {
    if (event.origin !== POLITESHOP_URL) return;

    // Update the POLITEMall URL when the iframe navigates
    if (event.data.type === "URL_PATH_CHANGED") window.history.pushState({}, "", event.data.payload);
  };
})();
