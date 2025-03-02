import { log } from "./logging";
import { addMessageListener } from "./message";

// Respond with the D2L cookies on the active page
addMessageListener("SET_POLITESHOP_COOKIES", async ({ brightspaceJWT, currentURL: url }) => {
  // document.cookie can't be used for this because the D2L cookies are HttpOnly
  const getCookie = async (name: string) => (await chrome.cookies.get({ url, name }))?.value;
  const [d2lSessionVal, d2lSecureSessionVal] = await Promise.all([
    getCookie("d2lSessionVal"),
    getCookie("d2lSecureSessionVal"),
  ]);
  if (!d2lSessionVal || !d2lSecureSessionVal) throw new Error("D2L cookies not found");

  const cookies = {
    d2lSessionVal,
    d2lSecureSessionVal,
    brightspaceJWT,
    domain: new URL(url).hostname.split(".")[0],
  };

  await Promise.all(
    Object.entries(cookies).map(
      async ([name, value]) =>
        await chrome.cookies.set({
          url: process.env.POLITESHOP_URL!,
          name,
          value,
          sameSite: "no_restriction",
          secure: true,
        })
    )
  );
});

addMessageListener("RELOAD", () => chrome.runtime.reload());

chrome.runtime.onInstalled.addListener(() => {
  log("POLITEShop extension installed");
});
