import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set!");
}

console.log("✓ Initializing Neon connection...");
let sql: any;

try {
  sql = neon(process.env.DATABASE_URL || "");
} catch (err) {
  console.error("❌ Failed to initialize Neon:", err);
  // Export a dummy function that returns error
  sql = async (strings: any) => {
    throw new Error("Database not initialized - DATABASE_URL missing or invalid");
  };
}

export { sql };
