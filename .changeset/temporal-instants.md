---
"@politeshop/lib": major
---

Return `Temporal.Instant` instead of `Date` for every timestamp, and drop the `date-fns` dependency. Consumers need a runtime with native `Temporal` (Node 26+, Chrome 144+, Firefox 139+) and `"ESNext.Temporal"` in their TypeScript `lib`.
