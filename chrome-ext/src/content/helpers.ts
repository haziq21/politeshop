import { log } from "../logging";
import { msgBackground } from "../message";

export async function overwritePage(): Promise<HTMLIFrameElement> {
  const res = await fetch(chrome.runtime.getURL("base.html"));
  const baseHTML = await res.text();

  document.open();
  document.write(baseHTML);
  document.close();

  return document.getElementById("politeshop") as HTMLIFrameElement;
}

export function getBrightspaceToken(): string {
  // TODO: Better error handling
  return JSON.parse(localStorage.getItem("D2L.Fetch.Tokens")!)["*:*:*"].access_token;
}

export function getCSRFToken(): string {
  // TODO: Better error handling
  return localStorage.getItem("XSRF.Token")!;
}

export function connectDevServer() {
  log("Connecting to dev server...");

  // Connect to SSE dev server
  const sse = new EventSource(process.env.DEV_SERVER!);
  sse.onmessage = async (event) => {
    if (event.data === "reload") {
      await msgBackground({ type: "RELOAD" });
      window.location.reload();
    } else {
      console.log(`Unknown message from dev server: ${event.data}`);
    }
  };
}
