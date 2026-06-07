import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    // Pull from 4 categories + high-impact company news across multiple sectors
    const watchTickers = ["AAPL", "TSLA", "AMZN", "JPM", "UNH", "LLY", "V", "XOM", "NFLX", "COIN", "SHOP", "SQ", "MSTR", "RBLX", "U"];

    const [generalRes, techRes, mergerRes, forexRes, ...tickerNewsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=merger&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=forex&token=${finnhubKey}`),
      ...watchTickers.map(t =>
        fetch(`https://finnhub.io/api/v1/company-news?symbol=${t}&from=${daysAgo(10)}&to=${daysAgo(0)}&token=${finnhubKey}`)
      ),
    ]);

    const [general, tech, merger, forex, ...tickerNewsData] = await Promise.all([
      generalRes.json(),
      techRes.json(),
      mergerRes.json(),
      forexRes.json(),
      ...tickerNewsRes.map(r => r.json()),
    ]);

    const combined = [
      ...(Array.isArray(general) ? general : []).slice(0, 25),
      ...(Array.isArray(tech) ? tech : []).slice(0, 25),
      ...(Array.isArray(merger) ? merger : []).slice(0, 15),
      ...(Array.isArray(forex) ? forex : []).slice(0, 10),
      ...tickerNewsData.flatMap((d, i) =>
        (Array.isArray(d) ? d : []).slice(0, 3).map((item: any) => ({ ...item, related: watchTickers[i] }))
      ),
    ]
      .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 80)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary,
        related: item.related,
        source: item.source,
      }));

    if (combined.length === 0) {
      return NextResponse.json({ error: "No news data available" }, { status: 500 });
    }

    const prompt = `You are an elite stock research analyst. Based on these latest market news headlines from multiple sources, identify the TOP 20 US-listed stocks with the strongest upcoming positive catalysts or momentum across ALL sectors (tech, healthcare, finance, energy, consumer, industrials, etc.) in the next 2-4 weeks.

News:
${JSON.stringify(combined, null, 2)}

Return ONLY a valid JSON array of exactly 20 objects:
[
  {
    "symbol": "TICKER",
    "company_name": "Full Company Name",
    "sector": "Sector name",
    "catalyst": "Specific positive catalyst or upcoming event driving this pick (1 sentence)",
    "sentiment": "Bullish" | "Very Bullish" | "Extremely Bullish",
    "predicted_change_pct": <number 2-30>,
    "risk_level": "Low" | "Medium" | "High"
  }
]

Rules:
- Rank by highest conviction first
- Diversify across at least 5 different sectors
- Mix large caps, mid caps, and high-growth names
- Focus on concrete upcoming positive catalysts
- Only real US-listed tickers
- Educational purposes only — not financial advice`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse picks" }, { status: 500 });
    }

    const picks: any[] = JSON.parse(match[0]).slice(0, 20);

    const quotes = await Promise.all(
      picks.map(p =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${p.symbol}&token=${finnhubKey}`)
          .then(r => r.json())
          .catch(() => null)
      )
    );

    const enriched = picks.map((pick, i) => {
      const quote = quotes[i];
      const currentPrice: number = quote?.c ?? 0;
      const changePct: number = pick.predicted_change_pct ?? 5;
      return {
        rank: i + 1,
        symbol: pick.symbol,
        company_name: pick.company_name,
        sector: pick.sector,
        catalyst: pick.catalyst,
        sentiment: pick.sentiment,
        risk_level: pick.risk_level,
        predicted_change_pct: changePct,
        current_price: currentPrice,
        predicted_price: currentPrice > 0
          ? parseFloat((currentPrice * (1 + changePct / 100)).toFixed(2))
          : null,
        day_change_pct: quote?.dp ?? null,
      };
    });

    return NextResponse.json({ picks: enriched });
  } catch (error) {
    console.error("top-picks error:", error);
    return NextResponse.json({ error: "Failed to generate top picks" }, { status: 500 });
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
