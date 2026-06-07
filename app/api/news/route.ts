import { NextRequest, NextResponse } from "next/server";

function getDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "AAPL";

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing FINNHUB_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const from = getDate(14);
    const to = getDate(0);

    const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(newsUrl);
    const data = await res.json();

    const news = (Array.isArray(data) ? data : []).slice(0, 5).map((item: any) => ({
      headline: item.headline,
      summary: item.summary,
      url: item.url,
      source: item.source,
      datetime: item.datetime,
    }));

    return NextResponse.json({ symbol, news });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
