import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable not set!");
  throw new Error("DATABASE_URL is not set");
}

console.log("Initializing Neon connection...");
export const sql = neon(process.env.DATABASE_URL);
