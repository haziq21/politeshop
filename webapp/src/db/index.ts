import { DATABASE_URL } from "astro:env/server";
import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle(DATABASE_URL);
export * from "./schema";
export * from "./types";
