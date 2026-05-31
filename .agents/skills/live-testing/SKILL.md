---
name: live-testing
description: Run the POLITEShop app and extension live with hot-reload.
---

## Start everything

```bash
tmux new-session -d -s politeshop-app 'pnpm --filter @politeshop/app dev'
tmux new-session -d -s politeshop-ext 'pnpm --filter @politeshop/ext dev'
playwright-cli -s=politeshop-browser open "https://nplms.polite.edu.sg/d2l/home" \
  --headed --persistent --profile=ext/.wxt/chrome-data
```

WXT dev mode auto-reloads the extension on changes, so no manual rebuild needed.

The `open` command may exceed the default tool timeout (30s) — the browser is still opening successfully in the background. Retry or use a longer timeout.

The extension must be loaded via `.playwright/cli.config.json`. If missing, create it at the workspace root:

```json
{
  "browser": {
    "launchOptions": {
      "args": [
        "--disable-extensions-except=<absolute-path>/ext/.output/chrome-mv3-dev",
        "--load-extension=<absolute-path>/ext/.output/chrome-mv3-dev"
      ]
    }
  }
}
```

Replace `<absolute-path>` with the workspace root.

## Auth

The extension needs valid POLITEMall cookies + `D2L.Fetch.Tokens` in localStorage. The persistent profile (`--persistent --profile=ext/.wxt/chrome-data`) keeps auth across sessions.

If the session has expired, the content script logs `Required POLITEMall session credentials not found, aborting`. In many cases, refreshing the page is enough — the app redirects to `/d2l/login`, POLITEMall detects the existing session and immediately redirects back with refreshed credentials.

When credentials are missing, the server returns `401` with body `Missing credentials: X-D2l-Session-Val and X-D2l-Secure-Session-Val are required`. When credentials are present but expired, the server redirects to `/d2l/login?sessionExpired=1`, which triggers a `REDIRECT_LOGIN` message to the extension, navigating the top-level page to POLITEMall's login page.

## Interacting with the app

### Finding the app iframe

The app lives in an iframe on `{subdomain}.localhost:5173`. Access it from playwright-cli via:

```js
const frame = page.frames().find((f) => f.url().includes("localhost:5173"));
```

Alternative: `page.locator('iframe').contentFrame()`

### Navigating within the SPA

Use the outer `<iframe>` element's `src` attribute to navigate:

```js
const iframe = await page.$("iframe");
await iframe.evaluate((el, src) => (el.src = src), "http://nplms.localhost:5173/d2l/home/803172/activity/12156645");
await page.waitForTimeout(3000);
```

The internal activity route is `/d2l/home/[moduleId]/activity/[activityId]`.

Sidebar links use the URL pattern `/d2l/le/enhancedSequenceViewer/{moduleId}?url=...`. The app's `reroute` hook in `hooks.ts` maps these to the internal activity route, so clicking sidebar links navigates within the SPA.

### If the iframe gets stuck in a navigation loop

Sometimes the app gets stuck in a redirect loop (e.g. auth → POLITEMall → back → auth again). When this happens:

- The iframe URL cycles between `.../d2l/login?sessionExpired=1&target=...` and the original page
- Navigate the top-level page by closing and reopening the browser
- If that doesn't work, the POLITEMall session may need manual re-login

## Running bulk tests

For long verification flows, write a script and save it to a file, then run it via `run-code --filename`:

```bash
playwright-cli -s=politeshop-browser run-code --filename /tmp/test-script.js
```

Inline `run-code` scripts must use this pattern:

```js
async () => {
  const frames = page.frames().map((f) => f.url());
  return frames;
};
```

## Cleanup

```bash
playwright-cli -s=politeshop-browser close
playwright-cli kill-all
tmux kill-session -t politeshop-app
tmux kill-session -t politeshop-ext
```
