# POLITEShop

POLITEShop is a third-party client for [POLITEMall](https://politemall.polite.edu.sg/), the Learning Management System (LMS) used by Polytechnics and ITEs in Singapore. It aims to solve quality-of-life issues present in POLITEMall, like inconvenient UX and poor load performance.

## How it works

POLITEShop consists of a browser extension (`browser-ext/`) and a webapp (`webapp/`) hosted on [Vercel](https://vercel.com/home). When you visit POLITEMall, the extension replaces the page contents with an `<iframe>` displaying content from the POLITEShop webapp.

The webapp uses your POLITEMall / Brightspace credentials to call their respective APIs (`*.polite.edu.sg` / `*.api.brightspace.com`). Data received from the APIs is stored in a Postgres database hosted on [Neon](https://neon.com/), allowing for easier and faster data access. This data is also used to render the site server-side, contributing to improved load performance.

## Reverse-engineering

To interface with POLITEMall, POLITEShop uses APIs reverse-engineered from the POLITEMall website. The reverse-engineered APIs are being documented on [Postman](https://www.postman.com/haziqs-team/politemall/overview).

## Authentication flow

POLITEShop handles authentication by leveraging session credentials from POLITEMall and Brightspace.

### How it works

1. When the extension loads, it reads the user's POLITEMall / Brightspace session credentials (the `d2lSessionVal` and `d2lSecureSessionVal` cookies, and `D2L.Fetch.Token` from localStorage) and sets declarativeNetRequest session rules to include them in the headers (`X-D2l-Session-Val`, `X-D2l-Secure-Session-Val`, `X-D2l-Fetch-Token`) of requests to the POLITEShop server. This also happens when the cookies change (as detected by the extension), or when the POLITEShop frontend generates a new `D2L.Fetch.Token` (they expire every 30 minutes).
3. When the POLITEShop server receives a request, it computes a "session hash" - a hash of the session credentials (this serves as a fingerprint that identifies the user's session without exposing real credentials). POLITEShop's database identifies users based on their session hash using a mapping of session hashes to user IDs.
4. When the POLITEShop server computes a session hash that's not currently in the database, it calls the POLITEMall API with the given session credentials to retrieve the corresponding user ID, and then updates the mapping in the database accordingly.
5. The POLITEShop server uses the session credentials it receives to authenticate requests to the POLITEMall / Brightspace APIs.
