export type PoliteshopAuth = {
  d2lSessionVal: string;
  d2lSecureSessionVal: string;
  brightspaceToken: string;
  politeDomain: string;
  csrfToken: string;
};

export type D2lAuth = Pick<PoliteshopAuth, "d2lSessionVal" | "d2lSecureSessionVal">;
