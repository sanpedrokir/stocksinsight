import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    // Phase 1: fetch 3 news sources only (keeps well under rate limit)
    const [techRes, generalRes, mergerRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=NVDA&from=${daysAgo(7)}&to=${daysAgo(0)}&token=${finnhubKey}`),
    ]);

    async function safeJson(r: PromiseSettledResult<Response>) {
      if (r.status === "rejected") return [];
      try { return await r.value.json(); } catch { return []; }
    }

    const [tech, general, nvdaNews] = await Promise.all([
      safeJson(techRes),
      safeJson(generalRes),
      safeJson(mergerRes),
    ]);

    const allNews = [
      ...(Array.isArray(tech) ? tech : []).slice(0, 25),
      ...(Array.isArray(general) ? general : []).slice(0, 15),
      ...(Array.isArray(nvdaNews) ? nvdaNews : []).slice(0, 10),
    ]
      .sort((a: any, b: any) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 40)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary?.slice(0, 150),
        related: item.related,
      }));

    // Phase 2: GPT picks 20 AI stocks
    const prompt = `You are a top-tier AI stock analyst. Based on these latest AI/technology news headlines, identify the TOP 10 US-listed stocks most likely to gain value from AI-related developments in the next 4 weeks.

News:
${JSON.stringify(allNews, null, 2)}

Return ONLY a valid JSON array of exactly 10 objects, no markdown:
[{"symbol":"TICKER","company_name":"Name","ai_angle":"Specific AI catalyst (1 sentence)","reason":"2-sentence analysis","predicted_change_pct":5,"confidence":"High"}]

confidence values: "Medium" | "High" | "Very High"
Rank highest conviction first. Only real US-listed tickers. Educational only.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse AI picks" }, { status: 500 });
    }

    const picks: any[] = JSON.parse(match[0]).slice(0, 10);

    // Phase 3: fetch all 10 quotes in one batch
    const quotesRaw = await Promise.allSettled(
      picks.map(p =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${p.symbol}&token=${finnhubKey}`).then(r => r.json())
      )
    );
    const quotes = quotesRaw.map(r => r.status === "fulfilled" ? r.value : null);

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
