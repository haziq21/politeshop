# POLITEShop

POLITEShop is a third-party client for [POLITEMall](https://politemall.polite.edu.sg/), the Learning Management System (LMS) used by Polytechnics and ITEs in Singapore. It aims to solve quality-of-life issues present in POLITEMall, like inconvenient UX and poor load performance.

## How it works

POLITEShop replaces POLITEMall pages with an `<iframe>` pointing to the POLITEShop webapp.
1. When the user visits POLITEMall, the extension reads their POLITEMall / Brightspace session credentials (the `d2lSessionVal` and `d2lSecureSessionVal` cookies, and `D2L.Fetch.Token` from localStorage) and sets declarativeNetRequest session rules to include them in the headers (`X-D2l-Session-Val`, `X-D2l-Secure-Session-Val`, `X-D2l-Fetch-Token`) of requests to the POLITEShop server. This also happens when the cookies change (as detected by the extension), or when the POLITEShop frontend generates a new `D2L.Fetch.Token` (they expire every 30 minutes).
2. The extension replaces the page contents with an `<iframe>` pointing to the POLITEShop webapp.
3. When the POLITEShop server receives a request, it computes a "session hash" - a hash of the session credentials. This serves as a fingerprint that identifies the user's session without exposing real credentials. POLITEShop's database identifies users based on their session hash using a mapping of session hashes to user IDs.
4. The POLITEShop server uses the session credentials it receives to authenticate requests to the POLITEMall / Brightspace APIs.

## Monorepo organisation

| Directory | Contents                                     |
| --------- | -------------------------------------------- |
| `app/`    | POLITEShop webapp                            |
| `ext/`    | POLITEShop browser extension                 |
| `lib/`    | Reverse-engineered POLITEMall client library |
| `shared/` | Shared types for app-extension messaging     |
