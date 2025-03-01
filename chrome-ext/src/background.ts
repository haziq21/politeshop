import { addMessageListener } from "./message";

// Respond with the D2L cookies on the active page
addMessageListener("SET_POLITESHOP_COOKIES", async ({ brightspaceJWT }) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url!;

  // document.cookie can't be used for this because the D2L cookies are HttpOnly
  const getCookie = async (name: string) => (await chrome.cookies.get({ url, name }))?.value;
  const d2lSessionVal = await getCookie("d2lSessionVal");
  const d2lSecureSessionVal = await getCookie("d2lSecureSessionVal");
  if (!d2lSessionVal || !d2lSecureSessionVal) {
    throw new Error("D2L cookies not found");
  }

  const cookies = {
    d2lSessionVal,
    d2lSecureSessionVal,
    brightspaceJWT,
    domain: new URL(url).hostname.split(".")[0],
  };

  for (const [name, value] of Object.entries(cookies)) {
    await chrome.cookies.set({
      url: process.env.POLITESHOP_SERVER!,
      name,
      value,
      sameSite: "no_restriction",
      secure: true,
    });
  }
});

addMessageListener("RELOAD", () => chrome.runtime.reload());

chrome.runtime.onInstalled.addListener(() => {
  console.log("POLITEShop extension installed");
});
