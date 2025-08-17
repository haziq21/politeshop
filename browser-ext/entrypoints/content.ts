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

      if (event.data.type === "TITLE_CHANGED") {
        document.title = event.data.payload;
      }
    });

    // Replace the page with the POLITEShop iframe
    setTimeout(() => {
      // Stop loading any scripts / styles from POLITEMall
      window.stop();

      // Remove all attributes from <html>
      Array.from(document.documentElement.attributes).forEach((attr) =>
        document.documentElement.removeAttribute(attr.name)
      );

      // Clear the <head> and <body>
      document.head.innerHTML = "";
      if (document.body) document.body.innerHTML = "";
      else document.documentElement.appendChild(document.createElement("body"));

      // Create the POLITEShop iframe
      document.body.appendChild(createPOLITEShopIframe());
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

function createPOLITEShopIframe(): HTMLIFrameElement {
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
