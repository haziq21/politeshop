import { CREDENTIAL_HEADER_MAPPINGS } from "../../shared";

const POLITESHOP_DOMAIN: string = new URL(import.meta.env.WXT_POLITESHOP_ORIGIN ?? "http://localhost:4321").hostname;

type SessionCredential = {
  name: keyof typeof CREDENTIAL_HEADER_MAPPINGS;
  value: string;
  domain: string;
};

export default defineBackground(() => {
  // When the browser starts up, retrieve all POLITEMall session cookies and set them as declarativeNetRequest rules
  browser.runtime.onStartup.addListener(setCookieCredentials);
  browser.runtime.onInstalled.addListener(setCookieCredentials);

  // When POLITEMall session cookies change, update declarativeNetRequest rules
  browser.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    if (removed) return; // Only update our declarativeNetRequest rules when new cookies are set
    if (cookie.name !== "d2lSessionVal" && cookie.name !== "d2lSecureSessionVal") return;
    if (!/^(.+\.)?polite\.edu\.sg$/.test(cookie.domain)) return;
    await setSessionCredentials([{ name: cookie.name, value: cookie.value, domain: cookie.domain }]);
  });

  browser.runtime.onMessage.addListener(async (msg: BackgroundMessage) => {
    if (msg.name !== "useD2lFetchToken") return;

    const subdomainMatch = msg.payload.domain.match(/^([^.]+)\./);
    const subdomain = subdomainMatch ? subdomainMatch[1] : msg.payload.domain;

    await setSessionCredentials([
      // Update `declarativeNetRequest` rules to include the token
      { name: "d2lFetchToken", value: msg.payload.token, domain: msg.payload.domain },
      // Also include the D2L subdomain
      { name: "d2lSubdomain", value: subdomain, domain: msg.payload.domain },
    ]);
  });
});

async function setCookieCredentials() {
  log(`Setting cookie credentials`);

  const cookiesToGet: SessionCredential["name"][] = ["d2lSessionVal", "d2lSecureSessionVal"];
  const cookies = (await Promise.all(cookiesToGet.map((name) => browser.cookies.getAll({ name })))).flat();

  await setSessionCredentials(
    cookies.map(({ name, value, domain }) => ({
      name: name as (typeof cookiesToGet)[number],
      value,
      domain,
    }))
  );
}

/**
 * Update the `declarativeNetRequest` session rules to include the
 * specified credentials in the headers of requests to POLITEShop.
 * Existing credentials are left unchanged if not specified.
 */
async function setSessionCredentials(credentials: SessionCredential[]) {
  const newRules = credentials.map(({ name, value, domain }): Browser.declarativeNetRequest.Rule => {
    const header = CREDENTIAL_HEADER_MAPPINGS[name];
    return {
      // Key the rules based on their domain and header name
      id: hash(`${domain},${header}`),
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

  log(`Setting session rules:`, newRules);

  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: newRules.map((rule) => rule.id),
    addRules: newRules,
  });
}

/**
 * Hash a string to a positive 32-bit integer (to align
 * with declarativeNetRequest's rule ID restrictions).
 */
function hash(str: string): number {
  // Hash with djb2
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }

  // Modification of djb2: constrain the hash to a positive 32-bit signed integer
  const mask = (1 << 31) - 1;
  return hash & mask || 1;
}
