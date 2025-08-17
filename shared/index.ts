export type Message<T, P = void> = P extends void ? { type: T } : { type: T; payload: P };
export type WindowMessage = Message<"URL_PATH_CHANGED", string> | Message<"TITLE_CHANGED", string>;

/** Maps credential names to the header names that POLITEShop expects. */
export const CREDENTIAL_HEADER_MAPPINGS = {
  d2lSessionVal: "X-D2l-Session-Val",
  d2lSecureSessionVal: "X-D2l-Secure-Session-Val",
  d2lFetchToken: "X-D2l-Fetch-Token",
  d2lSubdomain: "X-D2l-Subdomain",
} as const;

export type CredentialName = keyof typeof CREDENTIAL_HEADER_MAPPINGS;
