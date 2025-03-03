import { WindowMessage } from "../../../shared";
import { log } from "../logging";
import { msgBackground } from "../message";
import { connectDevServer, getBrightspaceToken, overwritePage as overwritePageWithIframe } from "./helpers";

log("POLITEShop is running");

const POLITESHOP_URL = process.env.POLITESHOP_URL!;

// Connect to the development server for live reloading
if (process.env.ENVIRONMENT === "development") connectDevServer();

const setPOLITEShopCookies = async () => {
  log("Setting POLITEShop cookies (this could take a while)");
  await msgBackground({
    type: "SET_POLITESHOP_COOKIES",
    payload: {
      brightspaceJWT: getBrightspaceToken(),
      currentURL: window.location.toString(),
    },
  });
  log("POLITEShop cookies set");
};

const injectPOLITEShopIframe = async () => {
  log("Injecting POLITEShop iframe");
  const iframe = await overwritePageWithIframe();
  iframe.src = `${POLITESHOP_URL}${window.location.pathname}`;
};

const politeshopJWTWasSet = document.cookie.split(";").some((cookie) => cookie.trim().startsWith("politeshopJWT="));

// Top-level awaits aren't supported when bundling in IIFE mode
(async () => {
  // It seems that the Chrome APIs (message passing & cookies) are rather slow sometimes (2-20s
  // delay??). To minimise delay, we only set the POLITEShop cookies before injecting the iframe
  // if the "politeshopJWT" cookie isn't already set. This would indicate that the user probably
  // hasn't been registered with POLITEShop yet, so the initial request (redirected to /register)
  // would require all the D2L and Brightspace cookies to be set. Otherwise, we can just set the
  // POLITEShop cookies and inject the iframe at the same time.
  //
  // NOTE: I restarted my laptop and now the delay doesn't seem to appear anymore...
  if (!politeshopJWTWasSet) {
    await setPOLITEShopCookies();
    await injectPOLITEShopIframe();
  } else {
    await Promise.all([setPOLITEShopCookies(), injectPOLITEShopIframe()]);
  }

  // Listen for messages from the POLITEShop iframe
  window.addEventListener("message", (event: MessageEvent<WindowMessage>) => {
    if (event.origin !== new URL(POLITESHOP_URL).origin) return;

    // Update the POLITEMall URL when the iframe navigates. replaceState() is used
    // instead of pushState() because the iframe already has its own history stack,
    // so we don't want to create a new entry in the browser's history stack.
    if (event.data.type === "URL_PATH_CHANGED") window.history.replaceState(null, "", event.data.payload);
  });
})();
