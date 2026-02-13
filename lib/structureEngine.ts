import { AnalysisResponse, BiasState, ChartBreak, ChartState, ChartSwing, KeyLevel, PlanType, Structure, EntrySignal, SwingType, SignalQuality, PatternType } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseZoneBounds = (zone: string | undefined): { low: number; high: number } | null => {
  if (!zone) return null;
  const nums = zone
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)
    ?.map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  if (!nums || nums.length === 0) return null;
  if (nums.length === 1) return { low: nums[0], high: nums[0] };
  const low = Math.min(nums[0], nums[1]);
  const high = Math.max(nums[0], nums[1]);
  return { low, high };
};

const ensureStrictOrdering = (direction: "LONG" | "SHORT", entry: number, sl: number, tp1: number, tp2: number, tick: number) => {
  if (direction === "LONG") {
    const fixedSl = sl >= entry ? roundToTickDown(entry - tick, tick) : sl;
    const fixedTp1 = tp1 <= entry ? roundToTickUp(entry + tick, tick) : tp1;
    const fixedTp2 = tp2 <= fixedTp1 ? roundToTickUp(fixedTp1 + tick, tick) : tp2;
    return { sl: fixedSl, tp1: fixedTp1, tp2: fixedTp2 };
  }

  const fixedSl = sl <= entry ? roundToTickUp(entry + tick, tick) : sl;
  const fixedTp1 = tp1 >= entry ? roundToTickDown(entry - tick, tick) : tp1;
  const fixedTp2 = tp2 >= fixedTp1 ? roundToTickDown(fixedTp1 - tick, tick) : tp2;
  return { sl: fixedSl, tp1: fixedTp1, tp2: fixedTp2 };
};

const formatExecutionPlan = (params: {
  direction: "LONG" | "SHORT";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tickSize: number;
  entryMode: "MARKET" | "LIMIT" | "STOP";
  entryReference?: string;
}) => {
  const { direction, entry, sl, tp1, tp2, tickSize, entryMode, entryReference } = params;
  const riskPerUnit = direction === "LONG" ? entry - sl : sl - entry;
  const rewardToTp1 = direction === "LONG" ? tp1 - entry : entry - tp1;
  const rr1 = riskPerUnit > 0 ? rewardToTp1 / riskPerUnit : 0;
  const oneRMove = direction === "LONG" ? entry + riskPerUnit : entry - riskPerUnit;
  const beTrigger = roundToTick(direction === "LONG" ? oneRMove : oneRMove, tickSize);
  const ref = entryReference ? `@ ${entryReference}` : undefined;

  return [
    `MODE ${entryMode}`,
    ref,
    `MGMT +1R→protect (${beTrigger})`,
    "TP1→partial",
    "TP2→trail",
    "RULE no-add/no-chase",
    rr1 >= 1.5 ? "RR OK" : "RR borderline",
  ]
    .filter(Boolean)
    .join(" | ");
};

const formatVipRationale = (params: {
  direction: "LONG" | "SHORT";
  quality: SignalQuality;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  rr: string;
  confluence: number;
  plan: string;
  anchorLabel: string;
}) => {
  const { direction, quality, entry, sl, tp1, tp2, rr, confluence, plan, anchorLabel } = params;
  return `${direction} ${quality} | Entry ${entry} | SL ${sl} (${anchorLabel}) | TP1 ${tp1} | TP2 ${tp2} | RR ${rr} | Conf ${confluence}/100 | ${plan}`;
};

const inferTickSize = (state: ChartState, referencePrice?: number): number => {
  const pair = (state.pair || "").toUpperCase();
  if (pair.includes("JPY")) return 0.01;

  const text = state.price_region || "";
  const match = text.match(/\d+(?:\.(\d+))?/);
  const decimalsFromRegion = match?.[1]?.length;
  if (typeof decimalsFromRegion === "number") {
    const dec = clamp(decimalsFromRegion, 0, 8);
    return Math.pow(10, -dec);
  }

  const ref = referencePrice ?? state.current_price;
  if (typeof ref === "number") {
    // Conservative fallback:
    // - FX-like quotes (<10) typically use 4-5 decimals; use 4.
    // - Higher-priced instruments commonly use 2 decimals.
    return ref < 10 ? 0.0001 : 0.01;
  }

  return 0.0001;
};

