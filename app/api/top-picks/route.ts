import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    // Phase 1: fetch 4 category feeds (no per-ticker calls to stay under rate limit)
    const [generalRes, techRes, mergerRes, cryptoRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=merger&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=AAPL&from=${daysAgo(7)}&to=${daysAgo(0)}&token=${finnhubKey}`),
    ]);

    async function safeJson(r: PromiseSettledResult<Response>) {
      if (r.status === "rejected") return [];
      try { return await r.value.json(); } catch { return []; }
    }

    const [general, tech, merger, extra] = await Promise.all([
      safeJson(generalRes),
      safeJson(techRes),
      safeJson(mergerRes),
      safeJson(cryptoRes),
    ]);

    const combined = [
      ...(Array.isArray(general) ? general : []).slice(0, 20),
      ...(Array.isArray(tech) ? tech : []).slice(0, 20),
      ...(Array.isArray(merger) ? merger : []).slice(0, 10),
      ...(Array.isArray(extra) ? extra : []).slice(0, 10),
    ]
      .sort((a: any, b: any) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 45)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary?.slice(0, 150),
        related: item.related,
        source: item.source,
      }));

    if (combined.length === 0) {
      return NextResponse.json({ error: "No news data available" }, { status: 500 });
    }

    // Phase 2: GPT picks stocks across all sectors, targeting under $10
    const prompt = `You are an elite stock research analyst. Based on these latest market news headlines, identify 25 US-listed stocks with strong upcoming positive catalysts across ALL sectors in the next 2-4 weeks — focusing on smaller names currently trading between $0.50 and $15.

News:
${JSON.stringify(combined, null, 2)}

Return ONLY a valid JSON array of exactly 25 objects, no markdown:
[{"symbol":"TICKER","company_name":"Name","sector":"Sector","catalyst":"Specific positive catalyst (1 sentence)","sentiment":"Very Bullish","predicted_change_pct":8,"risk_level":"Medium"}]

sentiment values: "Bullish" | "Very Bullish" | "Extremely Bullish"
risk_level values: "Low" | "Medium" | "High"
Rank highest conviction first. Diversify across 5+ sectors. Only real US-listed tickers. Educational only.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse picks" }, { status: 500 });
    }

    const candidates: any[] = JSON.parse(match[0]).slice(0, 25);

    // Phase 3: fetch quotes and filter to under $10
    const quotesRaw = await Promise.allSettled(
      candidates.map(p =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${p.symbol}&token=${finnhubKey}`).then(r => r.json())
      )
    );
    const quotes = quotesRaw.map(r => r.status === "fulfilled" ? r.value : null);

    const enriched = candidates
      .map((pick, i) => {
        const quote = quotes[i];
        const currentPrice: number = quote?.c ?? 0;
        if (currentPrice <= 0 || currentPrice >= 10) return null;
        const changePct: number = pick.predicted_change_pct ?? 5;
        return {
          symbol: pick.symbol,
          company_name: pick.company_name,
          sector: pick.sector,
          catalyst: pick.catalyst,
          sentiment: pick.sentiment,
          risk_level: pick.risk_level,
          predicted_change_pct: changePct,
          current_price: currentPrice,
          predicted_price: parseFloat((currentPrice * (1 + changePct / 100)).toFixed(2)),
          day_change_pct: quote?.dp ?? null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, 10)
      .map((pick, i) => ({ ...pick, rank: i + 1 }));

    return NextResponse.json({
      picks: enriched,
      message: enriched.length === 0 ? "No qualifying stocks under $10 found right now — try again later" : undefined,
    });
  } catch (error) {
    console.error("top-picks error:", error);
    return NextResponse.json({ error: "Failed to generate top picks" }, { status: 500 });
  }
}
