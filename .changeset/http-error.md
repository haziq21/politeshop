---
"@politeshop/lib": patch
---

A failed request to POLITE or Brightspace now always throws an `HTTPError` with the status and URL, instead of a mix of errors, one of which carried the whole `Response` and flooded logs.