const roundToTick = (price: number, tickSize: number): number => {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return price;
  const scaled = price / tickSize;
  const rounded = Math.round(scaled) * tickSize;
  // Normalize to a stable decimal representation.
  const decimals = tickSize >= 1 ? 0 : clamp(Math.round(Math.log10(1 / tickSize)), 0, 8);
  return Number(rounded.toFixed(decimals));
};

const roundToTickUp = (price: number, tickSize: number): number => {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return price;
  const scaled = price / tickSize;
  const rounded = Math.ceil(scaled) * tickSize;
  const decimals = tickSize >= 1 ? 0 : clamp(Math.round(Math.log10(1 / tickSize)), 0, 8);
  return Number(rounded.toFixed(decimals));
};

const roundToTickDown = (price: number, tickSize: number): number => {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return price;
  const scaled = price / tickSize;
  const rounded = Math.floor(scaled) * tickSize;
  const decimals = tickSize >= 1 ? 0 : clamp(Math.round(Math.log10(1 / tickSize)), 0, 8);
  return Number(rounded.toFixed(decimals));
};

const inferPsychStep = (state: ChartState, price: number, tickSize: number): number => {
  const pair = (state.pair || "").toUpperCase();
  const fxHints = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"];
  const looksFx = pair.length === 6 || fxHints.some((c) => pair.includes(c)) || price < 20;

  if (looksFx) {
    if (pair.includes("JPY") || price >= 20) return 0.5;
    return Math.max(0.005, tickSize * 50);
  }

  if (price >= 1000) return 100;
  if (price >= 200) return 50;
  if (price >= 20) return 10;
  return 5;
};

const nextPsychLevel = (direction: "LONG" | "SHORT", price: number, step: number, tickSize: number): number | null => {
  if (!Number.isFinite(price) || !Number.isFinite(step) || step <= 0) return null;
  if (direction === "LONG") {
    let level = Math.ceil(price / step) * step;
    if (level <= price + tickSize * 0.5) level += step;
    return roundToTick(level, tickSize);
  }

  let level = Math.floor(price / step) * step;
  if (level >= price - tickSize * 0.5) level -= step;
  return roundToTick(level, tickSize);
};

const selectTargets = (
  direction: "LONG" | "SHORT",
  entry: number,
  swingTargets: number[],
  psychStep: number,
  tickSize: number
): { tp1: number; tp2: number } | null => {
  const psych1 = nextPsychLevel(direction, entry, psychStep, tickSize);
  const candidates = [...swingTargets];
  if (psych1 !== null) candidates.push(psych1);

  const filtered = candidates.filter((t) => (direction === "LONG" ? t > entry : t < entry));
  if (!filtered.length) return null;

  const unique = Array.from(new Set(filtered.map((v) => roundToTick(v, tickSize))));
  const byDistance = unique.slice().sort((a, b) => Math.abs(a - entry) - Math.abs(b - entry));
  const tp1 = byDistance[0];

  const remaining: number[] = [];
  swingTargets.forEach((t) => {
    if (direction === "LONG" ? t > tp1 : t < tp1) remaining.push(t);
  });
  const psych2 = psych1 !== null ? nextPsychLevel(direction, psych1, psychStep, tickSize) : null;
  if (psych1 !== null && (direction === "LONG" ? psych1 > tp1 : psych1 < tp1)) remaining.push(psych1);
  if (psych2 !== null && (direction === "LONG" ? psych2 > tp1 : psych2 < tp1)) remaining.push(psych2);

  if (!remaining.length) return null;
  const tp2 = remaining.sort((a, b) => Math.abs(a - tp1) - Math.abs(b - tp1))[0];
  return { tp1, tp2 };
};

const mapBreakType = (brk: ChartBreak) => {
  if (brk.type === "bos") return "BoS" as const;
  if (brk.type === "shift") return "Shift" as const;
  return "None" as const;
};

const describeTrend = (trendHint: ChartState["trend_hint"], swings: ChartSwing[]) => {
  const last = swings.at(-1)?.label ?? "latest leg";
  switch (trendHint) {
    case "bullish":
      return `Uptrend with higher lows, current leg pushing beyond ${last}`;
    case "bearish":
      return `Downtrend with lower highs, current leg extending past ${last}`;
    case "range":
      return `Sideways range, price oscillating between visible bounds`;
    case "transition":
      return `Potential transition after a break in structure around ${last}`;
    default:
      return "Structure unclear from the screenshot";
  }
};

