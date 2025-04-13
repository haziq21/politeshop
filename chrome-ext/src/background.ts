import { defineBackgroundFunc } from "./message";
import browser from "webextension-polyfill";

/** Get the specified cookie using `chrome.cookies`. */
export const getCookie = defineBackgroundFunc(
  "getCookie",
  async ({ name, url }: { name: string; url: string }): Promise<string | null> => {
    const cookie = await browser.cookies.get({ url, name });
    if (!cookie) return null;
    return cookie.value;
  }
);

/** Reload the extension. */
export const reload = defineBackgroundFunc("reload", browser.runtime.reload);
