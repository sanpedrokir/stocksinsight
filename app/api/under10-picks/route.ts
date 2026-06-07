import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const CATEGORY_FEEDS: Record<string, string[]> = {
  "AI & Tech":              ["technology"],
  "Biotech":                ["general"],
  "Pharmaceutical":         ["general"],
  "Oil & Gas":              ["general"],
  "Renewable Energy":       ["general", "technology"],
  "Gold & Mining":          ["general"],
  "Finance & Banking":      ["general"],
  "Entertainment & Media":  ["general"],
  "Cannabis":               ["general"],
  "EV & Clean Tech":        ["technology", "general"],
  "Semiconductors":         ["technology"],
  "Real Estate (REITs)":    ["general"],
  "Cybersecurity":          ["technology"],
  "Gaming":                 ["technology", "general"],
  "Healthcare":             ["general"],
  "Agriculture":            ["general"],
  "Space & Aerospace":      ["technology", "general"],
  "Crypto & Blockchain":    ["crypto", "technology"],
  "Robotics & Automation":  ["technology"],
  "Retail & Consumer":      ["general"],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "General";

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    const feeds = CATEGORY_FEEDS[category] ?? ["general"];
    const uniqueFeeds = [...new Set(feeds)];

    const newsResults = await Promise.allSettled(
      uniqueFeeds.map(feed =>
        fetch(`https://finnhub.io/api/v1/news?category=${feed}&token=${finnhubKey}`)
      )
    );

    async function safeJson(r: PromiseSettledResult<Response>) {
      if (r.status === "rejected") return [];
      try { return await r.value.json(); } catch { return []; }
    }

    const newsArrays = await Promise.all(newsResults.map(safeJson));

    const news = newsArrays
      .flatMap((arr, i) => (Array.isArray(arr) ? arr : []).slice(0, i === 0 ? 25 : 20))
      .sort((a: any, b: any) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 40)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary?.slice(0, 150),
        related: item.related,
      }));

    const prompt = `You are a stock research analyst specialising in small-cap and low-priced stocks. Based on the news below, suggest 20 US-listed stocks in the **${category}** sector that currently trade below $10 and have strong upcoming positive catalysts.

Focus ONLY on ${category} companies. Only include stocks that genuinely belong to this sector.
Focus on: small caps, micro caps, early-stage, turnaround plays, and sector momentum stocks priced below $10 on NYSE or NASDAQ.

News:
${JSON.stringify(news, null, 2)}

Return ONLY a valid JSON array of exactly 20 objects, no markdown:
[{"symbol":"TICKER","company_name":"Name","sector":"${category}","catalyst":"Specific upcoming positive catalyst (1 sentence)","sentiment":"Bullish","predicted_change_pct":12}]

sentiment values: "Bullish" | "Very Bullish" | "Extremely Bullish"
Rank highest conviction first. Only real US-listed tickers trading under $10. Educational only.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1800,
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse picks" }, { status: 500 });
    }

    const candidates: any[] = JSON.parse(match[0]).slice(0, 15);

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
          predicted_change_pct: changePct,
          current_price: currentPrice,
          predicted_price: parseFloat((currentPrice * (1 + changePct / 100)).toFixed(2)),
          day_change_pct: quote?.dp ?? null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, 10)
      .map((pick, i) => ({ ...pick, rank: i + 1 }));

    if (enriched.length === 0) {
      return NextResponse.json({ error: `No qualifying ${category} stocks under $10 found — try again` }, { status: 500 });
    }

    return NextResponse.json({ picks: enriched });
  } catch (error) {
    console.error("under10-picks error:", error);
    return NextResponse.json({ error: "Failed to generate picks" }, { status: 500 });
  }
}
