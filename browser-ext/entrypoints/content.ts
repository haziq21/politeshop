import { WindowMessage } from "../../shared";

const POLITESHOP_ORIGIN: string = import.meta.env.WXT_POLITESHOP_ORIGIN ?? "https://localhost:4321";

export default defineContentScript({
  matches: ["https://*.polite.edu.sg/d2l/home", "https://*.polite.edu.sg/d2l/home/*"],
  runAt: "document_start",
  main() {
    // Send the D2L fetch token to the background script
    const d2lFetchToken = getD2lFetchToken();
    if (d2lFetchToken) {
      browser.runtime.sendMessage({
        name: "useD2lFetchToken",
        payload: {
          token: d2lFetchToken,
          domain: window.location.hostname,
        },
      } as BackgroundMessage);
    }

    // Listen for messages from the POLITEShop iframe
    window.addEventListener("message", (event: MessageEvent<WindowMessage>) => {
      if (event.origin !== POLITESHOP_ORIGIN) return;

      if (event.data.type === "URL_PATH_CHANGED") {
        window.history.replaceState(null, "", event.data.payload);
      }
    });

    // Replace the page with the POLITEShop iframe
    onceDocumentLoaded(() => {
      document.body.innerHTML = "";
      document.body.appendChild(createIframe());
    });
  },
});

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

function createIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = `${POLITESHOP_ORIGIN}${window.location.pathname}`;
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  return iframe;
}

function onceDocumentLoaded(callback: () => void) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}
