import { getPolitemallAuth } from "./utils";

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message === "get-politemall-auth") {
    getPolitemallAuth().then(sendResponse);
    return true; // Indicates that sendResponse will be called asynchronously
  }

  if (message === "reload") {
    chrome.runtime.reload();
  }
});