const inferBias = (state: ChartState): BiasState => {
  if (state.chop_detected && state.range.hasRange) return "Range";
  if (state.trend_hint === "bullish") return "Bullish";
  if (state.trend_hint === "bearish") return "Bearish";
  if (state.trend_hint === "range") return "Range";
  if (state.trend_hint === "transition") return "Transition";
  return "Transition";
};

const buildKeyLevels = (swings: ChartSwing[]): KeyLevel[] => {
  const highs = swings.filter((s) => s.type === "SwingHigh");
  const lows = swings.filter((s) => s.type === "SwingLow");
  const latestHigh = highs.at(-1);
  const latestLow = lows.at(-1);

  const levels: KeyLevel[] = [];
  if (latestHigh) {
    levels.push({
      name: latestHigh.label || "Recent swing high",
      zone: latestHigh.zone,
      why_it_matters: "Potential resistance and invalidation for longs",
    });
  }
  if (latestLow) {
    levels.push({
      name: latestLow.label || "Recent swing low",
      zone: latestLow.zone,
      why_it_matters: "Potential support and invalidation for shorts",
    });
  }

  return levels;
};

const computeConfidence = (state: ChartState): { score: number; explanation: string } => {
  let score = 50;
  const reasons: string[] = [];

  const hasCleanTrend = (state.trend_hint === "bullish" || state.trend_hint === "bearish") && !state.chop_detected && state.swings.length >= 3;
  if (hasCleanTrend) {
    score += 10;
    reasons.push("Clean directional swings");
  }

  const recentBreakConfirmed = state.breaks.some((b) => b.confirmed && b.type !== "none");
  if (recentBreakConfirmed) {
    score += 10;
    reasons.push("Recent break confirmed");
  }

  if (state.retest_present) {
    score += 10;
    reasons.push("Retest visible");
  }

  if (state.chop_detected) {
    score -= 15;
    reasons.push("Choppy price action");
  }

  if (state.range.hasRange && state.range.falseBreaks) {
    score -= 10;
    reasons.push("Range with false breaks");
  }

  return { score: clamp(score, 0, 100), explanation: reasons.join("; ") || "Baseline confidence" };
};

/**
 * Deterministic confluence scoring.
 * Note: this is a rules-based score, not a probability estimate.
 */
const calculateConfluenceScore = (
  bias: BiasState,
  state: ChartState,
  lastHigh: ChartSwing | undefined,
  lastLow: ChartSwing | undefined
): number => {
  let score = 0;

  // Factor 1: Clean directional trend (25pts) - INCREASED
  const isTrendClean = !state.chop_detected && (bias === "Bullish" || bias === "Bearish");
  if (isTrendClean) score += 25;
  else if (bias === "Transition") score += 10; // Weak signal

  // Factor 2: Recent break confirmed (30pts) - MOST CRITICAL
  const hasRecentBreak = state.breaks.some((b) => b.confirmed && b.type !== "none");
  const hasStructuralBreak = state.breaks.some((b) => b.confirmed && (b.type === "bos" || b.type === "shift"));
  if (hasStructuralBreak && state.retest_present) score += 30; // PERFECT setup
  else if (hasStructuralBreak) score += 20; // Good
  else if (hasRecentBreak) score += 10; // Weak

  // Factor 3: Retest visible (20pts) - confirmation of break
  if (state.retest_present && hasStructuralBreak) score += 20;
  else if (state.retest_present) score += 10; // Partial credit

  // Factor 4: Price at structure (15pts) - valid entry zone
  if (lastLow?.price && lastHigh?.price && state.current_price) {
    const atSupport = bias === "Bullish" && Math.abs(state.current_price - lastLow.price) / lastLow.price < 0.01;
    const atResistance = bias === "Bearish" && Math.abs(state.current_price - lastHigh.price) / lastHigh.price < 0.01;
    if (atSupport || atResistance) score += 15;
  }

  // Factor 5: Volatility optimal (10pts)
  const recentPrices = state.swings
    .map((s) => s.price)
    .filter((p): p is number => typeof p === "number")
    .slice(-4);
  if (recentPrices.length >= 2) {
    const avgSwing = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const volatility = Math.max(...recentPrices) - Math.min(...recentPrices);
    const volRatio = volatility / avgSwing;
    if (volRatio > 0.005 && volRatio < 0.03) score += 10;
  }

  // STRICT PENALTIES - PROP FIRM PROTECTION
  if (state.chop_detected) score -= 30; // HEAVY penalty
  if (bias === "Range" && !hasStructuralBreak) score -= 25; // No range trades
  if (state.range.falseBreaks) score -= 15; // Penalize fake breaks

  return Math.max(0, Math.min(100, score));
};

