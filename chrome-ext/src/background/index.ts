import { defineBackgroundFuncs } from "./rpc";
import browser from "webextension-polyfill";

export const funcs = defineBackgroundFuncs({
  /** Get the specified cookie using `chrome.cookies`. */
  async getCookie({ name, url }: { name: string; url: string }): Promise<string | null> {
    const cookie = await browser.cookies.get({ url, name });
    if (!cookie) return null;
    return cookie.value;
  },

  /** Reload the extension. */
  reload() {
    browser.runtime.reload();
  },
});
