// See https://svelte.dev/docs/kit/types#app.d.ts

import type { POLITEMallClient } from "$lib/politemall";

// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      pm: POLITEMallClient;
      sessionHash: number;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
