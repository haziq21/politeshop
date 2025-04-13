import browser from "webextension-polyfill";
import { log } from "./logging";

export function defineBackgroundFunc<T extends (...args: any[]) => any>(
  name: string,
  listener: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  type RPCMsg = { name: string; args: any[] };

  // When defineBackgroundFunc() is called in the background
  // script, we register it as an onMessage listener
  if (process.env.IN_WORKER) {
    browser.runtime.onMessage.addListener(((msg: RPCMsg, _, sendResponse) => {
      log(`Received RPC for ${msg.name}(${msg.args.map((a) => JSON.stringify(a)).join(", ")})`);

      if (msg.name !== name) return;

      const res = listener(...msg.args);

      if (res instanceof Promise) {
        res.then(sendResponse);
        return true; // Indicates that sendResponse() will be called asynchronously
      }

      // If the result is not a promise, we can send it immediately
      sendResponse(res);
    }) as browser.Runtime.OnMessageListener);
  }

  return (...args: any[]) =>
    !process.env.IN_WORKER
      ? // When the function is called in the content script,
        // we just send a message to the background script
        browser.runtime.sendMessage(<RPCMsg>{ name, args })
      : // When the function is called in the background
        // script, we call the handler directly
        listener(...args);
}
