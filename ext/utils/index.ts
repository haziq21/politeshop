import { AUTH_HEADER_NAMES } from "@politeshop/shared";

export type SessionCredential = {
  name: keyof typeof AUTH_HEADER_NAMES;
  value: string;
  subdomain: string;
};

export const POLITESHOP_BASE_URL = new URL(
  import.meta.env.WXT_POLITESHOP_BASE_URL ?? "http://localhost:5173",
);
export const POLITEMALL_BASE_URL = new URL(
  import.meta.env.WXT_POLITEMALL_BASE_URL ?? "https://polite.edu.sg",
);

export function log(message: any, ...params: any[]) {
  console.log(
    `${new Date().toLocaleTimeString("en-GB", { hour12: false })} ${message}`,
    ...params,
  );
}
