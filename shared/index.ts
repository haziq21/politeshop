export type POLITEMallAuth = {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
};

export type POLITEShopAuth = POLITEMallAuth & {
  brightspaceToken: string;
  domain: string;
  csrfToken: string;
};

export type Message<T, P = void> = P extends void ? { type: T } : { type: T; payload: P };
export type WindowMessage = Message<"URL_PATH_CHANGED", string>;
