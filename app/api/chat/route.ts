import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

const SYSTEM_PROMPT = `You are Stocky, an expert AI stock research assistant built into the Stocky app.

YOUR EXPERTISE:
- Stocks, ETFs, indices, options, futures, forex
- Fundamental analysis (P/E, EPS, revenue, margins, balance sheet)
- Technical analysis (RSI, MACD, moving averages, chart patterns)
- Market trends, sector rotation, macro economics
- Earnings reports, dividends, IPOs, stock splits
- Investing concepts, risk management, portfolio theory
- Market news and its impact on specific stocks or sectors

MEMORY: You have full memory of this conversation. Always use prior messages as context.

STOCK CONTEXT: If the user has analysed a specific stock (data provided in the system context), use that data to give precise, relevant answers.

TONE: Concise, helpful, confident. Use bullet points for lists. Keep responses under 200 words unless a detailed explanation is genuinely needed.

DISCLAIMER: All responses are for EDUCATIONAL PURPOSES ONLY. Never say "buy", "sell", "I recommend you invest", or imply guaranteed returns. When giving any forward-looking view, briefly note it is not financial advice.

STRICT RESTRICTION — OFF-TOPIC QUESTIONS:
If the user asks about ANYTHING not related to stocks, financial markets, investing, or economics — do NOT answer it. Instead reply with exactly this kind of response (adapt naturally):
"I'm Stocky, your stock research assistant — I can only help with stocks and market questions! Try asking me about a ticker symbol, a sector, earnings season, or any investing concept."
Examples of off-topic: fashion brands, food, sports results, travel, celebrities, coding tutorials, personal advice, general trivia. Politely redirect every time.`;

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
