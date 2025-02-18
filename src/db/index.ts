let _db;

if (import.meta.env.DEV) {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  _db = drizzle(import.meta.env.DATABASE_URL);
} else {
  const { drizzle } = await import("drizzle-orm/neon-http");
  _db = drizzle(import.meta.env.DATABASE_URL);
}

export const db = _db;
export * from "./schema";
