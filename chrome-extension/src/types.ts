export type PolitemallAuth = {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
};

export type FullAuth = PolitemallAuth & {
  brightspaceToken: string;
};

export type HTMXConfigRequestEvent = CustomEvent<{ headers: Record<string, string> }>;
