import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { sql } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function getDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

function extractAnalysis(outputText: string) {
  const match = outputText.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    return {
      summary: String(parsed.summary ?? "").trim(),
      sentiment: String(parsed.sentiment ?? "").trim(),
      opportunities: String(parsed.opportunities ?? "").trim(),
      risks: String(parsed.risks ?? "").trim(),
      four_week_outlook: String(parsed.four_week_outlook ?? "").trim(),
      eight_week_outlook: String(parsed.eight_week_outlook ?? "").trim(),
      twelve_week_outlook: String(parsed.twelve_week_outlook ?? "").trim(),
      raw_text: outputText.trim(),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "AAPL";

  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (!finnhubKey || !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing API keys" },
      { status: 500 }
    );
  }

  try {
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`;
    const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${getDate(14)}&to=${getDate(0)}&token=${finnhubKey}`;

    const [quoteRes, newsRes] = await Promise.all([
      fetch(quoteUrl),
      fetch(newsUrl),
    ]);

    const quote = await quoteRes.json();
    const newsData = await newsRes.json();

    const news = (Array.isArray(newsData) ? newsData : [])
      .slice(0, 5)
      .map((item: any) => ({
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        url: item.url,
      }));

    const prompt = `You are an AI stock research assistant.

Analyse this stock for educational purposes only.
Do not give financial advice.
Do not say "buy", "sell", or "guaranteed".

Stock symbol: ${symbol}

Price data:
Current price: ${quote.c}
Change: ${quote.d}
Percent change: ${quote.dp}
High: ${quote.h}
Low: ${quote.l}
Open: ${quote.o}
Previous close: ${quote.pc}

Latest news:
${JSON.stringify(news, null, 2)}

Return only valid JSON with the following keys:
summary, sentiment, opportunities, risks, four_week_outlook, eight_week_outlook, twelve_week_outlook.
Do not include any markdown formatting.
`;

    const aiResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const rawOutput =
      typeof aiResponse.output_text === "string"
        ? aiResponse.output_text
        : Array.isArray(aiResponse.output)
        ? aiResponse.output
            .map((item: any) =>
              Array.isArray(item.content)
                ? item.content.map((content: any) => content.text ?? "").join("\n")
                : ""
            )
            .join("\n")
        : "";

    const analysis =
      extractAnalysis(rawOutput) || {
        summary: rawOutput,
        sentiment: "Unknown",
        opportunities: "",
        risks: "",
        four_week_outlook: "",
        eight_week_outlook: "",
        twelve_week_outlook: "",
        raw_text: rawOutput,
      };

    try {
      await sql`
        INSERT INTO stock_forecasts (
          symbol,
          current_price,
          four_week_outlook,
          eight_week_outlook,
          twelve_week_outlook,
          ai_analysis
        )
        VALUES (
          ${symbol},
          ${quote.c},
          ${analysis.four_week_outlook},
          ${analysis.eight_week_outlook},
          ${analysis.twelve_week_outlook},
          ${rawOutput}
        )
      `;

      await sql`
        INSERT INTO stock_price_snapshots (symbol, price)
        VALUES (${symbol}, ${quote.c})
      `;
    } catch (dbError) {
      console.error("DB save warning:", dbError);
    }

    return NextResponse.json({
      symbol,
      quote,
      news,
      analysis,
    });
  } catch (error) {
    console.error("analyse error:", error);
    return NextResponse.json(
      { error: "Failed to analyse stock" },
      { status: 500 }
    );
  }
}
