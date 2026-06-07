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

    // Phase 2: GPT picks 20 AI stocks
    const prompt = `You are a top-tier AI stock analyst. Based on these latest technology news headlines, identify the TOP 5 US-listed stocks most likely to gain value from AI-related developments in the next 4 weeks.

STRICT ELIGIBILITY: Only include companies where AI is a CORE part of the business — semiconductors, AI chips, cloud/AI infrastructure, AI software platforms, LLM developers, AI data centers, robotics, or companies deriving significant direct revenue from AI products.

DO NOT include: airlines, media/entertainment (Disney, Netflix), retail, consumer goods, defence/aerospace (Boeing, Lockheed), banks, pharma, or any company where "AI" is just a minor tool they use internally. If you cannot point to a direct AI revenue line or AI product, exclude it.

News:
${JSON.stringify(allNews, null, 2)}

Return ONLY a valid JSON array of exactly 5 objects, no markdown:
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

    const picks: any[] = JSON.parse(match[0]).slice(0, 5);

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
