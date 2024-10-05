import type { FullAuth, HTMXConfigRequestEvent, PolitemallAuth } from "./types";
import { getBrightspaceToken } from "./utils";

async function getFullAuth(): Promise<FullAuth> {
  const politemallAuth: PolitemallAuth = await chrome.runtime.sendMessage("get-politemall-auth");
  const brightspaceToken = getBrightspaceToken();

  return { ...politemallAuth, brightspaceToken };
}

function envrcFromAuth(auth: FullAuth): string {
  return Object.entries(auth)
    .map(([k, v]) => `export ${k.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}="${v}"`)
    .join("\n");
}

const POLITESHOP_SERVER = "http://localhost:8080";

async function main() {
  const auth = await getFullAuth();
  console.log(envrcFromAuth(auth));

  const baseHTML = (await fetch(chrome.runtime.getURL("static/base.html")).then((res) => res.text()))
    .replace("{{htmxUrl}}", chrome.runtime.getURL("static/htmx.min.js"))
    .replace("{{alpineUrl}}", chrome.runtime.getURL("static/alpine.min.js"))
    .replace("{{iframeUrl}}", POLITESHOP_SERVER + window.location.pathname);

  document.open();
  document.write(baseHTML);
  document.close();

  document.body.addEventListener("htmx:configRequest", ((evt: HTMXConfigRequestEvent) => {
    evt.detail.headers = {
      "X-D2l-Session-Val": auth.d2lSessionVal,
      "X-D2l-Secure-Session-Val": auth.d2lSecureSessionVal,
      "X-Brightspace-Token": auth.brightspaceToken,
      ...evt.detail.headers,
    };
  }) as EventListener);
}

main();

// Auto-reload the extension in development
if (process.env.ENVIRONMENT === "development") {
  console.log("Connecting to extension reload server...");

  const evtSource = new EventSource("http://localhost:8081");
  evtSource.onmessage = async () => {
    console.log("Reloading extension...");
    await chrome.runtime.sendMessage("reload");
    window.location.reload();
  };
}
