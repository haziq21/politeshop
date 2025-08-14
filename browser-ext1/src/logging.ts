export function log(str: string) {
  console.log(`${new Date().toLocaleTimeString("en-GB", { hour12: false })} ${str}`);
}
