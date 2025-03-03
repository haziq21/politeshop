# POLITEShop

POLITEShop is a third-party client for [POLITEMall](https://politemall.polite.edu.sg/), the Learning Management System (LMS) used by Polytechnics and ITEs in Singapore. It aims to solve quality-of-life issues present in POLITEMall, like inconvenient UX and poor load performance.

## Planned features

**Home page**<br>
✅ Filter modules by semester<br>
⬜ Sort modules by last event date/time<br>
⬜ Display recent events for each module<br>
⬜ Interactive due date calendar heatmap<br>
✅ Auto-rename modules and module codes with Gemini<br>

**Module page**<br>
⬜ Interactive file tree for activities<br>
⬜ Mark all activities in a folder as "seen"<br>
⬜ "Download all attachments" button on HTML activities<br>
⬜ Breadcrumbs<br>
⬜ Views for assignments and quizzes<br>
⬜ Auto-cleaned HTML for HTML activities<br>
⬜ File preview cards on HTML activities<br>
⬜ Auto-cleaned HTML for announcements<br>
⬜ Simple embed activities<br>
⬜ SCORM activities<br>
⬜ Assignment submission<br>
⬜ Quiz submission<br>
⬜ Automatic link to submission page on briefing page (with Gemini)<br>

**Miscellaneous**<br>
⬜ On-visit data syncing with POLITEMall<br>
⬜ Global `ctrl+k` search bar<br>

## How it works

POLITEShop consists of a Chrome extension (`chrome-ext/`) and a webapp (`webapp/`) hosted on [Vercel](https://vercel.com/home). When you visit POLITEMall, the extension

1. Replaces the page contents with an `<iframe>` displaying content from the POLITEShop webapp.
2. Retrieves your POLITEMall credentials: `d2lSessionVal` and `d2lSecureSessionVal` cookies, and `D2L.Fetch.Tokens` JWT from localstorage.
3. Passes the credentials to the `<iframe>` via `postMessage()`.

The POLITEShop site then sets the received POLITEMall credentials as cookies, which the web server uses to call the POLITEMall (`*.polite.edu.sg`) and Brightspace (`*.api.brightspace.com`) APIs. Data received from the APIs is stored in a Postgres database hosted on [Supabase](https://supabase.com/). Data from the database is used to render the site server-side, contributing to improved load performance.

## Reverse-engineering

To interface with POLITEMall, POLITEShop uses APIs reverse-engineered from the POLITEMall website. The reverse-engineered APIs are being documented on [Postman](https://www.postman.com/haziqs-team/politemall/overview).





