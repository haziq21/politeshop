import type { POLITEMallClient } from "./politemall";

declare namespace App {
  interface Locals {
    polite: POLITEMallClient;
  }
}
