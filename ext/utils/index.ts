export type BackgroundMessage = {
  name: "updateFetchToken" | "updateAllCredentials";
  payload: { d2lFetchToken: string; fromDomain: string };
};

export function log(message: any, ...params: any[]) {
  console.log(`${new Date().toLocaleTimeString("en-GB", { hour12: false })} ${message}`, ...params);
}
