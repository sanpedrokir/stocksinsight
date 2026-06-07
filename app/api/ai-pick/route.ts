import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  try {
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/news?category=technology&token=${finnhubKey}`
    );
    const newsData = await newsRes.json();
    const news = (Array.isArray(newsData) ? newsData : [])
      .slice(0, 20)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary,
        related: item.related,
      }));

    if (news.length === 0) {
      return NextResponse.json({ error: "No news data available" }, { status: 500 });
    }

    const prompt = `You are an AI stock research assistant. Based on these latest technology/AI news headlines, identify ONE publicly-traded US stock that has the most potential to gain value in the next 4 weeks due to AI-related developments or upcoming catalysts.

News:
${JSON.stringify(news, null, 2)}

Return ONLY valid JSON with exactly these keys:
{
  "symbol": "TICKER",
  "company_name": "Full Company Name",
  "reason": "2-3 sentence explanation of the specific AI catalyst driving this opportunity",
  "key_catalyst": "One-line summary of the main driver (e.g. 'New LLM product launch', 'AI chip demand surge')",
  "predicted_price_change_pct": <number between 2 and 30>,
  "confidence": "Low" | "Medium" | "High",
  "timeframe": "4 weeks"
}

Rules: Only use real US-listed ticker symbols. This is educational only — not financial advice.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const rawOutput = aiResponse.choices[0]?.message?.content ?? "";
    const match = rawOutput.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse AI pick" }, { status: 500 });
    }

    const pick = JSON.parse(match[0]);

    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${pick.symbol}&token=${finnhubKey}`
    );
    const quote = await quoteRes.json();

    const currentPrice: number = quote.c ?? 0;
    const changePct: number = pick.predicted_price_change_pct ?? 5;
    const predictedPrice = parseFloat((currentPrice * (1 + changePct / 100)).toFixed(2));

    return NextResponse.json({
      symbol: pick.symbol,
      company_name: pick.company_name,
      reason: pick.reason,
      key_catalyst: pick.key_catalyst,
      confidence: pick.confidence,
      timeframe: pick.timeframe ?? "4 weeks",
      current_price: currentPrice,
      predicted_price: predictedPrice,
      predicted_change_pct: changePct,
      quote,
    });
  } catch (error) {
    console.error("ai-pick error:", error);
    return NextResponse.json({ error: "Failed to generate AI pick" }, { status: 500 });
  }
}
