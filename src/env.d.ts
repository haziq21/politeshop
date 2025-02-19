declare namespace App {
  interface Locals {
    polite: import("./politemall").POLITEMallClient;
    politeData: {
      school?: typeof import("./db").school.$inferInsert;
      user?: typeof import("./db").user.$inferInsert;
    };
  }
}
