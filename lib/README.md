# POLITELib

JS/TS library for interacting with reverse-engineered [POLITEMall](https://politemall.polite.edu.sg/) APIs (`*.polite.edu.sg` and `*.api.brightspace.com`). Made for the [POLITEShop browser extension](https://github.com/haziq21/politeshop).

```typescript
import { POLITELib } from "@politeshop/lib";

const ps = new POLITELib({
  d2lSessionVal: "sNtnzd...",
  d2lSecureSessionVal: "eqoLoG...",
  domain: "nplms",
});

// { id: '490586', name: 'HAZIQ DANISH BIN HAIRIL RIZAL' }
const user = await ps.getUser();

// [{ id: '803172', name: 'DATA STRUCTURES & ALGORITHMS (2_DSA_011791)', code: '25S2-2_DSA_011791' }, ...]
const modules = await ps.getModules();

const content = await ps.getModuleContent(modules[0].id);
```

## Terminology

There are some differences in terminology between Singapore's Polytechnics / ITE and the underlying APIs. This library follows Polytechnic / ITE terminology.

| POLITELib                 | Underlying APIs              | Definition                                                   |
| ------------------------- | ---------------------------- | ------------------------------------------------------------ |
| Course                    | Course                       | A course of study (e.g. Information Technology). A student can only be in one course. |
| Module                    | Enrollment / Course offering | A timetabled subject studied, e.g. Data Structures & Algorithms. |
| Activity                  | Activity / Topic             | An individual POLITEMall page containing text, media embeds, submission dropboxes, interactive activities, etc. |
| Top-level activity folder | Module                       | A "root" group of POLITEMall content. By definition, these are not nested. |
| Activity folder           | Unit                         | A group of POLITEMall content. These can be nested.          |
