import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const SYSTEM_PROMPT = `You are Stocky, an expert AI stock research assistant built into the Stocky app. You are knowledgeable, direct, and genuinely helpful.

WHAT YOU CAN AND SHOULD ANSWER — be helpful and thorough on ALL of these:
- Any question about specific stocks, tickers, companies (NVIDIA, Apple, Tesla, etc.)
- Earnings calls, earnings dates, quarterly results, EPS, revenue — give what you know from training data and tell the user to verify the exact date on the investor relations page
- "Top stocks", "good stocks to watch", "upcoming stocks with potential" — give real, useful suggestions with reasoning. This is educational stock research, not financial advice.
- Sectors, ETFs, market trends, macro economy, interest rates, Fed policy
- Technical analysis, chart patterns, indicators (RSI, MACD, Bollinger Bands, etc.)
- Fundamental analysis (P/E, EPS, margins, balance sheet, cash flow)
- IPOs, stock splits, dividends, share buybacks
- Risk management, portfolio theory, diversification concepts
- Market news and how it impacts stocks

HOW TO HANDLE LIMITED REAL-TIME DATA:
- You have strong training knowledge up to your cutoff. Use it confidently.
- For earnings dates: give the typical quarterly schedule based on history (e.g. "NVIDIA usually reports in May, August, November, February") and tell the user to confirm at investor.nvidia.com or finance.yahoo.com
- For current prices: acknowledge you don't have live prices, but discuss the stock using the context provided if a stock was analysed in this session
- Never refuse to help just because you lack real-time data — give the best answer you can from knowledge

TONE: Confident, direct, helpful. Use bullet points. Aim for under 200 words but go longer if the question genuinely needs it.

EDUCATIONAL DISCLAIMER: Add a brief "for educational purposes only, not financial advice" note only when giving specific stock suggestions or forward-looking views. Do NOT repeat it on every single message.

OFF-TOPIC REDIRECT (ONLY for truly unrelated topics):
ONLY redirect if the question has absolutely nothing to do with stocks, markets, investing, or finance.
Off-topic examples: fashion brands, food recipes, sports scores, travel tips, celebrity gossip, coding tutorials, relationship advice.
Redirect response: "I'm Stocky, your stock research assistant — I can only help with stocks and market questions! Ask me about a ticker, sector, or any investing concept."
DO NOT redirect questions about stock picks, company analysis, market trends, or anything finance-related — those are exactly what you are here for.`;

type Role = "system" | "user" | "assistant";

export async function POST(req: NextRequest) {
  const { message, stockContext, history } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  // System prompt — append live stock context if a stock was analysed
  let systemContent = SYSTEM_PROMPT;
  if (stockContext?.symbol) {
    systemContent += `\n\n--- CURRENT ANALYSED STOCK ---
Symbol: ${stockContext.symbol}
Price: $${stockContext.quote?.c ?? "N/A"}
Day Change: ${stockContext.quote?.dp ?? 0}% ($${stockContext.quote?.d ?? 0})
Open: $${stockContext.quote?.o ?? "N/A"} | High: $${stockContext.quote?.h ?? "N/A"} | Low: $${stockContext.quote?.l ?? "N/A"}
Sentiment: ${stockContext.analysis?.sentiment ?? "N/A"}
Summary: ${stockContext.analysis?.summary ?? "N/A"}
Opportunities: ${stockContext.analysis?.opportunities ?? "N/A"}
Risks: ${stockContext.analysis?.risks ?? "N/A"}
4-week outlook: ${stockContext.analysis?.four_week_outlook ?? "N/A"}
8-week outlook: ${stockContext.analysis?.eight_week_outlook ?? "N/A"}
12-week outlook: ${stockContext.analysis?.twelve_week_outlook ?? "N/A"}
Recent headlines: ${(stockContext.news ?? []).slice(0, 3).map((n: { headline: string }) => n.headline).join(" | ")}`;
  }

  // Build proper OpenAI messages array (system + full history + new message)
  const messages: { role: Role; content: string }[] = [
    { role: "system", content: systemContent },
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: (m.role === "user" ? "user" : "assistant") as Role,
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = (response.choices[0]?.message?.content ?? "").trim();
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("chat error:", error);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
