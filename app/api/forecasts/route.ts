import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const forecasts = await sql`
      SELECT *
      FROM stock_forecasts
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ forecasts });
  } catch (error) {
    console.error("fetch forecasts error:", error);
    return NextResponse.json({ forecasts: [] });
  }
}