/**
 * Determine pattern type for better trade classification
 * Helps traders understand the setup they're trading
 */
const identifyPatternType = (
  bias: BiasState,
  state: ChartState,
  lastHigh: ChartSwing | undefined,
  lastLow: ChartSwing | undefined
): PatternType => {
  if (bias === "Range") return "NONE";
  if (bias === "Transition") return "REVERSAL";

  const hasRecentBreak = state.breaks.some((b) => b.confirmed && b.type !== "none");
  if (hasRecentBreak && state.retest_present) return "BREAKOUT";
  if (state.retest_present) return "PULLBACK";
  if (state.breaks.some((b) => b.type === "shift")) return "CONTINUATION";

  return "REVERSAL";
};

const buildSniperPlan = (bias: BiasState, state: ChartState, structure: Structure, higherTimeframe?: ChartState): { planType: PlanType; wait_for: string[]; trigger: string[]; invalidation: string[]; targets: string[]; entry_signal?: EntrySignal } => {
  const lastHigh = structure.recent_swings.filter((s) => s.type === "SwingHigh").at(-1);
  const lastLow = structure.recent_swings.filter((s) => s.type === "SwingLow").at(-1);

  const baseInvalidation = bias === "Bullish" ? (lastLow?.zone ? [lastLow.zone] : []) : bias === "Bearish" ? (lastHigh?.zone ? [lastHigh.zone] : []) : [];
  const targetCandidates = bias === "Bullish" ? (lastHigh?.zone ? [lastHigh.zone] : []) : bias === "Bearish" ? (lastLow?.zone ? [lastLow.zone] : []) : [];

  // Calculate entry signal with precise prices
  const entrySignal = calculateEntrySignal(bias, state, lastHigh, lastLow, higherTimeframe);

  // No-trade when ranging and no confirmed break
  const hasConfirmedBreak = state.breaks.some((b) => b.confirmed && b.type !== "none");
  if ((bias === "Range" || state.chop_detected) && !hasConfirmedBreak) {
    return {
      planType: "NoTrade",
      wait_for: ["Wait for a clean break and close beyond the range boundary", "Look for a retest to hold"],
      trigger: ["Do not trade until break confirms"],
      invalidation: ["Any fake-out back into the range"] ,
      targets: [structure.range.top_zone, structure.range.bottom_zone].filter(Boolean),
      entry_signal: entrySignal,
    };
  }

  if (bias === "Bullish") {
    return {
      planType: state.range.hasRange ? "RangePlay" : "Continuation",
      wait_for: ["Price compressing below last swing high", "Breakout candle closing above the swing high"],
      trigger: ["Buy stop above last swing high", "Breakout with follow-through"],
      invalidation: baseInvalidation.length ? baseInvalidation : ["Stop below prior swing low"],
      targets: targetCandidates.length ? targetCandidates : ["Next swing high or psych level"],
      entry_signal: entrySignal,
    };
  }

  if (bias === "Bearish") {
    return {
      planType: state.range.hasRange ? "RangePlay" : "Continuation",
      wait_for: ["Price compressing above last swing low", "Breakout candle closing below the swing low"],
      trigger: ["Sell stop below last swing low", "Breakout with follow-through"],
      invalidation: baseInvalidation.length ? baseInvalidation : ["Stop above prior swing high"],
      targets: targetCandidates.length ? targetCandidates : ["Next swing low or psych level"],
      entry_signal: entrySignal,
    };
  }

  // Transition cases -> look for reversal setups
  return {
    planType: "Reversal",
    wait_for: ["Clear break in opposite direction", "Retest holding the break"],
    trigger: ["Rejection at retest", "Minor structure break on lower timeframe"],
    invalidation: baseInvalidation.length ? baseInvalidation : ["Close back inside prior structure"],
    targets: targetCandidates.length ? targetCandidates : ["Opposing swing zone"],
    entry_signal: entrySignal,
  };
};

