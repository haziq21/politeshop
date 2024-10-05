import type { PolitemallAuth } from "./types";

/**
 * Returns the D2L cookies on the active page. Needs to be run in a background worker.
 */
export async function getPolitemallAuth(): Promise<PolitemallAuth> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url!;

  const getCookie = async (name: string) => (await chrome.cookies.get({ url, name }))?.value;

  const d2lSessionVal = await getCookie("d2lSessionVal");
  const d2lSecureSessionVal = await getCookie("d2lSecureSessionVal");

  if (!d2lSessionVal || !d2lSecureSessionVal) {
    throw new Error("D2L cookies not found");
  }

  return { d2lSessionVal, d2lSecureSessionVal };
}

export function getBrightspaceToken(): string {
  return JSON.parse(localStorage.getItem("D2L.Fetch.Tokens")!)["*:*:*"].access_token;
}
