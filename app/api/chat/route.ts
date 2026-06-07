import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { message, stockContext, history } = await req.json();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const contextBlock = stockContext
    ? `You have access to the following stock data that was just analysed:

Symbol: ${stockContext.symbol}
Current Price: $${stockContext.quote?.c}
Change: ${stockContext.quote?.d} (${stockContext.quote?.dp}%)
High: $${stockContext.quote?.h} | Low: $${stockContext.quote?.l}

AI Analysis Summary: ${stockContext.analysis?.summary ?? "N/A"}
Sentiment: ${stockContext.analysis?.sentiment ?? "N/A"}
Opportunities: ${stockContext.analysis?.opportunities ?? "N/A"}
Risks: ${stockContext.analysis?.risks ?? "N/A"}
4-week outlook: ${stockContext.analysis?.four_week_outlook ?? "N/A"}
8-week outlook: ${stockContext.analysis?.eight_week_outlook ?? "N/A"}
12-week outlook: ${stockContext.analysis?.twelve_week_outlook ?? "N/A"}

Recent news headlines:
${(stockContext.news ?? []).slice(0, 3).map((n: { headline: string }) => `- ${n.headline}`).join("\n")}`
    : "No stock has been analysed yet. You can help the user pick a stock to research.";

  const conversationHistory = (history ?? [])
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are an AI stock research assistant integrated into InsightStock AI.
You help users understand stock data and analysis for educational purposes only.
Never say "buy", "sell", or "guaranteed". Never give direct financial advice.
Always remind users that this is for educational purposes.

${contextBlock}

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n` : ""}
User: ${message}
Assistant:`;

  try {
    const aiResponse = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const reply =
      typeof aiResponse.output_text === "string"
        ? aiResponse.output_text.trim()
        : "I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("chat error:", error);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
