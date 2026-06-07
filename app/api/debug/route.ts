import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? "SET ✓" : "MISSING ✗",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "SET ✓" : "MISSING ✗",
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ? "SET ✓" : "MISSING ✗",
    NODE_ENV: process.env.NODE_ENV,
    all_keys: Object.keys(process.env).filter(k =>
      !k.startsWith("npm_") && !k.startsWith("NVM_") && !k.startsWith("AWS_")
    ),
  });
}
