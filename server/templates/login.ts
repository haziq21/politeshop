import type { PoliteshopAuth } from "../../shared-ts/types";

// Receive POLITEShop authentication from the Chrome extension and set them as cookies
window.onmessage = (messageEvent: MessageEvent<PoliteshopAuth>) => {
  for (const [cookie, cookieValue] of Object.entries(messageEvent.data)) {
    // "SameSite=None; Secure" is required since the page is running in an iframe
    document.cookie = `${cookie}=${cookieValue}; Max-Age=604800; SameSite=None; Secure`; // 604800s == 1 week
  }

  let redirect = new URLSearchParams(window.location.search).get("redirect");
  if (redirect === null) return; // No-op for missing "redirect" query params
  redirect = decodeURIComponent(redirect);

  // Redirect to the original URL with the new cookies. The redirect
  // is done by clicking on a HTMX-boosted link for SPA-like navigation.
  console.log(`Redirecting to ${redirect}`);
  // document.getElementById("redirect")?.click();
  document.location.href = redirect;
};

window.onload = () => {
  // Request POLITEShop authentication from the Chrome extension
  console.log("Requesting POLITEShop authentication from the extension");
  window.top!.postMessage("get-auth", "*");
};
