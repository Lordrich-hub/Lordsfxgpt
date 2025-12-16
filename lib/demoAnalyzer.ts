import { AnalysisResponse, ChartState } from "./types";

/**
 * Demo analyzer: generates realistic synthetic analysis without external API.
 * Useful for testing and when no API key is available.
 */

const demoChartStates: ChartState[] = [
  {
    pair: "GBP/JPY",
    timeframe: "1H",
    price_region: "155.70-155.80",
    trend_hint: "bullish",
    swings: [
      { type: "SwingLow", label: "S1", zone: "155.40" },
      { type: "SwingHigh", label: "H1", zone: "155.95" },
      { type: "SwingLow", label: "S2", zone: "155.60" },
      { type: "SwingHigh", label: "H2", zone: "156.10" },
    ],
    breaks: [{ type: "bos", confirmed: true, description: "Break above H1 at 155.95" }],
    range: { hasRange: false, topZone: "156.10", bottomZone: "155.40" },
    chop_detected: false,
    retest_present: true,
    notes: "Clear uptrend with higher highs and higher lows",
  },
  {
    pair: "EUR/USD",
    timeframe: "4H",
    price_region: "1.0850",
    trend_hint: "range",
    swings: [
      { type: "SwingHigh", label: "R_Top", zone: "1.0920" },
      { type: "SwingLow", label: "R_Bot", zone: "1.0780" },
    ],
    breaks: [{ type: "none", confirmed: false, description: "No clear break yet" }],
    range: {
      hasRange: true,
      topZone: "1.0920",
      bottomZone: "1.0780",
      falseBreaks: true,
    },
    chop_detected: true,
    retest_present: false,
    notes: "Ranging within clear bounds, multiple false breaks",
  },
  {
    pair: "BTC/USD",
    timeframe: "D",
    price_region: "42500-43000",
    trend_hint: "bearish",
    swings: [
      { type: "SwingHigh", label: "HH1", zone: "43500" },
      { type: "SwingLow", label: "LL1", zone: "41000" },
      { type: "SwingHigh", label: "LH1", zone: "42800" },
      { type: "SwingLow", label: "LL2", zone: "40500" },
    ],
    breaks: [
      { type: "shift", confirmed: true, description: "Shift to lower lows" },
    ],
    range: { hasRange: false },
    chop_detected: false,
    retest_present: true,
    notes: "Lower highs and lower lows define downtrend; retest of broken high",
  },
];

export const generateDemoAnalysis = (): AnalysisResponse => {
  // Pick random demo state
  const chartState = demoChartStates[Math.floor(Math.random() * demoChartStates.length)];

  const bias =
    chartState.trend_hint === "bullish"
      ? "Bullish"
      : chartState.trend_hint === "bearish"
        ? "Bearish"
        : "Range";

  const structure = {
    trend_definition:
      chartState.trend_hint === "bullish"
        ? `Uptrend with higher lows, price near ${chartState.price_region}`
        : chartState.trend_hint === "bearish"
          ? `Downtrend with lower highs, price near ${chartState.price_region}`
          : `Range-bound between ${chartState.range.bottomZone} and ${chartState.range.topZone}`,
    recent_swings: chartState.swings,
    breaks: chartState.breaks.map((b) => ({
      type: b.type === "bos" ? "BoS" as const : b.type === "shift" ? "Shift" as const : ("None" as const),
      description: b.description || "No clear break",
    })),
    range: {
      is_range: chartState.range.hasRange,
      top_zone: chartState.range.topZone || "unknown",
      bottom_zone: chartState.range.bottomZone || "unknown",
    },
  };

  const key_levels = [
    ...chartState.swings
      .filter((s) => s.type === "SwingHigh")
      .map((s) => ({
        name: `${s.label} - Resistance`,
        zone: s.zone,
        why_it_matters: "Recent swing high; potential resistance and short invalidation",
      })),
    ...chartState.swings
      .filter((s) => s.type === "SwingLow")
      .map((s) => ({
        name: `${s.label} - Support`,
        zone: s.zone,
        why_it_matters: "Recent swing low; potential support and long invalidation",
      })),
  ];

  let confidence_score = 50;
  const reasons: string[] = [];

  if (
    (chartState.trend_hint === "bullish" || chartState.trend_hint === "bearish") &&
    !chartState.chop_detected
  ) {
    confidence_score += 10;
    reasons.push("Clean directional swings");
  }

  if (chartState.breaks.some((b) => b.confirmed && b.type !== "none")) {
    confidence_score += 10;
    reasons.push("Recent break confirmed");
  }

  if (chartState.retest_present) {
    confidence_score += 10;
    reasons.push("Retest visible");
  }

  if (chartState.chop_detected) {
    confidence_score -= 15;
    reasons.push("Choppy price action");
  }

  if (chartState.range.hasRange && chartState.range.falseBreaks) {
    confidence_score -= 10;
    reasons.push("Range with false breaks");
  }

  confidence_score = Math.max(0, Math.min(100, confidence_score));

  const sniper_plan =
    bias === "Range" && !chartState.breaks.some((b) => b.confirmed)
      ? {
          type: "NoTrade" as const,
          wait_for: ["Wait for a clean break and close beyond the range boundary", "Look for retest to confirm"],
          trigger: ["Do not trade choppy range"],
          invalidation: ["Any pullback into the range"],
          targets: [structure.range.top_zone, structure.range.bottom_zone],
        }
      : bias === "Bullish"
        ? {
            type: "Continuation" as const,
            wait_for: ["Pullback holding above recent swing low", "Retest of prior resistance"],
            trigger: ["Bullish candle rejection at support", "Break of minor high after pullback"],
            invalidation: [structure.recent_swings.filter((s) => s.type === "SwingLow").at(-1)?.zone || "Recent low"],
            targets: [structure.recent_swings.filter((s) => s.type === "SwingHigh").at(-1)?.zone || "Next high zone"],
          }
        : bias === "Bearish"
          ? {
              type: "Continuation" as const,
              wait_for: ["Pullback holding below recent swing high", "Retest of prior support as resistance"],
              trigger: ["Bearish candle rejection at resistance", "Break of minor low after pullback"],
              invalidation: [structure.recent_swings.filter((s) => s.type === "SwingHigh").at(-1)?.zone || "Recent high"],
              targets: [structure.recent_swings.filter((s) => s.type === "SwingLow").at(-1)?.zone || "Next low zone"],
            }
          : {
              type: "Reversal" as const,
              wait_for: ["Clear break in new direction", "Retest holding the break"],
              trigger: ["Rejection at retest", "Minor structure break"],
              invalidation: ["Close back inside prior structure"],
              targets: ["Next swing zone"],
            };

  const risk_notes: string[] = [];
  if (chartState.chop_detected) risk_notes.push("Choppy structure detected; trade selectivity required.");
  if (chartState.range.hasRange && !chartState.breaks.some((b) => b.confirmed))
    risk_notes.push("Range conditions; wait for boundary break.");
  if (!chartState.swings.length) risk_notes.push("Few swings visible; clarity may improve on longer timeframe.");
  if (!risk_notes.length) risk_notes.push("Respect invalidation and position sizing.");

  return {
    meta: {
      pair: chartState.pair || "unknown",
      timeframe: chartState.timeframe || "unknown",
      source: "Demo Mode (no API call)",
      notes: chartState.notes || "Synthetic demo analysis",
    },
    bias: {
      state: bias,
      reason: structure.trend_definition,
    },
    structure,
    key_levels,
    sniper_plan,
    risk_notes,
    confidence: {
      score: confidence_score,
      explanation: reasons.join("; ") || "Baseline confidence",
    },
  };
};
