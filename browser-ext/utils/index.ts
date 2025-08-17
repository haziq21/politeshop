export type BackgroundMessage = { name: "useD2lFetchToken"; payload: { token: string; domain: string } };

export function log(message: any, ...params: any[]) {
  console.log(`${new Date().toLocaleTimeString("en-GB", { hour12: false })} ${message}`, ...params);
}
