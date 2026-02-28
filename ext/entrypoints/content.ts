import { WindowMessage } from "@politeshop/shared";

export default defineContentScript({
  matches: [
    "https://*.polite.edu.sg/d2l/home",
    "https://*.polite.edu.sg/d2l/home/*",
  ],
  runAt: "document_start",
  async main() {
    const subdomain = window.location.hostname.split(".")[0];
    const iframeOrigin = `${POLITESHOP_BASE_URL.protocol}//${subdomain}.${POLITESHOP_BASE_URL.host}`;

    log("POLITEShop is running");

    let { token: d2lFetchToken, expiry } = getD2lFetchToken();

    if (expiry && expiry < new Date()) {
      log("D2L.Fetch.Tokens expired");
      log("Extracting POLITEMall XSRF token");
      const xsrfToken = await extractXsrfToken();

      // If we can't get a new d2lFetchToken, it's probably because the xsrf
      // token can't be extracted from the document because POLITEMall returned
      // a blank document with a redirect to /d2l/login (i.e. the session expired)
      if (!xsrfToken) {
        log("Failed to extract POLITEMall XSRF token");
      } else {
        d2lFetchToken = (await newD2lFetchToken(xsrfToken)).token;
        if (!d2lFetchToken) log("Failed to get new D2L.Fetch.Tokens");
      }
    } else if (!d2lFetchToken) log("Failed to retrieve D2L.Fetch.Tokens");

    // Update the credentials we're sending to the POLITEShop server
    const politePromise = browser.runtime.sendMessage<BackgroundMessage>({
      name: "refreshPOLITECredentials",
      payload: { subdomain },
    });
    const brightspacePromise = d2lFetchToken
      ? browser.runtime.sendMessage<BackgroundMessage>({
          name: "setBrightspaceCredentials",
          payload: { d2lFetchToken, subdomain },
        })
      : null;

    await Promise.all([politePromise, brightspacePromise]);

    // Listen for messages from the POLITEShop iframe
    window.addEventListener("message", (event: MessageEvent<WindowMessage>) => {
      if (event.origin !== iframeOrigin) return;

      if (event.data.type === "LOCATION_CHANGED") {
        window.history.replaceState(null, "", event.data.payload.path);
        document.title = event.data.payload.title;
      }

      if (event.data.type === "REDIRECT_LOGIN") {
        log("Redirecting to POLITEMall login");
        const sessionExpired = encodeURIComponent(
          event.data.payload.sessionExpired,
        );
        const target = encodeURIComponent(event.data.payload.target);
        window.location.replace(
          `/d2l/login?sessionExpired=${sessionExpired}&target=${target}`,
        );
      }
    });

    // Replace the page with the POLITEShop iframe. Without
    // this timeout, the page sometimes goes blank even though
    // the DOM (as seen through devtools) includes the iframe.
    setTimeout(() => {
      // Stop loading any scripts / styles from POLITEMall
      window.stop();

      // Remove all attributes from <html>
      Array.from(document.documentElement.attributes).forEach((attr) =>
        document.documentElement.removeAttribute(attr.name),
      );

      // Clear the <head> and <body>
      document.head.innerHTML = "";
      if (document.body) document.body.innerHTML = "";
      else document.documentElement.appendChild(document.createElement("body"));

      // Create the POLITEShop iframe
      document.body.appendChild(
        createIframe(`${iframeOrigin}${window.location.pathname}`),
      );
    });
  },
});

/** Retrieve the d2lFetchToken from `localStorage`. */
function getD2lFetchToken(): { token?: string; expiry?: Date } {
  const tokens = localStorage.getItem("D2L.Fetch.Tokens");
  if (!tokens) return {};
  return parseD2lFetchTokenJSON(tokens);
}

/** Retrieve a new d2lFetchToken from the POLITEMall API and store it in `localStorage`. */
async function newD2lFetchToken(
  xsrfToken: string,
): Promise<{ token?: string; expiry?: Date }> {
  const res = await fetch("/d2l/lp/auth/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Csrf-Token": xsrfToken,
    },
    body: "scope=*:*:*",
  });

  if (res.status !== 200) {
    log(`Got ${res.status} ${res.statusText} from token endpoint`);
    return {};
  }

  const { token, expiry } = parseD2lFetchTokenJSON(await res.text());
  if (!token || !expiry) return {};

  localStorage.setItem(
    "D2L.Fetch.Tokens",
    JSON.stringify({
      "*:*:*": { expires_at: expiry.getTime() / 1000, access_token: token },
    }),
  );
  return { token, expiry };
}

function parseD2lFetchTokenJSON(json: string): {
  token?: string;
  expiry?: Date;
} {
  try {
    const obj = JSON.parse(json);
    let expires_at, access_token;

    if (Object.hasOwn(obj, "*:*:*")) {
      ({ expires_at, access_token } = obj["*:*:*"]);
    } else {
      ({ expires_at, access_token } = obj);
    }

    if (typeof expires_at !== "number" || typeof access_token !== "string")
      return {};
    return { token: access_token, expiry: new Date(expires_at * 1000) };
  } catch {
    return {};
  }
}

function createIframe(url: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  return iframe;
}

/** Extract POLITEMall's XSRF token from the provided HTML, or `document.scripts` otherwise. */
async function extractXsrfToken(html?: string): Promise<string | undefined> {
  const matcher = /\.setItem\(['"]XSRF.Token['"],\s*['"](.+?)['"]\)/;

  // Find the token in HTML if provided
  if (html) return html.match(matcher)?.at(1);

  // Otherwise, find it in the document's scripts
  await ensureDocumentLoaded();
  for (const script of document.scripts) {
    const match = script.innerHTML.match(matcher)?.at(1);
    if (match) return match;
  }

  return undefined;
}

/** Return a promise that resolves when the document finishes loading. */
function ensureDocumentLoaded(): Promise<void> {
  if (document.readyState === "loading") {
    return new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve());
    });
  }
  return Promise.resolve();
}
