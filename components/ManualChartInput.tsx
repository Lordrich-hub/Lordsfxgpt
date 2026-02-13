"use client";

import { useState } from "react";
import { ChartState } from "@/lib/types";

interface Props {
  onSubmit: (state: ChartState) => void;
  isLoading: boolean;
}

export function ManualChartInput({ onSubmit, isLoading }: Props) {
  const [pair, setPair] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState("4H");
  const [priceRegion, setPriceRegion] = useState("1.0850");
  const [trendHint, setTrendHint] = useState<"bullish" | "bearish" | "range" | "transition">("bullish");
  const [swingData, setSwingData] = useState("S1 155.40\nH1 155.95\nS2 155.60\nH2 156.10");
  const [breakType, setBreakType] = useState<"bos" | "shift" | "none">("bos");
  const [breakConfirmed, setBreakConfirmed] = useState(true);
  const [rangeTop, setRangeTop] = useState("156.10");
  const [rangeBot, setRangeBot] = useState("155.40");
  const [chopDetected, setChopDetected] = useState(false);
  const [retestPresent, setRetestPresent] = useState(true);
  const [notes, setNotes] = useState("Clear structure with confirmed break");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse swings from text (format: "Label Price")
    const swings = swingData
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const label = parts[0];
        const zone = parts.slice(1).join(" ");
        const type = label.includes("H") || label.toLowerCase().includes("high") ? "SwingHigh" : "SwingLow";

        const priceMatch = zone.match(/-?\d+(?:\.\d+)?/);
        const price = priceMatch ? Number(priceMatch[0]) : undefined;

        return {
          type: type as "SwingHigh" | "SwingLow",
          label,
          zone,
          price: Number.isFinite(price) ? price : undefined,
        };
      });

    const chartState: ChartState = {
      pair: pair || "unknown",
      timeframe: timeframe || "unknown",
      price_region: priceRegion || "unknown",
      trend_hint: trendHint,
      swings,
      breaks: [{ type: breakType, confirmed: breakConfirmed, description: `${breakType.toUpperCase()} ${breakConfirmed ? "confirmed" : "unconfirmed"}` }],
      range: {
        hasRange: trendHint === "range",
        topZone: rangeTop,
        bottomZone: rangeBot,
        falseBreaks: trendHint === "range" && !breakConfirmed,
      },
      chop_detected: chopDetected,
      retest_present: retestPresent,
      notes,
    };

    onSubmit(chartState);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-panel/60 p-6 space-y-4">
      <h3 className="font-semibold text-lg">Manual Chart Input</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Pair</label>
          <input
            type="text"
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white placeholder-muted focus:border-accent outline-none"
            placeholder="e.g., EURUSD"
          />
        </div>

        <div>
          <label htmlFor="timeframe" className="block text-sm font-medium text-muted mb-1">Timeframe</label>
          <select
            id="timeframe"
            title="Timeframe"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white focus:border-accent outline-none"
          >
            <option>1M</option>
            <option>5M</option>
            <option>15M</option>
            <option>1H</option>
            <option>4H</option>
            <option>D</option>
            <option>W</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Current Price Region</label>
          <input
            type="text"
            value={priceRegion}
            onChange={(e) => setPriceRegion(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white placeholder-muted focus:border-accent outline-none"
            placeholder="e.g., 1.0850"
          />
        </div>

        <div>
          <label htmlFor="marketBias" className="block text-sm font-medium text-muted mb-1">Market Bias</label>
          <select
            id="marketBias"
            title="Market Bias"
            value={trendHint}
            onChange={(e) => setTrendHint(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white focus:border-accent outline-none"
          >
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="range">Range</option>
            <option value="transition">Transition</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-1">Recent Swings (Label Zone, one per line)</label>
        <textarea
          value={swingData}
          onChange={(e) => setSwingData(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white placeholder-muted focus:border-accent outline-none font-mono text-xs"
          rows={4}
          placeholder="S1 155.40&#10;H1 155.95&#10;S2 155.60"
        />
        <p className="text-xs text-muted mt-1">Use "H" or "High" for highs, anything else is a low</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="recentBreakType" className="block text-sm font-medium text-muted mb-1">Recent Break Type</label>
          <select
            id="recentBreakType"
            title="Recent Break Type"
            value={breakType}
            onChange={(e) => setBreakType(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white focus:border-accent outline-none"
          >
            <option value="none">None</option>
            <option value="bos">Break of Structure (BoS)</option>
            <option value="shift">Shift in Structure</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Range Top</label>
          <input
            type="text"
            value={rangeTop}
            onChange={(e) => setRangeTop(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white placeholder-muted focus:border-accent outline-none"
            placeholder="e.g., 156.10"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted mb-1">Range Bottom</label>
          <input
            type="text"
            value={rangeBot}
            onChange={(e) => setRangeBot(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white placeholder-muted focus:border-accent outline-none"
            placeholder="e.g., 155.40"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={breakConfirmed}
            onChange={(e) => setBreakConfirmed(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-sm text-muted">Break Confirmed?</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={chopDetected}
            onChange={(e) => setChopDetected(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-sm text-muted">Chop Detected?</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={retestPresent}
            onChange={(e) => setRetestPresent(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-sm text-muted">Retest Visible?</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-panel text-white placeholder-muted focus:border-accent outline-none"
          placeholder="Optional notes about the structure"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-slate-900 shadow-glow transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
      >
        {isLoading ? "Analyzing..." : "Analyze Structure"}
      </button>
    </form>
  );
}
