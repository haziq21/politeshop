---
"@politeshop/lib": major
---

`POLITELib`, `POLITE` and `Brightspace` no longer have `abort()`. Pass an `AbortSignal` as `signal` in their config instead; `POLITELib` shares it with both of its clients, including a Brightspace client created after a token refresh.
