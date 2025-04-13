import { WindowMessage } from "../../../shared";
import { getCookie } from "../background";
import { log } from "../logging";
import { initReloadClient, registerSourceCredentials, verifyPOLITEShopJWTConsistency } from "./helpers";

log("POLITEShop is running!");

const POLITESHOP_URL = process.env.POLITESHOP_URL!;

// TODO: Add CORS to dev server
// Connect to the development server for live reloading
// if (process.env.ENVIRONMENT === "development") initReloadClient();

// Listen for messages from the POLITEShop iframe
window.addEventListener("message", (event: MessageEvent<WindowMessage>) => {
  if (event.origin !== new URL(POLITESHOP_URL).origin) return;

  // Update the POLITEMall URL when the iframe navigates. replaceState() is used
  // instead of pushState() because the iframe already has its own history stack,
  // so we don't want to create a new entry in the browser's history stack.
  if (event.data.type === "URL_PATH_CHANGED") window.history.replaceState(null, "", event.data.payload);
});

(async () => {
  log("Retrieving cookies...");

  // Retrieve all the relevant cookies
  const [d2lSessionVal, d2lSecureSessionVal, politeshopJWT] = await Promise.all([
    getCookie({ name: "d2lSessionVal", url: window.location.toString() }),
    getCookie({ name: "d2lSecureSessionVal", url: window.location.toString() }),
    getCookie({ name: "politeshopJWT", url: POLITESHOP_URL }),
  ]);

  log(`d2lSessionVal: ${d2lSessionVal}`);
  log(`d2lSecureSessionVal: ${d2lSecureSessionVal}`);
  log(`politeshopJWT: ${politeshopJWT}`);

  // POLITEShop needs d2lSessionVal and d2lSecureSessionVal to proceed
  if (!d2lSessionVal || !d2lSecureSessionVal) {
    log("Redirecting to D2L login page...");
    // window.location.pathname = "/d2l/login";
    // This is redundant since redirection would stop execution, but typescript
    // needs it to infer that d2lSessionVal and d2lSecureSessionVal are not null
    return;
  }

  // (Re-)register the source credentials if they're missing or inconsistent with the current POLITEMall session
  if (
    !politeshopJWT ||
    !(await verifyPOLITEShopJWTConsistency(politeshopJWT, { d2lSessionVal, d2lSecureSessionVal }))
  ) {
    await registerSourceCredentials({ d2lSessionVal, d2lSecureSessionVal });
  }

  // Replace the page with the POLITEShop iframe
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appendIframe, { once: true });
  } else {
    appendIframe();
  }
})();

function appendIframe() {
  const iframe = document.createElement("iframe");
  iframe.src = `${POLITESHOP_URL}${window.location.pathname}`;
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  document.body.appendChild(iframe);
}
