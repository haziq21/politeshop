import { DATABASE_URL } from "$app/env/private";
import { drizzle } from "drizzle-orm/neon-http";

export const db = drizzle(DATABASE_URL);
export * from "./schema";
export * from "./types";