/**
 * ENHANCED entry signal with STRICT PROP FIRM requirements
 * - Minimum 75% confluence (increased from 65%)
 * - Minimum 1:1.5 R:R ratio (extend TP to higher timeframe if needed)
 * - Structure-based dynamic SL/TP
 * - Position sizing for risk management
 */
const calculateEntrySignal = (
  bias: BiasState,
  state: ChartState,
  lastHigh: { type: SwingType; label: string; zone: string; price?: number } | undefined,
  lastLow: { type: SwingType; label: string; zone: string; price?: number } | undefined,
  higherTimeframe?: ChartState
): EntrySignal | undefined => {
  const confluence = calculateConfluenceScore(bias, state, lastHigh, lastLow);
  const patternType = "BREAKOUT" as const;
  const minConfluence = 75;

  // Skip if below minimum confluence threshold
  if (confluence < minConfluence) {
    return {
      direction: "WAIT",
      entry_price: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      risk_reward_ratio: "N/A",
      rationale: `Below threshold. Confluence ${confluence}/100 (minimum ${minConfluence}). Wait for a confirmed structure break and a clean retest.`,
      confluence_score: confluence,
      signal_quality: "INVALID",
      pattern_type: patternType,
      prop_firm_compliant: false,
    };
  }

  // Additional guard: breakouts only in directional conditions
  if (bias === "Range" || bias === "Transition") {
    return {
      direction: "WAIT",
      entry_price: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      risk_reward_ratio: "N/A",
      rationale: "Non-directional structure. Breakout signals require a clear bullish or bearish bias.",
      confluence_score: confluence,
      signal_quality: "INVALID",
      pattern_type: patternType,
      prop_firm_compliant: false,
    };
  }

  const recentPrices = state.swings
    .map((s) => s.price)
    .filter((p): p is number => typeof p === "number")
    .slice(-4);

  const refPrice = state.current_price || recentPrices.at(-1) || lastLow?.price || lastHigh?.price;
  if (!refPrice) {
    return {
      direction: "WAIT",
      entry_price: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      risk_reward_ratio: "N/A",
      rationale: "Cannot determine prices from chart. Please ensure price scale is visible.",
      confluence_score: confluence,
      signal_quality: "INVALID",
      pattern_type: patternType,
      prop_firm_compliant: false,
    };
  }

  const tickSize = inferTickSize(state, refPrice);

  const lastHighZone = parseZoneBounds(lastHigh?.zone);
  const lastLowZone = parseZoneBounds(lastLow?.zone);

  const recentSwingPrices = state.swings
    .map((s) => s.price)
    .filter((p): p is number => typeof p === "number")
    .slice(-6);
  const volatilityProxy = recentSwingPrices.length >= 2 ? Math.max(...recentSwingPrices) - Math.min(...recentSwingPrices) : 0;
  const baseBufferTicks = clamp(Math.round((volatilityProxy / Math.max(tickSize, 1e-12)) * 0.02), 2, 20);
  const buffer = tickSize * baseBufferTicks;

  const pricedHighs = state.swings
    .filter((s) => s.type === "SwingHigh" && typeof s.price === "number" && Number.isFinite(s.price))
    .map((s) => ({ ...s, price: s.price as number }));
  const pricedLows = state.swings
    .filter((s) => s.type === "SwingLow" && typeof s.price === "number" && Number.isFinite(s.price))
    .map((s) => ({ ...s, price: s.price as number }));

  const psychStep = inferPsychStep(state, refPrice, tickSize);

  const higherTfHighs = higherTimeframe?.swings
    .filter((s) => s.type === "SwingHigh" && typeof s.price === "number" && Number.isFinite(s.price))
    .map((s) => s.price as number)
    .sort((a, b) => a - b) ?? [];

  const higherTfLows = higherTimeframe?.swings
    .filter((s) => s.type === "SwingLow" && typeof s.price === "number" && Number.isFinite(s.price))
    .map((s) => s.price as number)
    .sort((a, b) => a - b) ?? [];

  if (bias === "Bullish") {
    const entryAnchor = lastHigh?.price ?? lastHighZone?.high;
    const slAnchor = lastLow?.price ?? lastLowZone?.low;
    if (!Number.isFinite(entryAnchor as number) || !Number.isFinite(slAnchor as number)) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: "Bullish bias detected but breakout requires a clear swing high and prior swing low.",
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        prop_firm_compliant: false,
      };
    }

    const entryPrice = roundToTickUp((entryAnchor as number) + buffer, tickSize);
    const stopLoss = roundToTickDown((slAnchor as number) - buffer, tickSize);
    const swingTargets = pricedHighs
      .map((h) => h.price)
      .filter((p) => p > entryPrice)
      .sort((a, b) => a - b);
    const targets = selectTargets("LONG", entryPrice, swingTargets, psychStep, tickSize);

    if (!targets) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: "No valid breakout targets above the swing high. Need a higher swing or nearby psych level.",
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        prop_firm_compliant: false,
      };
    }

    const ordered = ensureStrictOrdering("LONG", entryPrice, stopLoss, targets.tp1, targets.tp2, tickSize);
    const risk = entryPrice - ordered.sl;
    const reward = ordered.tp1 - entryPrice;
    const rrRatio = reward / Math.max(risk, tickSize);

    let finalTp2 = ordered.tp2;
    let rrFinal = rrRatio;
    let extensionNote: string | undefined;

    if (rrRatio < 1.5) {
      const higherTarget = higherTfHighs.find((p) => p > ordered.tp1 && p > entryPrice);
      if (Number.isFinite(higherTarget)) {
        finalTp2 = roundToTick(higherTarget as number, tickSize);
        rrFinal = (finalTp2 - entryPrice) / Math.max(risk, tickSize);
        extensionNote = "TP extended to higher timeframe swing for better R:R.";
      }
    }

    if (rrFinal < 1.5) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: `POOR R:R. Current ratio 1:${rrFinal.toFixed(1)} (need minimum 1:1.5). Wait for wider breakout targets or higher timeframe extension.`,
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        prop_firm_compliant: false,
      };
    }

    const qualityScore = confluence >= 85 ? "STRONG" : confluence >= 75 ? "MEDIUM" : "WEAK" as SignalQuality;
    const executionPlan = formatExecutionPlan({
      direction: "LONG",
      entry: entryPrice,
      sl: ordered.sl,
      tp1: ordered.tp1,
      tp2: ordered.tp2,
      tickSize,
      entryMode: "STOP",
      entryReference: `Buy stop above ${lastHigh?.label || "swing high"}`,
    });

    return {
      direction: "LONG",
      entry_price: entryPrice,
      stop_loss: ordered.sl,
      take_profit_1: ordered.tp1,
      take_profit_2: finalTp2,
      risk_reward_ratio: `1:${rrFinal.toFixed(1)}`,
      rationale: formatVipRationale({
        direction: "LONG",
        quality: qualityScore,
        entry: entryPrice,
        sl: ordered.sl,
        tp1: ordered.tp1,
        tp2: finalTp2,
        rr: `1:${rrFinal.toFixed(1)}`,
        confluence,
        plan: executionPlan,
        anchorLabel: `below ${lastLow?.label || "swing low"}`,
      }) + (extensionNote ? ` | ${extensionNote}` : ""),
      confluence_score: confluence,
      signal_quality: qualityScore,
      pattern_type: patternType,
      prop_firm_compliant: rrFinal >= 1.5,
    };
  }

  if (bias === "Bearish") {
    const entryAnchor = lastLow?.price ?? lastLowZone?.low;
    const slAnchor = lastHigh?.price ?? lastHighZone?.high;
    if (!Number.isFinite(entryAnchor as number) || !Number.isFinite(slAnchor as number)) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: "Bearish bias detected but breakout requires a clear swing low and prior swing high.",
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        prop_firm_compliant: false,
      };
    }

    const entryPrice = roundToTickDown((entryAnchor as number) - buffer, tickSize);
    const stopLoss = roundToTickUp((slAnchor as number) + buffer, tickSize);
    const swingTargets = pricedLows
      .map((l) => l.price)
      .filter((p) => p < entryPrice)
      .sort((a, b) => b - a);
    const targets = selectTargets("SHORT", entryPrice, swingTargets, psychStep, tickSize);

    if (!targets) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: "No valid breakout targets below the swing low. Need a lower swing or nearby psych level.",
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        prop_firm_compliant: false,
      };
    }

    const ordered = ensureStrictOrdering("SHORT", entryPrice, stopLoss, targets.tp1, targets.tp2, tickSize);
    const risk = ordered.sl - entryPrice;
    const reward = entryPrice - ordered.tp1;
    const rrRatio = reward / Math.max(risk, tickSize);

    let finalTp2 = ordered.tp2;
    let rrFinal = rrRatio;
    let extensionNote: string | undefined;

    if (rrRatio < 1.5) {
      const higherTarget = higherTfLows.slice().reverse().find((p) => p < ordered.tp1 && p < entryPrice);
      if (Number.isFinite(higherTarget)) {
        finalTp2 = roundToTick(higherTarget as number, tickSize);
        rrFinal = (entryPrice - finalTp2) / Math.max(risk, tickSize);
        extensionNote = "TP extended to higher timeframe swing for better R:R.";
      }
    }

    if (rrFinal < 1.5) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: `POOR R:R. Current ratio 1:${rrFinal.toFixed(1)} (need minimum 1:1.5). Wait for wider breakout targets or higher timeframe extension.`,
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        prop_firm_compliant: false,
      };
    }

    const qualityScore = confluence >= 85 ? "STRONG" : confluence >= 75 ? "MEDIUM" : "WEAK" as SignalQuality;
    const executionPlan = formatExecutionPlan({
      direction: "SHORT",
      entry: entryPrice,
      sl: ordered.sl,
      tp1: ordered.tp1,
      tp2: ordered.tp2,
      tickSize,
      entryMode: "STOP",
      entryReference: `Sell stop below ${lastLow?.label || "swing low"}`,
    });

    return {
      direction: "SHORT",
      entry_price: entryPrice,
      stop_loss: ordered.sl,
      take_profit_1: ordered.tp1,
      take_profit_2: finalTp2,
      risk_reward_ratio: `1:${rrFinal.toFixed(1)}`,
      rationale: formatVipRationale({
        direction: "SHORT",
        quality: qualityScore,
        entry: entryPrice,
        sl: ordered.sl,
        tp1: ordered.tp1,
        tp2: finalTp2,
        rr: `1:${rrFinal.toFixed(1)}`,
        confluence,
        plan: executionPlan,
        anchorLabel: `above ${lastHigh?.label || "swing high"}`,
      }) + (extensionNote ? ` | ${extensionNote}` : ""),
      confluence_score: confluence,
      signal_quality: qualityScore,
      pattern_type: patternType,
      prop_firm_compliant: rrFinal >= 1.5,
    };
  }

  return undefined;
};

