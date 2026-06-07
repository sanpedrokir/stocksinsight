"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [symbol, setSymbol] = useState("NVDA");
  const [result, setResult] = useState<any>(null);
  const [forecastHistory, setForecastHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForecasts() {
      try {
        const res = await fetch("/api/forecasts");
        const data = await res.json();
        setForecastHistory(data.forecasts ?? []);
      } catch (fetchError) {
        console.error("Failed to load forecast history", fetchError);
      }
    }

    loadForecasts();
  }, []);

  async function analyseStock() {
    if (!symbol.trim()) {
      setError("Please enter a valid stock symbol.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch(`/api/analyse?symbol=${symbol}`);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to analyse the stock.");
      setLoading(false);
      return;
    }

    setResult(data);
    setLoading(false);
  }

  const analysis = result?.analysis;
  const isStructured = analysis && typeof analysis === "object";

  return (
    <main className="min-h-screen bg-gray-100 p-10">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-3xl font-bold mb-2">InsightStock AI</h1>
        <p className="text-gray-600 mb-6">
          AI stock research assistant with latest price, news, and scenario outlook.
        </p>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <input
            className="border p-3 rounded w-full"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol e.g. NVDA"
          />

          <button
            onClick={analyseStock}
            className="bg-black text-white px-6 py-3 rounded disabled:opacity-50"
            disabled={loading}
          >
            Analyse
          </button>
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}
        {loading && <p className="text-gray-700 mb-4">Analysing...</p>}

        {result?.quote && (
          <div className="space-y-6">
            <section className="border rounded p-5">
              <h2 className="text-2xl font-semibold mb-4">{result.symbol}</h2>
              <p>Current Price: ${result.quote.c}</p>
              <p>Change: {result.quote.d}</p>
              <p>Percent Change: {result.quote.dp}%</p>
              <p>High: ${result.quote.h}</p>
              <p>Low: ${result.quote.l}</p>
              <p>Open: ${result.quote.o}</p>
              <p>Previous Close: ${result.quote.pc}</p>
            </section>

            <section className="border rounded p-5">
              <h2 className="text-xl font-semibold mb-4">Latest News</h2>

              {result.news.map((item: any, index: number) => (
                <div key={index} className="mb-4 border-b pb-3">
                  <p className="font-semibold">{item.headline}</p>
                  <p className="text-sm text-gray-600">{item.source}</p>
                  <p>{item.summary}</p>
                </div>
              ))}
            </section>

            <section className="border rounded p-5">
              <h2 className="text-xl font-semibold mb-4">AI Analysis</h2>
              {isStructured ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold">Overall summary</p>
                    <p>{analysis.summary}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Sentiment</p>
                    <p>{analysis.sentiment}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Key opportunities</p>
                    <p>{analysis.opportunities}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Key risks</p>
                    <p>{analysis.risks}</p>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="rounded border p-4 bg-slate-50">
                      <p className="font-semibold mb-2">4-week outlook</p>
                      <p>{analysis.four_week_outlook}</p>
                    </div>
                    <div className="rounded border p-4 bg-slate-50">
                      <p className="font-semibold mb-2">8-week outlook</p>
                      <p>{analysis.eight_week_outlook}</p>
                    </div>
                    <div className="rounded border p-4 bg-slate-50">
                      <p className="font-semibold mb-2">12-week outlook</p>
                      <p>{analysis.twelve_week_outlook}</p>
                    </div>
                  </div>
                  {analysis.raw_text && (
                    <div>
                      <p className="font-semibold">Raw AI output</p>
                      <pre className="whitespace-pre-wrap font-sans text-sm bg-slate-100 p-4 rounded">
                        {analysis.raw_text}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm bg-slate-100 p-4 rounded">
                  {result.analysis}
                </pre>
              )}
            </section>
          </div>
        )}

        <section className="border rounded p-5 mt-6">
          <h2 className="text-xl font-semibold mb-4">Recent forecast history</h2>
          {forecastHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No forecast history is available yet.</p>
          ) : (
            <div className="space-y-3">
              {forecastHistory.slice(0, 5).map((forecast: any, index: number) => (
                <div key={index} className="rounded border bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold">{forecast.symbol}</span>
                    <span>{forecast.current_price ? `$${forecast.current_price}` : "No price"}</span>
                  </div>
                  {forecast.created_at && (
                    <p className="text-xs text-gray-500">{new Date(forecast.created_at).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}