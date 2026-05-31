# POLITEShop

POLITEShop is a third-party client for POLITEMall, the learning management system built on Brightspace.

## Architecture

The browser extension (`ext/`) intercepts POLITEMall pages from `{subdomain}.polite.edu.sg/d2l/*` and replaces them with an iframe pointing to the POLITEShop app (`app/`) at `{subdomain}.{domain}` (`{domain}` is `localhost:5173` in development). From `*.polite.edu.sg`, the extension reads session cookies (`d2lSessionVal` and `d2lSecureSessionVal`) and a JWT from localStorage (`D2L.Fetch.Tokens`), and passes them as headers (`X-D2l-Session-Val`, `X-D2l-Secure-Session-Val`, `X-D2l-Fetch-Token`) to POLITEShop via declarativeNetRequest rules.

The server `hooks.server.ts` uses these headers to create a `POLITELib` client, which talks to POLITEMall / Brightspace APIs. `POLITELib` is a reverse-engineered API client (`/lib`) for POLITEMall and Brightspace.

POLITEShop maintains its own database of user data, which it mirrors from POLITEMall / Brightspace.

## Tooling

- Dev server: `pnpm --filter @politeshop/app dev` (localhost:5173)
- Extension build: `pnpm --filter @politeshop/ext build` → `ext/.output/chrome-mv3`
- Formatter: `pnpm fmt` (oxfmt via pre-commit hook, root)
- Type check: `npx svelte-check --tsconfig ./tsconfig.json` (`app/`)
- Type check: `tsc --noEmit` (`ext/`)

## Monorepo

pnpm workspaces: `app`, `ext`, `lib`, `shared`. Use `pnpm --filter @politeshop/{name}` to scope commands.
