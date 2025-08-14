import { WindowMessage } from "../../shared";

// This should be configured through environment variables
const POLITESHOP_URL = "https://politeshop.com";

export default defineContentScript({
  matches: ["*://d2l.polite.edu.sg/d2l/home*"],
  main() {
    // Send the D2L fetch token to the background script
    const d2lFetchToken = getD2lFetchToken();
    if (d2lFetchToken) {
      browser.runtime.sendMessage({
        name: "useD2lFetchToken",
        payload: {
          token: d2lFetchToken,
          hostname: window.location.hostname,
        },
      });
    }

    // Listen for messages from the POLITEShop iframe
    window.addEventListener("message", (event: MessageEvent<WindowMessage>) => {
      if (event.origin !== new URL(POLITESHOP_URL).origin) return;

      if (event.data.type === "URL_PATH_CHANGED") {
        window.history.replaceState(null, "", event.data.payload);
      }
    });

    // Replace the page with the POLITEShop iframe
    const setIframe = () => {
      document.body.innerHTML = "";
      document.body.appendChild(createIframe());
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setIframe, { once: true });
    } else {
      setIframe();
    }
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
  iframe.src = `${POLITESHOP_URL}${window.location.pathname}`;
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  return iframe;
}
