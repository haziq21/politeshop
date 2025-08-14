import { WindowMessage } from "../../../shared";
import { bkg } from "../background";
import { log } from "../logging";

log("POLITEShop is running!");

const POLITESHOP_URL = process.env.POLITESHOP_URL!;

// Connect to the development server for live reloading
if (process.env.ENVIRONMENT === "development") initReloadClient();

// Listen for messages from the POLITEShop iframe
window.addEventListener("message", (event: MessageEvent<WindowMessage>) => {
  if (event.origin !== new URL(POLITESHOP_URL).origin) return;

  // Update the POLITEMall URL when the iframe navigates. replaceState() is used
  // instead of pushState() because the iframe already has its own history stack,
  // so we don't want to create a new entry in the browser's history stack.
  if (event.data.type === "URL_PATH_CHANGED") window.history.replaceState(null, "", event.data.payload);
});

(async () => {
  await updateCredentials();
  const setIframe = () => document.body.appendChild(createIframe());

  // Replace the page with the POLITEShop iframe
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setIframe, { once: true });
  } else setIframe();
})();

function getD2lFetchToken(): string | null {
  const tokens = localStorage.getItem("D2L.Fetch.Tokens");
  if (!tokens) return null;

  try {
    const parsedTokens = JSON.parse(tokens);
    return parsedTokens?.["*:*:*"]?.access_token || null;
  } catch {
    return null;
  }
}

/** Update the background script with new credentials. */
async function updateCredentials() {
  let d2lFetchToken = getD2lFetchToken();
  if (d2lFetchToken) await bkg.useD2lFetchToken(d2lFetchToken, window.location.hostname);
}

function createIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = `${POLITESHOP_URL}${window.location.pathname}`;
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  return iframe;
}

/** Initialize the SSE connection to the live reload server, for use during development. */
function initReloadClient() {
  const eventSource = new EventSource(process.env.LIVE_RELOAD_URL!);
  eventSource.addEventListener("open", bkg.reload);
  eventSource.addEventListener("change", async () => {
    await bkg.reload();
    window.location.reload();
  });
}
