# POLITEShop

POLITEShop is a third-party client for POLITEMall, the learning management system built on Brightspace.

## Architecture

The browser extension (`ext/`) intercepts POLITEMall pages from `{subdomain}.polite.edu.sg/d2l/*` and replaces them with an iframe pointing to the POLITEShop app (`app/`) at `{subdomain}.{domain}` (`{domain}` is `localhost:5173` in development). From `*.polite.edu.sg`, the extension reads session cookies (`d2lSessionVal` and `d2lSecureSessionVal`) and a JWT from localStorage (`D2L.Fetch.Tokens`), and passes them as headers (`X-D2l-Session-Val`, `X-D2l-Secure-Session-Val`, `X-D2l-Fetch-Token`) to POLITEShop via declarativeNetRequest rules.

The server `hooks.server.ts` uses these headers to create a `POLITELib` client, which talks to POLITEMall / Brightspace APIs. `POLITELib` is a reverse-engineered API client (`/lib`) for POLITEMall and Brightspace.

POLITEShop maintains its own database of user data, which it mirrors from POLITEMall / Brightspace.

## Tooling

- Dev server: `pnpm --filter @politeshop/app dev` (localhost:5173)
- Database migrations: `pnpm --filter @politeshop/app db:generate` / `db:migrate`
- Extension build: `pnpm --filter @politeshop/ext build` → `ext/.output/chrome-mv3`
- Format / lint / type check (root, via vite+ `vp`; config in `vite.config.ts`): `vp check` (format + type-aware lint, which also type-checks the TS in every package; `--fix` to fix), `pnpm lint:tailwind`, `pnpm --filter @politeshop/app typecheck` (svelte-check, for `.svelte` files)
- Tailwind: oxfmt sorts classes (`fmt.sortTailwindcss`), and `eslint-plugin-better-tailwindcss` enforces canonical classes via `eslint.config.mjs` (`pnpm lint:tailwind --fix`); oxlint cannot see class attributes in `.svelte` markup
- Component tests (Vitest browser mode, config in the root `vite.config.ts`): `vp test` from the repo root
- CI (`.github/workflows/ci.yml`): component tests and e2e on PRs and `main`; e2e needs the `E2E_DATABASE_URL` secret
- Pre-commit (`.pre-commit-config.yaml`, pre-commit framework): `vp check --fix`, Tailwind lint, svelte-check, plus ruff/ty for `ai/infra`

## Monorepo

pnpm workspaces: `app`, `ext`, `lib`, `shared`. Use `pnpm --filter @politeshop/{name}` to scope commands.

## Conventions

- Comments only for non-obvious explanations, kept short. Assume a competent reader already familiar with the codebase, product, and tools.
- Commits have a message only, with no body, unless one commit spans several changes that the message doesn't make inferrable, in which case the body is a concise bullet list.
- Git worktrees live in `.worktrees/` (gitignored).
- PR descriptions are short: a one-line summary, then brief headed bullet lists. Cover only significant design decisions and anything the reviewer must act on (breaking changes, migrations to run before deploying). No verification section, no minor technical detail.
