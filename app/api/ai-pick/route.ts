import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    // Pull tech news + company-specific news for major AI players
    const aiTickers = ["NVDA", "MSFT", "GOOGL", "META", "AMZN", "AMD", "AVGO", "ORCL", "PLTR", "ARM", "TSM", "SMCI", "DELL", "CRM", "SNOW"];

    const [techRes, generalRes, ...tickerNewsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`),
      ...aiTickers.map(t =>
        fetch(`https://finnhub.io/api/v1/company-news?symbol=${t}&from=${daysAgo(14)}&to=${daysAgo(0)}&token=${finnhubKey}`)
      ),
    ]);

    const [techNews, generalNews, ...tickerNewsData] = await Promise.all([
      techRes.json(),
      generalRes.json(),
      ...tickerNewsRes.map(r => r.json()),
    ]);

    const allNews = [
      ...(Array.isArray(techNews) ? techNews : []).slice(0, 30),
      ...(Array.isArray(generalNews) ? generalNews : []).slice(0, 20),
      ...tickerNewsData.flatMap((d, i) =>
        (Array.isArray(d) ? d : []).slice(0, 3).map((item: any) => ({ ...item, related: aiTickers[i] }))
      ),
    ]
      .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 60)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary,
        related: item.related,
        source: item.source,
      }));

    const prompt = `You are a top-tier AI stock research analyst. Based on these latest AI/technology news headlines, identify the TOP 20 US-listed stocks most likely to gain value due to AI-related developments, product launches, partnerships, earnings catalysts, or infrastructure demand in the next 4 weeks.

News:
${JSON.stringify(allNews, null, 2)}

Return ONLY a valid JSON array of exactly 20 objects:
[
  {
    "symbol": "TICKER",
    "company_name": "Full Company Name",
    "ai_angle": "Specific AI catalyst or theme driving this pick (1 sentence)",
    "reason": "2-sentence analysis of the opportunity",
    "predicted_change_pct": <number 2-35>,
    "confidence": "Medium" | "High" | "Very High"
  }
]

Rules:
- Rank by highest conviction first
- Mix large caps and high-growth mid caps
- Only real US-listed tickers
- Educational purposes only — not financial advice`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse AI picks" }, { status: 500 });
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
        ai_angle: pick.ai_angle,
        reason: pick.reason,
        confidence: pick.confidence,
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
    console.error("ai-pick error:", error);
    return NextResponse.json({ error: "Failed to generate AI picks" }, { status: 500 });
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
