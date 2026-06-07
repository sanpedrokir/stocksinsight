"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [symbol, setSymbol] = useState("NVDA");
  const [result, setResult] = useState<any>(null);
  const [forecastHistory, setForecastHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [aiPick, setAiPick] = useState<any>(null);
  const [aiPickLoading, setAiPickLoading] = useState(false);
  const [aiPickError, setAiPickError] = useState<string | null>(null);

  const [topPicks, setTopPicks] = useState<any[]>([]);
  const [topPicksLoading, setTopPicksLoading] = useState(false);
  const [topPicksError, setTopPicksError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForecasts() {
      try {
        const res = await fetch("/api/forecasts");
        const data = await res.json();
        setForecastHistory(data.forecasts ?? []);
      } catch {
        // silently ignore
      }
    }
    loadForecasts();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function fetchAiPick() {
    setAiPickLoading(true);
    setAiPickError(null);
    setAiPick(null);
    try {
      const res = await fetch("/api/ai-pick");
      const data = await res.json();
      if (!res.ok) {
        setAiPickError(data.error || "Failed to fetch AI pick.");
        return;
      }
      setAiPick(data);
    } catch {
      setAiPickError("Network error — please try again.");
    } finally {
      setAiPickLoading(false);
    }
  }

  async function fetchTopPicks() {
    setTopPicksLoading(true);
    setTopPicksError(null);
    setTopPicks([]);
    try {
      const res = await fetch("/api/top-picks");
      const data = await res.json();
      if (!res.ok) {
        setTopPicksError(data.error || "Failed to fetch top picks.");
        return;
      }
      setTopPicks(data.picks ?? []);
    } catch {
      setTopPicksError("Network error — please try again.");
    } finally {
      setTopPicksLoading(false);
    }
  }

  async function analyseStock() {
    if (!symbol.trim()) {
      setError("Please enter a valid stock symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setChatMessages([]);

    try {
      const res = await fetch(`/api/analyse?symbol=${symbol.trim().toUpperCase()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to analyse the stock.");
        return;
      }

      setResult(data);

      setChatMessages([
        {
          role: "assistant",
          content: `I've finished analysing **${data.symbol}**. The current price is **$${data.quote?.c}** with a ${(data.quote?.dp ?? 0) >= 0 ? "+" : ""}${data.quote?.dp}% change today. Ask me anything about this stock!`,
        },
      ]);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    const updated: Message[] = [...chatMessages, { role: "user", content: userMessage }];
    setChatMessages(updated);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          stockContext: result,
          history: updated.slice(0, -1),
        }),
      });
      const data = await res.json();
      setChatMessages([...updated, { role: "assistant", content: data.reply ?? "No response." }]);
    } catch {
      setChatMessages([...updated, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    }
    setChatLoading(false);
  }

  const analysis = result?.analysis;
  const isStructured = analysis && typeof analysis === "object";
  const priceChange = result?.quote?.dp ?? 0;
  const isPositive = priceChange >= 0;

  function sentimentColor(sentiment: string) {
    const s = sentiment?.toLowerCase() ?? "";
    if (s.includes("bullish") || s.includes("positive")) return "bg-emerald-100 text-emerald-800";
    if (s.includes("bearish") || s.includes("negative")) return "bg-red-100 text-red-800";
    return "bg-amber-100 text-amber-800";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-5 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">I</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">InsightStock AI</h1>
            <p className="text-slate-400 text-xs">AI-powered stock research — for educational purposes only</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Search bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Stock Symbol</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 border-2 border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-semibold text-base placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors uppercase"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && analyseStock()}
              placeholder="e.g. AAPL, TSLA, MSFT"
            />
            <button
              onClick={analyseStock}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              {loading ? "Analysing…" : "Analyse"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              onClick={fetchAiPick}
              disabled={aiPickLoading}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {aiPickLoading ? "Scanning AI news…" : "Potential AI Stock to Lookout"}
            </button>
            <button
              onClick={fetchTopPicks}
              disabled={topPicksLoading}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {topPicksLoading ? "Curating picks…" : "Top 5 Upcoming Good Stocks"}
            </button>
          </div>
          {aiPickError && <p className="mt-2 text-sm text-red-600 font-medium">{aiPickError}</p>}
          {topPicksError && <p className="mt-2 text-sm text-red-600 font-medium">{topPicksError}</p>}
        </div>

        {/* AI Pick card */}
        {aiPick && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-violet-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Potential AI Stock to Lookout</h2>
                <p className="text-xs text-slate-400">Based on latest AI & tech news — educational only</p>
              </div>
              <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${
                aiPick.confidence === "High" ? "bg-emerald-100 text-emerald-700"
                : aiPick.confidence === "Medium" ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
              }`}>
                {aiPick.confidence} Confidence
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">{aiPick.symbol}</span>
                  <span className="text-slate-500 text-sm font-medium">{aiPick.company_name}</span>
                </div>
                {aiPick.key_catalyst && (
                  <span className="inline-block mt-1 text-xs bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-md border border-violet-100">
                    {aiPick.key_catalyst}
                  </span>
                )}
              </div>

              <div className="flex gap-4 sm:gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-500 font-medium">Current Price</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {aiPick.current_price > 0 ? `$${aiPick.current_price.toFixed(2)}` : "N/A"}
                  </p>
                </div>
                <div className="w-px bg-slate-200" />
                <div className="text-center">
                  <p className="text-xs text-slate-500 font-medium">Predicted ({aiPick.timeframe})</p>
                  <p className="text-xl font-bold text-violet-600 mt-0.5">
                    {aiPick.predicted_price > 0 ? `$${aiPick.predicted_price.toFixed(2)}` : "N/A"}
                  </p>
                  {aiPick.predicted_change_pct > 0 && (
                    <span className="text-xs font-semibold text-emerald-600">
                      ▲ +{aiPick.predicted_change_pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1">AI Reasoning</p>
              <p className="text-sm text-slate-700 leading-relaxed">{aiPick.reason}</p>
            </div>

            <button
              onClick={async () => {
                setSymbol(aiPick.symbol);
                setLoading(true);
                setError(null);
                setResult(null);
                setChatMessages([]);
                try {
                  const res = await fetch(`/api/analyse?symbol=${aiPick.symbol}`);
                  const data = await res.json();
                  if (!res.ok) { setError(data.error || "Failed to analyse."); return; }
                  setResult(data);
                  setChatMessages([{ role: "assistant", content: `I've finished analysing **${data.symbol}**. Current price is **$${data.quote?.c}**. Ask me anything!` }]);
                } catch {
                  setError("Network error — please try again.");
                } finally {
                  setLoading(false);
                }
              }}
              className="text-sm text-violet-600 hover:text-violet-800 font-semibold underline underline-offset-2 transition-colors"
            >
              Analyse {aiPick.symbol} in detail →
            </button>
          </div>
        )}

        {/* Top 5 picks card */}
        {topPicks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-teal-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Top 5 Upcoming Good Stocks</h2>
                <p className="text-xs text-slate-400">Curated from latest Finnhub market news — educational only</p>
              </div>
            </div>

            <div className="space-y-3">
              {topPicks.map((pick, i) => (
                <div key={pick.symbol} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center gap-3 min-w-[2rem]">
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 w-6 h-6 rounded-full flex items-center justify-center border border-teal-200">
                      {i + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{pick.symbol}</span>
                      <span className="text-slate-500 text-sm truncate">{pick.company_name}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        pick.sentiment === "Very Bullish"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-teal-100 text-teal-700"
                      }`}>
                        {pick.sentiment}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{pick.catalyst}</p>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 font-medium">Now</p>
                      <p className="font-bold text-slate-900 text-sm">
                        {pick.current_price > 0 ? `$${pick.current_price.toFixed(2)}` : "—"}
                      </p>
                      {pick.day_change_pct !== null && (
                        <p className={`text-xs font-medium ${pick.day_change_pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {pick.day_change_pct >= 0 ? "+" : ""}{pick.day_change_pct.toFixed(2)}% today
                        </p>
                      )}
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="text-center">
                      <p className="text-xs text-slate-400 font-medium">Predicted</p>
                      <p className="font-bold text-teal-600 text-sm">
                        {pick.predicted_price ? `$${pick.predicted_price.toFixed(2)}` : "—"}
                      </p>
                      <p className="text-xs font-semibold text-emerald-600">
                        ▲ +{pick.predicted_change_pct.toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setSymbol(pick.symbol);
                        setLoading(true);
                        setError(null);
                        setResult(null);
                        setChatMessages([]);
                        try {
                          const res = await fetch(`/api/analyse?symbol=${pick.symbol}`);
                          const data = await res.json();
                          if (!res.ok) { setError(data.error || "Failed to analyse."); return; }
                          setResult(data);
                          setChatMessages([{ role: "assistant", content: `I've finished analysing **${data.symbol}**. Current price is **$${data.quote?.c}**. Ask me anything!` }]);
                        } catch {
                          setError("Network error — please try again.");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="text-xs text-teal-600 hover:text-teal-800 font-semibold underline underline-offset-2 transition-colors whitespace-nowrap"
                    >
                      Analyse →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result?.quote && (
          <>
            {/* Price card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">{result.symbol}</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Live market data via Finnhub</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-slate-900">${result.quote.c?.toFixed(2)}</p>
                  <span className={`inline-block mt-1 text-sm font-semibold px-3 py-1 rounded-full ${isPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {isPositive ? "▲" : "▼"} {Math.abs(result.quote.dp).toFixed(2)}% ({isPositive ? "+" : ""}{result.quote.d?.toFixed(2)})
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                {[
                  { label: "Open", value: `$${result.quote.o?.toFixed(2)}` },
                  { label: "Prev Close", value: `$${result.quote.pc?.toFixed(2)}` },
                  { label: "Day High", value: `$${result.quote.h?.toFixed(2)}` },
                  { label: "Day Low", value: `$${result.quote.l?.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            {isStructured && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">AI Analysis</h2>
                  {analysis.sentiment && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sentimentColor(analysis.sentiment)}`}>
                      {analysis.sentiment}
                    </span>
                  )}
                </div>

                {analysis.summary && (
                  <p className="text-slate-700 leading-relaxed">{analysis.summary}</p>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {analysis.opportunities && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Opportunities</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysis.opportunities}</p>
                    </div>
                  )}
                  {analysis.risks && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Risks</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysis.risks}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Scenario Outlook</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { label: "4-Week", value: analysis.four_week_outlook },
                      { label: "8-Week", value: analysis.eight_week_outlook },
                      { label: "12-Week", value: analysis.twelve_week_outlook },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-indigo-600 mb-1">{label}</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* News */}
            {result.news?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Latest News</h2>
                <div className="space-y-4">
                  {result.news.map((item: any, i: number) => (
                    <div key={i} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                      <p className="font-semibold text-slate-800 text-sm leading-snug">{item.headline}</p>
                      <p className="text-xs text-indigo-600 font-medium mt-0.5">{item.source}</p>
                      {item.summary && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Forecast history */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Forecast History</h2>
          {forecastHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No forecast history yet. Analyse a stock to get started.</p>
          ) : (
            <div className="space-y-2">
              {forecastHistory.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 text-sm">{f.symbol}</span>
                    {f.current_price && (
                      <span className="text-slate-600 text-sm">${parseFloat(f.current_price).toFixed(2)}</span>
                    )}
                  </div>
                  {f.created_at && (
                    <span className="text-xs text-slate-400">{new Date(f.created_at).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating AI Chat button */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-50"
        title="Ask AI Agent"
      >
        {chatOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-40 overflow-hidden" style={{ maxHeight: "70vh" }}>
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-400 flex items-center justify-center text-xs font-bold">AI</div>
            <div>
              <p className="font-semibold text-sm">Stock Research Agent</p>
              <p className="text-indigo-200 text-xs">{result ? `Analysing ${result.symbol}` : "Ask me about any stock"}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <p className="text-sm text-slate-500 text-center mt-4">
                {result ? "Ask me anything about this stock analysis!" : "Analyse a stock first, then ask me questions about it."}
              </p>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2 text-slate-500 text-sm">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-200 p-3 flex gap-2">
            <input
              className="flex-1 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ask about this stock…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              disabled={chatLoading}
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl px-3 py-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
