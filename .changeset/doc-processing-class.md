---
"@politeshop/lib": patch
---

Find a document's file entity whatever other state classes it has (e.g. `processing`). Previously `getModuleActivities` threw for any module containing a document still being converted.
