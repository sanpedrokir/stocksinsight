import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    console.log("Fetching forecasts...");
    const forecasts = await sql`
      SELECT *
      FROM stock_forecasts
      ORDER BY created_at DESC
      LIMIT 20
    ` as any[];

    console.log("Forecasts fetched successfully:", Array.isArray(forecasts) ? forecasts.length : 0);
    return NextResponse.json({ forecasts: Array.isArray(forecasts) ? forecasts : [] });
  } catch (error) {
    console.error("fetch forecasts error:", error);
    return NextResponse.json({ error: String(error), forecasts: [] }, { status: 500 });
  }
}