import { DATABASE_URL } from "$env/static/private";
import { drizzle } from "drizzle-orm/neon-http";

export const db = drizzle(DATABASE_URL);
export * from "./schema";
export * from "./types";
