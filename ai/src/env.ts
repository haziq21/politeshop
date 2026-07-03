export function getEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined) throw new Error(`Environment variable $${name} is not set`);
  return v;
}
