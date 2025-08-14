const POLITESHOP_DOMAIN: string = new URL(import.meta.env.WXT_POLITESHOP_ORIGIN ?? "http://localhost:4321").hostname;

export default defineBackground(() => {
  // When the browser starts up, retrieve all POLITEMall session cookies and set them as declarativeNetRequest rules
  browser.runtime.onStartup.addListener(async () => {
    const cookiesToGet: SessionCredential["name"][] = ["d2lSessionVal", "d2lSecureSessionVal"];
    const cookies = (await Promise.all(cookiesToGet.map((name) => browser.cookies.getAll({ name })))).flat();

    await setSessionCredentials(
      cookies.map(({ name, value, domain }) => ({
        name: name as (typeof cookiesToGet)[number],
        value,
        domain,
      }))
    );
  });

  // When POLITEMall session cookies change, update declarativeNetRequest rules
  browser.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    if (removed) return; // Only update our declarativeNetRequest rules when new cookies are set
    if (cookie.name !== "d2lSessionVal" && cookie.name !== "d2lSecureSessionVal") return;
    if (!/^(.+\.)?polite\.edu\.sg$/.test(cookie.domain)) return;
    await setSessionCredentials([{ name: cookie.name, value: cookie.value, domain: cookie.domain }]);
  });

  browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
    if (msg.name !== "useD2lFetchToken") return;

    // Update `declarativeNetRequest` rules to include the token in requests to POLITEShop
    setSessionCredentials([{ name: "d2lFetchToken", value: msg.payload.token, domain: msg.payload.domain }]);
  });
});

/** Maps credential names to the header names that POLITEShop expects. */
const HEADER_MAPPINGS = {
  d2lSessionVal: "X-D2l-Session-Val",
  d2lSecureSessionVal: "X-D2l-Secure-Session-Val",
  d2lFetchToken: "X-D2l-Fetch-Token",
} as const;

type SessionCredential = {
  name: keyof typeof HEADER_MAPPINGS;
  value: string;
  domain: string;
};

/**
 * Update the `declarativeNetRequest` session rules to include the
 * specified credentials in the headers of requests to POLITEShop.
 * Existing credentials are left unchanged if not specified.
 */
async function setSessionCredentials(credentials: SessionCredential[]) {
  const newRules = credentials.map(({ name, value, domain }): Browser.declarativeNetRequest.Rule => {
    const header = HEADER_MAPPINGS[name];
    return {
      // Key the rules based on their domain and header name
      id: djb2Hash(`${domain},${header}`),
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header, value, operation: "set" }],
      },
      condition: {
        initiatorDomains: [domain, POLITESHOP_DOMAIN],
        requestDomains: [POLITESHOP_DOMAIN],
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
      },
    };
  });

  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [],
    addRules: newRules,
  });
}

/**
 * Hash a string with djb2.
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash >>> 0;
}
