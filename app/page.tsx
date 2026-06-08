"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const CHEAPO_CATEGORIES = [
  "AI & Tech", "Biotech", "Pharmaceutical", "Oil & Gas",
  "Renewable Energy", "Gold & Mining", "Finance & Banking", "Entertainment & Media",
  "Cannabis", "EV & Clean Tech", "Semiconductors", "Real Estate (REITs)",
  "Cybersecurity", "Gaming", "Healthcare", "Agriculture",
  "Space & Aerospace", "Crypto & Blockchain", "Robotics & Automation", "Retail & Consumer",
];

function PickRow({ pick, accentColor, extraLabel, onAnalyse }: {
  pick: any;
  accentColor: "violet" | "teal";
  extraLabel?: string;
  onAnalyse: () => void;
}) {
  const ac = accentColor === "violet"
    ? { rank: "text-violet-600 bg-violet-50 border-violet-200", badge: "bg-violet-100 text-violet-700", price: "text-violet-600", link: "text-violet-600 hover:text-violet-800", tag: "bg-violet-50 text-violet-700 border-violet-100" }
    : { rank: "text-teal-600 bg-teal-50 border-teal-200", badge: "bg-teal-100 text-teal-700", price: "text-teal-600", link: "text-teal-600 hover:text-teal-800", tag: "bg-teal-50 text-teal-700 border-teal-100" };

  const sentimentBg = (s: string) => {
    if (s?.toLowerCase().includes("extremely")) return "bg-emerald-200 text-emerald-800";
    if (s?.toLowerCase().includes("very")) return "bg-emerald-100 text-emerald-700";
    return ac.badge;
  };

  return (
    <div className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border shrink-0 mt-0.5 ${ac.rank}`}>
          {pick.rank}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-slate-900">{pick.symbol}</span>
            <span className="text-slate-500 text-sm">{pick.company_name}</span>
            {pick.sentiment && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sentimentBg(pick.sentiment)}`}>{pick.sentiment}</span>
            )}
            {pick.confidence && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                pick.confidence === "Very High" ? "bg-emerald-100 text-emerald-700"
                : pick.confidence === "High" ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
              }`}>{pick.confidence}</span>
            )}
          </div>
          {extraLabel && (
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md border ${ac.tag}`}>
              {extraLabel}
            </span>
          )}
          <p className="text-xs text-slate-600 leading-relaxed">{pick.catalyst || pick.reason}</p>
          {pick.reason && pick.catalyst && (
            <p className="text-xs text-slate-500 leading-relaxed">{pick.reason}</p>
          )}
        </div>
      </div>

      {/* Price row — always horizontal, sits below content on mobile */}
      <div className="mt-3 ml-9 flex items-center gap-3 sm:gap-4">
        <div className="text-center min-w-[48px]">
          <p className="text-xs text-slate-400 font-medium">Now</p>
          <p className="font-bold text-slate-900 text-sm">{pick.current_price > 0 ? `$${pick.current_price.toFixed(2)}` : "—"}</p>
          {pick.day_change_pct !== null && pick.day_change_pct !== undefined && (
            <p className={`text-xs font-medium ${pick.day_change_pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {pick.day_change_pct >= 0 ? "+" : ""}{pick.day_change_pct.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="w-px h-8 bg-slate-200" />
        <div className="text-center min-w-[48px]">
          <p className="text-xs text-slate-400 font-medium">4w target</p>
          <p className={`font-bold text-sm ${ac.price}`}>{pick.predicted_price ? `$${pick.predicted_price.toFixed(2)}` : "—"}</p>
          {pick.predicted_change_pct != null && (
            <p className="text-xs font-semibold text-emerald-600">▲ +{pick.predicted_change_pct.toFixed(1)}%</p>
          )}
        </div>
        <button onClick={onAnalyse} className={`ml-auto text-xs font-semibold underline underline-offset-2 transition-colors whitespace-nowrap ${ac.link}`}>
          Analyse →
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [symbol, setSymbol] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  function copyMessage(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }

  const [aiPicks, setAiPicks] = useState<any[]>([]);
  const [aiPickLoading, setAiPickLoading] = useState(false);
  const [aiPickError, setAiPickError] = useState<string | null>(null);

  const [topPicks, setTopPicks] = useState<any[]>([]);
  const [topPicksLoading, setTopPicksLoading] = useState(false);
  const [topPicksError, setTopPicksError] = useState<string | null>(null);

  const [cheapoPicks, setCheapoPicks] = useState<any[]>([]);
  const [cheapoLoading, setCheapoLoading] = useState(false);
  const [cheapoError, setCheapoError] = useState<string | null>(null);
  const [cheapoCategory, setCheapoCategory] = useState<string | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Show greeting when chat opens for the first time
  useEffect(() => {
    if (chatOpen && chatMessages.length === 0) {
      setChatMessages([{
        role: "assistant",
        content: "Hi! I'm Stocky AI — ask me anything about stocks, markets, sectors, earnings, or investing concepts. What would you like to know?",
      }]);
    }
  }, [chatOpen]);

  async function fetchAiPick() {
    setAiPickLoading(true); setAiPickError(null); setAiPicks([]);
    try {
      const res = await fetch("/api/ai-pick");
      const data = await res.json();
      if (!res.ok) { setAiPickError(data.error || "Failed to fetch AI picks."); return; }
      setAiPicks(data.picks ?? []);
    } catch { setAiPickError("Network error — please try again."); }
    finally { setAiPickLoading(false); }
  }

  async function fetchTopPicks() {
    setTopPicksLoading(true); setTopPicksError(null); setTopPicks([]);
    try {
      const res = await fetch("/api/top-picks");
      const data = await res.json();
      if (!res.ok) { setTopPicksError(data.error || "Failed to fetch top picks."); return; }
      setTopPicks(data.picks ?? []);
    } catch { setTopPicksError("Network error — please try again."); }
    finally { setTopPicksLoading(false); }
  }

  async function fetchCheapoPicks(category: string) {
    setCheapoCategory(category);
    setCheapoLoading(true); setCheapoError(null); setCheapoPicks([]);
    try {
      const res = await fetch(`/api/under10-picks?category=${encodeURIComponent(category)}`);
      const data = await res.json();
      if (!res.ok) { setCheapoError(data.error || "Failed to fetch picks."); return; }
      setCheapoPicks(data.picks ?? []);
    } catch { setCheapoError("Network error — please try again."); }
    finally { setCheapoLoading(false); }
  }

  async function analyseStock() {
    if (!symbol.trim()) { setError("Please enter a valid stock symbol."); return; }
    setLoading(true); setError(null); setResult(null); setChatMessages([]);
    try {
      const res = await fetch(`/api/analyse?symbol=${symbol.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid symbol — please check and try again."); setSymbol(""); return; }
      setResult(data);
      setChatMessages([{
        role: "assistant",
        content: `I've finished analysing **${data.symbol}**. The current price is **$${data.quote?.c}** with a ${(data.quote?.dp ?? 0) >= 0 ? "+" : ""}${data.quote?.dp}% change today. Ask me anything!`,
      }]);
    } catch { setError("Network error — please check your connection and try again."); }
    finally { setLoading(false); }
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
        body: JSON.stringify({ message: userMessage, stockContext: result, history: updated.slice(0, -1) }),
      });
      const data = await res.json();
      setChatMessages([...updated, { role: "assistant", content: data.reply ?? "No response." }]);
    } catch {
      setChatMessages([...updated, { role: "assistant", content: "Sorry, something went wrong." }]);
    }
    setChatLoading(false);
  }

  async function analysePickStock(sym: string) {
    setSymbol(sym); setLoading(true); setError(null); setResult(null); setChatMessages([]);
    try {
      const res = await fetch(`/api/analyse?symbol=${sym}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed."); return; }
      setResult(data);
      setChatMessages([{ role: "assistant", content: `I've finished analysing **${data.symbol}**. Current price is **$${data.quote?.c}**. Ask me anything!` }]);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
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
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-4 sm:py-5 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0">I</div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">InsightStock AI</h1>
            <p className="text-slate-400 text-xs hidden sm:block">AI-powered stock research — for educational purposes only</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">

        {/* Search bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Stock Symbol</label>
          <div className="flex gap-2 sm:gap-3">
            <input
              className="flex-1 border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-slate-900 font-semibold text-base placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors uppercase"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && analyseStock()}
              placeholder="e.g. AAPL, TSLA, NVDA"
              autoFocus
            />
            <button
              onClick={analyseStock}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-5 sm:px-8 py-3 rounded-xl transition-colors whitespace-nowrap text-sm sm:text-base"
            >
              {loading ? "…" : "Analyse"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>}

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={fetchAiPick}
              disabled={aiPickLoading}
              className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {aiPickLoading ? "Scanning…" : "Top 10 AI Stocks"}
            </button>
            <button
              onClick={fetchTopPicks}
              disabled={topPicksLoading}
              className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-xl transition-colors text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {topPicksLoading ? "Curating…" : "Top 10 Good Stocks"}
            </button>
          </div>
          {aiPickError && <p className="mt-2 text-sm text-red-600 font-medium">{aiPickError}</p>}
          {topPicksError && <p className="mt-2 text-sm text-red-600 font-medium">{topPicksError}</p>}

          {/* Cheapo category picker */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-semibold text-slate-600">Top 10 potential <span className="text-indigo-500">(&lt;$10)</span> — pick a category:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHEAPO_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => fetchCheapoPicks(cat)}
                  disabled={cheapoLoading}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                    cheapoCategory === cat
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  }`}
                >
                  {cheapoLoading && cheapoCategory === cat ? "…" : cat}
                </button>
              ))}
            </div>
            {cheapoError && <p className="mt-2 text-sm text-red-600 font-medium">{cheapoError}</p>}
          </div>
        </div>

        {/* Top 10 AI picks card */}
        {aiPicks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-violet-200 p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Top 10 AI Stocks to Lookout</h2>
                <p className="text-xs text-slate-400 hidden sm:block">Ranked by conviction — AI catalysts, tech news — educational only</p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-700">{aiPicks.length}</span>
            </div>
            <div className="space-y-2">
              {aiPicks.map((pick) => (
                <PickRow key={pick.symbol} pick={pick} accentColor="violet" extraLabel={pick.ai_angle}
                  onAnalyse={() => analysePickStock(pick.symbol)} />
              ))}
            </div>
          </div>
        )}

        {/* Top 10 market picks card */}
        {topPicks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-teal-200 p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Top 10 Upcoming Good Stocks</h2>
                <p className="text-xs text-slate-400 hidden sm:block">Multi-source market curation across all sectors — educational only</p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-teal-100 text-teal-700">{topPicks.length}</span>
            </div>
            <div className="space-y-2">
              {topPicks.map((pick) => (
                <PickRow key={pick.symbol} pick={pick} accentColor="teal" extraLabel={pick.sector}
                  onAnalyse={() => analysePickStock(pick.symbol)} />
              ))}
            </div>
          </div>
        )}

        {/* Cheapo picks card */}
        {cheapoPicks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-orange-200 p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Top 10 potential
                  {cheapoCategory && <span className="ml-2 text-orange-600">— {cheapoCategory}</span>}
                </h2>
                <p className="text-xs text-slate-400 hidden sm:block">Real-time price verified under $10 — {cheapoCategory ?? "all sectors"} — educational only</p>
              </div>
              <span className="ml-auto shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">{cheapoPicks.length}</span>
            </div>
            <div className="space-y-2">
              {cheapoPicks.map((pick) => (
                <div key={pick.symbol} className="bg-slate-50 rounded-xl p-3 sm:p-4 border border-slate-100 hover:border-orange-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border shrink-0 mt-0.5 text-orange-600 bg-orange-50 border-orange-200">
                      {pick.rank}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{pick.symbol}</span>
                        <span className="text-slate-500 text-sm">{pick.company_name}</span>
                        {pick.sector && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">{pick.sector}</span>
                        )}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          pick.sentiment === "Extremely Bullish" ? "bg-emerald-200 text-emerald-800"
                          : pick.sentiment === "Very Bullish" ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                        }`}>{pick.sentiment}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{pick.catalyst}</p>
                    </div>
                  </div>
                  <div className="mt-3 ml-9 flex items-center gap-3">
                    <div className="text-center min-w-[48px]">
                      <p className="text-xs text-slate-400 font-medium">Price</p>
                      <p className="font-bold text-slate-900 text-sm">${pick.current_price.toFixed(2)}</p>
                      {pick.day_change_pct !== null && pick.day_change_pct !== undefined && (
                        <p className={`text-xs font-medium ${pick.day_change_pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {pick.day_change_pct >= 0 ? "+" : ""}{pick.day_change_pct.toFixed(2)}%
                        </p>
                      )}
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="text-center min-w-[48px]">
                      <p className="text-xs text-slate-400 font-medium">Target</p>
                      <p className="font-bold text-orange-600 text-sm">{pick.predicted_price != null ? `$${pick.predicted_price.toFixed(2)}` : "—"}</p>
                      {pick.predicted_change_pct != null && (
                        <p className="text-xs font-semibold text-emerald-600">▲ +{pick.predicted_change_pct.toFixed(1)}%</p>
                      )}
                    </div>
                    <button
                      onClick={() => analysePickStock(pick.symbol)}
                      className="ml-auto text-xs font-semibold underline underline-offset-2 transition-colors whitespace-nowrap text-orange-600 hover:text-orange-800"
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4 gap-2">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{result.symbol}</h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Live market data via Finnhub</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900">${result.quote.c?.toFixed(2)}</p>
                  <span className={`inline-block mt-1 text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1 rounded-full ${isPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {isPositive ? "▲" : "▼"} {Math.abs(result.quote.dp).toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                {[
                  { label: "Open",       value: `$${result.quote.o?.toFixed(2)}` },
                  { label: "Prev Close", value: `$${result.quote.pc?.toFixed(2)}` },
                  { label: "Day High",   value: `$${result.quote.h?.toFixed(2)}` },
                  { label: "Day Low",    value: `$${result.quote.l?.toFixed(2)}` },
                  { label: "52W High",   value: result.week52High != null ? `$${result.week52High.toFixed(2)}` : "—", highlight: "emerald" },
                  { label: "52W Low",    value: result.week52Low  != null ? `$${result.week52Low.toFixed(2)}`  : "—", highlight: "red" },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className={`text-sm sm:text-base font-bold mt-0.5 ${
                      highlight === "emerald" ? "text-emerald-600"
                      : highlight === "red" ? "text-red-500"
                      : "text-slate-800"
                    }`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            {isStructured && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4 sm:space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">AI Analysis</h2>
                  {analysis.sentiment && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sentimentColor(analysis.sentiment)}`}>
                      {analysis.sentiment}
                    </span>
                  )}
                </div>
                {analysis.summary && (
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">{analysis.summary}</p>
                )}
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  {analysis.opportunities && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 sm:p-4">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Opportunities</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysis.opportunities}</p>
                    </div>
                  )}
                  {analysis.risks && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
                      <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Risks</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{analysis.risks}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 sm:mb-3">Scenario Outlook</p>
                  <div className="grid sm:grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { label: "4-Week", value: analysis.four_week_outlook },
                      { label: "8-Week", value: analysis.eight_week_outlook },
                      { label: "12-Week", value: analysis.twelve_week_outlook },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
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
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4">Latest News</h2>
                <div className="space-y-3 sm:space-y-4">
                  {result.news.map((item: any, i: number) => (
                    <div key={i} className="border-b border-slate-100 last:border-0 pb-3 sm:pb-4 last:pb-0">
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

      </main>

      {/* Floating chat button */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-50"
        title="Ask AI Agent"
      >
        {chatOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
          </svg>
        )}
      </button>

      {/* Chat panel — full width on mobile, fixed width on sm+ */}
      {chatOpen && (
        <div className="fixed bottom-20 sm:bottom-24 inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-40 overflow-hidden" style={{ maxHeight: "70vh" }}>
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-400 flex items-center justify-center text-xs font-bold shrink-0">AI</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Stocky AI</p>
              <p className="text-indigo-200 text-xs truncate">
                {result ? `Context: ${result.symbol} loaded` : "Stocks & markets only"}
              </p>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="shrink-0 w-7 h-7 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}>
                  {m.content}
                </div>
                {m.role === "assistant" && (
                  <button
                    onClick={() => copyMessage(m.content, i)}
                    className="mt-1 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors px-1"
                    title="Copy response"
                  >
                    {copiedIdx === i ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2 text-slate-500 text-sm">Thinking…</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-200 p-3 flex gap-2">
            <input
              className="flex-1 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ask about any stock or market…"
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
