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
  "Quantum":                ["technology", "general"],
  "Quantinum":              ["technology", "general"],
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

    const prompt = `You are an elite small-cap stock analyst. Your job is to find the HIGHEST POTENTIAL stocks in the **${category}** sector that currently trade below $10.

STRICT CRITERIA — only include a stock if it meets ALL of these:
1. Genuinely belongs to the ${category} sector
2. Has a SPECIFIC upcoming positive catalyst within the next 1–6 weeks (e.g. earnings beat expected, FDA approval pending, partnership announced, product launch, regulatory green light, sector momentum surge, short squeeze setup, or institutional accumulation signal)
3. Has REAL upside potential — minimum 10–15% expected gain based on the catalyst
4. Is actively traded on NYSE or NASDAQ (not OTC pink sheets)
5. Is NOT a stock in a long-term downtrend with no recovery signal

DO NOT include: stocks just because they are cheap, dying companies, or stocks with no clear near-term catalyst. Quality over quantity.

News context:
${JSON.stringify(news, null, 2)}

IMPORTANT: Many of your suggestions will be verified against live prices. To ensure 10 qualifying results survive, return 25 candidates — include stocks currently priced between $0.50 and $15 so the live price filter has enough to work with.

Return ONLY a valid JSON array of exactly 25 objects, no markdown:
[{"symbol":"TICKER","company_name":"Name","sector":"${category}","catalyst":"Specific upcoming catalyst and why it drives price up (1–2 sentences)","sentiment":"Very Bullish","predicted_change_pct":18}]

sentiment values: "Bullish" | "Very Bullish" | "Extremely Bullish"
predicted_change_pct: realistic upside % from the catalyst — minimum 10, be bold but honest.
Rank by highest conviction and upside potential first. Educational only.`;

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

    return NextResponse.json({
      picks: enriched,
      message: enriched.length === 0 ? `No qualifying ${category} stocks under $10 found right now — try again later` : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("under10-picks error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
