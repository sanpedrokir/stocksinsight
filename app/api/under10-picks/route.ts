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
    const [generalRes, techRes, mergerRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=merger&token=${finnhubKey}`),
    ]);

    async function safeJson(r: PromiseSettledResult<Response>) {
      if (r.status === "rejected") return [];
      try { return await r.value.json(); } catch { return []; }
    }

    const [general, tech, merger] = await Promise.all([
      safeJson(generalRes),
      safeJson(techRes),
      safeJson(mergerRes),
    ]);

    const news = [
      ...(Array.isArray(general) ? general : []).slice(0, 20),
      ...(Array.isArray(tech) ? tech : []).slice(0, 15),
      ...(Array.isArray(merger) ? merger : []).slice(0, 10),
    ]
      .sort((a: any, b: any) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 40)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary?.slice(0, 150),
        related: item.related,
      }));

    // Ask GPT for 20 candidates — we'll fetch real prices and filter to <$10
    const prompt = `You are a stock research analyst specialising in small-cap and low-priced stocks. Based on the news below, suggest 20 US-listed stocks that currently trade below $10 and have strong upcoming positive catalysts (earnings, product launch, partnership, regulatory approval, sector momentum, etc.).

Focus on: small caps, micro caps, biotech, junior miners, emerging tech, turnaround plays, and sector momentum stocks — anything genuinely priced below $10 on major US exchanges (NYSE, NASDAQ).

News:
${JSON.stringify(news, null, 2)}

Return ONLY a valid JSON array of exactly 20 objects, no markdown:
[{"symbol":"TICKER","company_name":"Name","sector":"Sector","catalyst":"Specific upcoming positive catalyst (1 sentence)","sentiment":"Bullish","predicted_change_pct":12}]

sentiment values: "Bullish" | "Very Bullish" | "Extremely Bullish"
Rank highest conviction first. Only real US-listed tickers. Educational only.`;

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

    // Fetch real quotes for all candidates
    const quotesRaw = await Promise.allSettled(
      candidates.map(p =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${p.symbol}&token=${finnhubKey}`).then(r => r.json())
      )
    );
    const quotes = quotesRaw.map(r => r.status === "fulfilled" ? r.value : null);

    // Filter to genuinely sub-$10 and enrich
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
      return NextResponse.json({ error: "No qualifying stocks under $10 found — try again" }, { status: 500 });
    }

    return NextResponse.json({ picks: enriched });
  } catch (error) {
    console.error("under10-picks error:", error);
    return NextResponse.json({ error: "Failed to generate picks" }, { status: 500 });
  }
}
