import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    const [generalRes, techRes, mergerRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=merger&token=${finnhubKey}`),
    ]);

    const [general, tech, merger] = await Promise.all([
      generalRes.json(),
      techRes.json(),
      mergerRes.json(),
    ]);

    const combined = [
      ...(Array.isArray(general) ? general : []),
      ...(Array.isArray(tech) ? tech : []),
      ...(Array.isArray(merger) ? merger : []),
    ]
      .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 30)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary,
        related: item.related,
        source: item.source,
      }));

    if (combined.length === 0) {
      return NextResponse.json({ error: "No news data available" }, { status: 500 });
    }

    const prompt = `You are an AI stock research assistant. Based on these latest market news headlines, identify the TOP 5 US-listed stocks that have positive upcoming catalysts or good momentum in the next few weeks.

News:
${JSON.stringify(combined, null, 2)}

Return ONLY valid JSON — an array of exactly 5 objects:
[
  {
    "symbol": "TICKER",
    "company_name": "Full Company Name",
    "catalyst": "One sentence: what specific positive event or trend drives this pick",
    "sentiment": "Bullish" | "Very Bullish",
    "predicted_change_pct": <number between 2 and 25>
  }
]

Rules:
- Only use real US-listed ticker symbols
- Pick stocks across different sectors for diversity
- Focus on concrete upcoming positive catalysts (earnings beat expectations, product launch, contract win, regulatory approval, etc.)
- This is for educational purposes only — not financial advice`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse AI picks" }, { status: 500 });
    }

    const picks: any[] = JSON.parse(match[0]);

    const quotes = await Promise.all(
      picks.map((p) =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${p.symbol}&token=${finnhubKey}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    );

    const enriched = picks.map((pick, i) => {
      const quote = quotes[i];
      const currentPrice: number = quote?.c ?? 0;
      const changePct: number = pick.predicted_change_pct ?? 5;
      const predictedPrice = currentPrice > 0
        ? parseFloat((currentPrice * (1 + changePct / 100)).toFixed(2))
        : null;

      return {
        symbol: pick.symbol,
        company_name: pick.company_name,
        catalyst: pick.catalyst,
        sentiment: pick.sentiment,
        predicted_change_pct: changePct,
        current_price: currentPrice,
        predicted_price: predictedPrice,
        day_change_pct: quote?.dp ?? null,
      };
    });

    return NextResponse.json({ picks: enriched });
  } catch (error) {
    console.error("top-picks error:", error);
    return NextResponse.json({ error: "Failed to generate top picks" }, { status: 500 });
  }
}
