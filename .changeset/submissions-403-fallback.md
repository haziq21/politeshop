---
"@politeshop/lib": patch
---

`getSubmissions` falls back to Brightspace only when POLITE refuses a closed dropbox with a 403. Other failures, such as a network error or a 500, are thrown as they are instead of triggering a confusing second request.
