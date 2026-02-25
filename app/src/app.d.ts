// See https://svelte.dev/docs/kit/types#app.d.ts

import type { POLITEShop } from "politeshop";

// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      pm: POLITEShop;
      sessionHash: number;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
