---
"@politeshop/lib": patch
---

Session cookies and tokens are only sent to requests on the origin of the API they belong to, so a URL taken from a response can't carry them to another host. A Brightspace token whose tenant or user claim could change where requests go is rejected.
