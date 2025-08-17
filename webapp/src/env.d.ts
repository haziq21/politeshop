declare namespace App {
  interface Locals {
    polite: import("./politemall").POLITEMallClient;
    repo: import("./repository").Repository;
    sessionHash: number;
  }
}