export const buildAnalysis = (state: ChartState, topDownStates?: ChartState[]): AnalysisResponse => {
  const bias = inferBias(state);

  const structure: Structure = {
    trend_definition: describeTrend(state.trend_hint, state.swings),
    recent_swings: state.swings.map((s) => ({ type: s.type, label: s.label, zone: s.zone, price: s.price })),
    breaks: state.breaks.map((b) => ({ type: mapBreakType(b), description: b.description || (b.type === "none" ? "No clear break" : "Recent structure break") })),
    range: {
      is_range: Boolean(state.range.hasRange),
      top_zone: state.range.topZone || "unknown",
      bottom_zone: state.range.bottomZone || "unknown",
    },
  };

  const key_levels = buildKeyLevels(state.swings);
  const higherTimeframe =
    topDownStates && topDownStates.length > 1
      ? topDownStates[topDownStates.length - 2]
      : undefined;

  const plan = buildSniperPlan(bias, state, structure, higherTimeframe);
  const confidence = computeConfidence(state);

  const notes: string[] = [];
  if (state.chop_detected) notes.push("Choppy structure detected; trade selectivity required.");
  if (state.range.hasRange && !state.breaks.some((b) => b.type !== "none")) notes.push("Range conditions; wait for boundary break.");
  if (!state.swings.length) notes.push("Few swings visible; zoomed-out clarity may help.");

  return {
    meta: {
      pair: state.pair || "unknown",
      timeframe: state.timeframe || "unknown",
      source: "TradingView screenshot",
      notes: state.notes || "",
    },
    bias: {
      state: bias,
      reason: structure.trend_definition,
    },
    structure,
    key_levels,
    sniper_plan: {
      type: plan.planType,
      wait_for: plan.wait_for,
      trigger: plan.trigger,
      invalidation: plan.invalidation,
      targets: plan.targets,
      entry_signal: plan.entry_signal,
    },
    risk_notes: notes.length ? notes : ["Respect invalidation and position sizing."],
    confidence,
    top_down: state.top_down || [],
  };
};
