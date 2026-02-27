export type BackgroundMessage =
  /** Tell the background script to update the DNR rule for the given credential. */
  | {
      name: "setBrightspaceCredentials";
      payload: { d2lFetchToken: string; subdomain: string };
    }
  /** Tell the background script to read {subdomain}.polite.edu.sg cookies and update the DNR rules. */
  | {
      name: "refreshPOLITECredentials";
      payload: { subdomain: string };
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
