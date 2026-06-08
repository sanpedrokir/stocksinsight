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
    // Phase 1: tech news only — no general feed to avoid non-AI companies bleeding in
    const [techRes, nvdaRes, msftRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=NVDA&from=${daysAgo(7)}&to=${daysAgo(0)}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=MSFT&from=${daysAgo(7)}&to=${daysAgo(0)}&token=${finnhubKey}`),
    ]);

    async function safeJson(r: PromiseSettledResult<Response>) {
      if (r.status === "rejected") return [];
      try { return await r.value.json(); } catch { return []; }
    }

    const [tech, nvdaNews, msftNews] = await Promise.all([
      safeJson(techRes),
      safeJson(nvdaRes),
      safeJson(msftRes),
    ]);

    const allNews = [
      ...(Array.isArray(tech) ? tech : []).slice(0, 30),
      ...(Array.isArray(nvdaNews) ? nvdaNews : []).slice(0, 8),
      ...(Array.isArray(msftNews) ? msftNews : []).slice(0, 8),
    ]
      .sort((a: any, b: any) => (b.datetime ?? 0) - (a.datetime ?? 0))
      .slice(0, 40)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary?.slice(0, 150),
        related: item.related,
      }));

    // Phase 2: GPT picks AI stocks under $10
    const prompt = `You are a top-tier AI stock analyst. Based on these latest technology news headlines, identify 15 US-listed AI stocks most likely to gain value from AI-related developments in the next 4 weeks.

PRICE REQUIREMENT: ONLY suggest stocks currently priced under $10. Think small-cap and micro-cap AI names — NOT Nvidia, Microsoft, Google, Apple, Meta, Amazon, or any large-cap. Target tickers like SOUN, BBAI, SYNTX, AIXI, INPX, or similar micro/small-cap AI plays.

STRICT ELIGIBILITY: Only include companies where AI is a CORE part of the business — AI chips, cloud/AI infrastructure, AI software platforms, LLM tools, AI data, robotics, or direct AI revenue.

News:
${JSON.stringify(allNews, null, 2)}

Return ONLY a valid JSON array of exactly 15 objects, no markdown:
[{"symbol":"TICKER","company_name":"Name","ai_angle":"Specific AI product or revenue catalyst (1 sentence)","reason":"2-sentence analysis","predicted_change_pct":5,"confidence":"High"}]

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

    const candidates: any[] = JSON.parse(match[0]).slice(0, 15);

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
          ai_angle: pick.ai_angle,
          reason: pick.reason,
          confidence: pick.confidence,
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
      message: enriched.length === 0 ? "No qualifying AI stocks under $10 found right now — try again later" : undefined,
    });
  } catch (error) {
    console.error("ai-pick error:", error);
    return NextResponse.json({ error: "Failed to generate AI picks" }, { status: 500 });
  }
}
