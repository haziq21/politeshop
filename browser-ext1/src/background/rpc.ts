import browser from "webextension-polyfill";
import { log } from "../logging";

type AnyFunc = (...args: any[]) => any;
type Async<F extends AnyFunc> = (...args: Parameters<F>) => Promise<ReturnType<F>>;

/** Define functions on the background script that can be called from the content script via message-passing. */
export function defineBackgroundFuncs<T extends Record<string, AnyFunc>>(funcs: T): { [K in keyof T]: Async<T[K]> } {
  type RPC = { name: string; args: any[] };

  // When defineBackgroundFunc() is called in the background
  // script, we register it as an onMessage listener
  if (process.env.IN_WORKER) {
    browser.runtime.onMessage.addListener(((call: RPC, _, sendResponse) => {
      if (!Object.hasOwn(funcs, call.name)) return;

      log(`Calling ${call.name}(${call.args.map((a) => JSON.stringify(a)).join(", ")})`);
      const res = funcs[call.name](...call.args);

      if (res instanceof Promise) {
        res.then(sendResponse);
        return true; // Indicates that sendResponse() will be called asynchronously
      }

      // If the result is not a promise, we can send it immediately
      sendResponse(res);
    }) as browser.Runtime.OnMessageListener);
  }

  return Object.entries(funcs).reduce((obj, [name, func]: [keyof T, AnyFunc]) => {
    obj[name] = (...args) =>
      !process.env.IN_WORKER
        ? // When the function is called in the content script,
          // we just send a message to the background script
          browser.runtime.sendMessage(<RPC>{ name, args })
        : // When the function is called in the background
          // script, we call the handler directly
          func(...args);
    return obj;
  }, {} as { [K in keyof T]: Async<T[K]> });
}
