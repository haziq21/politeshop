declare namespace App {
  interface Locals {
    polite: import("./politemall").POLITEMallClient;
    datastore: import("./datastore").Datastore;
  }
}
