import { AUTH_HEADER_NAMES } from "@politeshop/shared";
import type { SessionCredential } from "../utils";
import { onMessage } from "../utils/messaging";

export default defineBackground(() => {
  // When POLITEMall session cookies change, update declarativeNetRequest rules
  browser.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    if (removed) return; // Only update the DNR rules when new cookies are set
    if (
      cookie.name !== "d2lSessionVal" &&
      cookie.name !== "d2lSecureSessionVal"
    )
      return;

    const subdomain = cookie.domain.match(/^([^.]+)\.polite\.edu\.sg$/)?.[1];
    if (!subdomain) return;

    await setSessionCredentials([
      { name: cookie.name, value: cookie.value, subdomain },
    ]);
  });

  onMessage("setBrightspaceCredentials", async ({ data }) => {
    const { d2lFetchToken, subdomain } = data;
    await setSessionCredentials([
      { name: "d2lFetchToken", value: d2lFetchToken, subdomain },
    ]);
  });

  onMessage("refreshPOLITECredentials", async ({ data: { subdomain } }) => {
    const cookiesToGet: SessionCredential["name"][] = [
      "d2lSessionVal",
      "d2lSecureSessionVal",
    ];

    const cookies = (
      await Promise.all(
        cookiesToGet.map((name) =>
          browser.cookies.getAll({
            name,
            domain: `${subdomain}.${POLITEMALL_BASE_URL.hostname}`,
          }),
        ),
      )
    ).flat();

    const sessionCredentials: SessionCredential[] = cookies.map(
      ({ name, value }) => ({
        name: name as (typeof cookiesToGet)[number],
        value,
        subdomain,
      }),
    );

    await setSessionCredentials(sessionCredentials);
    return sessionCredentials;
  });
});

/**
 * Update the `declarativeNetRequest` session rules to include the
 * specified credentials in the headers of requests to POLITEShop.
 * Existing credentials are left unchanged if not specified.
 */
async function setSessionCredentials(credentials: SessionCredential[]) {
  const newRules = credentials.map(
    ({ name, value, subdomain }): Browser.declarativeNetRequest.Rule => {
      const header = AUTH_HEADER_NAMES[name];
      return {
        // Key the rules based on their subdomain and header name
        id: hash(`${subdomain},${header}`),
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header, value, operation: "set" }],
        },
        condition: {
          initiatorDomains: [
            `${subdomain}.${POLITEMALL_BASE_URL.hostname}`,
            `${subdomain}.${POLITESHOP_BASE_URL.hostname}`,
          ],
          requestDomains: [`${subdomain}.${POLITESHOP_BASE_URL.hostname}`],
          resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"],
        },
      };
    },
  );

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
