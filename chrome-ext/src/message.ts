import { Message } from "../../shared";

export type ExtMessage =
  | Message<"SET_POLITESHOP_COOKIES", { brightspaceJWT: string; currentURL: string }>
  | Message<"RELOAD">;

/** Send a message from the content script to the background worker. */
export async function msgBackground(message: ExtMessage): Promise<void> {
  await chrome.runtime.sendMessage(message);
}

/** Type-safe wrapper of `chrome.runtime.onMessage.addListener()`. */
export function addMessageListener<T extends ExtMessage["type"]>(
  messageType: T,
  callback: (
    payload: Extract<ExtMessage, { type: T }> extends { payload: infer P } ? P : undefined
  ) => void | Promise<void>
) {
  chrome.runtime.onMessage.addListener((msg: ExtMessage, _, sendResponse) => {
    if (msg.type !== messageType) return;

    const payload = (msg as any).payload;
    const res = callback(payload);

    if (res instanceof Promise) {
      res.then(sendResponse);
      return true; // Indicates that sendResponse will be called asynchronously
    }
  });
}
