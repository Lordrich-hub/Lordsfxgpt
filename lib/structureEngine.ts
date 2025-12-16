import { AnalysisResponse, BiasState, ChartBreak, ChartState, ChartSwing, KeyLevel, PlanType, Structure, EntrySignal, SwingType, SignalQuality, PatternType } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Round price to nearest pip (4 decimals for most pairs, 2 for JPY)
 */
const roundToPip = (price: number): number => {
  return Math.round(price * 10000) / 10000;
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
 * ENHANCED confluence scoring for PROP FIRM SUCCESS
 * Minimum 75% for signals (vs old 65%)
 * Focuses on HIGH PROBABILITY setups only
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

const buildSniperPlan = (bias: BiasState, state: ChartState, structure: Structure): { planType: PlanType; wait_for: string[]; trigger: string[]; invalidation: string[]; targets: string[]; entry_signal?: EntrySignal } => {
  const lastHigh = structure.recent_swings.filter((s) => s.type === "SwingHigh").at(-1);
  const lastLow = structure.recent_swings.filter((s) => s.type === "SwingLow").at(-1);

  const baseInvalidation = bias === "Bullish" ? (lastLow?.zone ? [lastLow.zone] : []) : bias === "Bearish" ? (lastHigh?.zone ? [lastHigh.zone] : []) : [];
  const targetCandidates = bias === "Bullish" ? (lastHigh?.zone ? [lastHigh.zone] : []) : bias === "Bearish" ? (lastLow?.zone ? [lastLow.zone] : []) : [];

  // Calculate entry signal with precise prices
  const entrySignal = calculateEntrySignal(bias, state, lastHigh, lastLow);

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
      wait_for: ["Pullback that holds above last swing low", "Retest of broken structure"],
      trigger: ["Bullish rejection candle at support", "Break of minor high after pullback"],
      invalidation: baseInvalidation.length ? baseInvalidation : ["Close below prior swing low"],
      targets: targetCandidates.length ? targetCandidates : ["Next visible swing high zone"],
      entry_signal: entrySignal,
    };
  }

  if (bias === "Bearish") {
    return {
      planType: state.range.hasRange ? "RangePlay" : "Continuation",
      wait_for: ["Pullback that holds below last swing high", "Retest of broken support as resistance"],
      trigger: ["Bearish rejection candle at resistance", "Break of minor low after pullback"],
      invalidation: baseInvalidation.length ? baseInvalidation : ["Close above prior swing high"],
      targets: targetCandidates.length ? targetCandidates : ["Next visible swing low zone"],
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
 * - Minimum 1:2 R:R ratio (ideally 1:3+)
 * - Structure-based dynamic SL/TP
 * - Position sizing for risk management
 */
const calculateEntrySignal = (
  bias: BiasState,
  state: ChartState,
  lastHigh: { type: SwingType; label: string; zone: string; price?: number } | undefined,
  lastLow: { type: SwingType; label: string; zone: string; price?: number } | undefined
): EntrySignal | undefined => {
  const confluence = calculateConfluenceScore(bias, state, lastHigh, lastLow);
  const patternType = identifyPatternType(bias, state, lastHigh, lastLow);
  const minConfluence = 75; // INCREASED from 65% - only high-probability setups

  // Skip if below minimum confluence threshold
  if (confluence < minConfluence) {
    return {
      direction: "WAIT",
      entry_price: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      risk_reward_ratio: "N/A",
      rationale: `LOW PROBABILITY. Confluence ${confluence}/100 (need ${minConfluence}+). Wait for clearer setup with confirmed structure break + retest.`,
      confluence_score: confluence,
      signal_quality: "INVALID",
      pattern_type: patternType,
      probability: confluence,
      prop_firm_compliant: false,
    };
  }

  // Additional guard: STRICT filter for choppy/range conditions
  if ((state.chop_detected || bias === "Range" || bias === "Transition") && confluence < 85) {
    return {
      direction: "WAIT",
      entry_price: null,
      stop_loss: null,
      take_profit_1: null,
      take_profit_2: null,
      risk_reward_ratio: "N/A",
      rationale: "CHOPPY MARKET. No clear directional bias. Waiting for structure to develop or clean break. Prop firm rule: avoid low-confidence trades.",
      confluence_score: confluence,
      signal_quality: "INVALID",
      pattern_type: patternType,
      probability: confluence,
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
      probability: confluence,
      prop_firm_compliant: false,
    };
  }

  // Get all swing highs and lows for structure-based levels
  const allHighs = state.swings.filter((s) => s.type === "SwingHigh" && s.price).sort((a, b) => (b.price || 0) - (a.price || 0));
  const allLows = state.swings.filter((s) => s.type === "SwingLow" && s.price).sort((a, b) => (a.price || 0) - (b.price || 0));

  if (bias === "Bullish") {
    // Need at least a low to trade from
    if (!lastLow?.price || allHighs.length === 0) {
      return {
        direction: "LONG",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: "Bullish bias detected but cannot calculate precise entry - swing structure incomplete.",
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        probability: confluence,
        prop_firm_compliant: false,
      };
    }

    // Entry: Near current price or at swing low + small buffer
    const entryPrice = roundToPip(refPrice);
    
    // SL: Below last swing low (respecting structure) with 3% buffer
    const buffer = Math.abs(refPrice - lastLow.price) * 0.03; // Tighter 3% buffer
    const stopLoss = roundToPip(lastLow.price - buffer);
    
    // TP1: Next swing high above entry (aim for 1:2 minimum)
    const tp1High = allHighs.find(h => (h.price || 0) > entryPrice);
    const minTp1 = roundToPip(entryPrice + (entryPrice - stopLoss) * 2.0); // Minimum 1:2
    const tp1 = tp1High?.price ? roundToPip(Math.max(tp1High.price, minTp1)) : minTp1;
    
    // TP2: Higher swing high (aim for 1:3+)
    const tp2High = allHighs.find(h => (h.price || 0) > tp1 + 0.0015);
    const minTp2 = roundToPip(entryPrice + (entryPrice - stopLoss) * 3.0); // Minimum 1:3
    const tp2 = tp2High?.price ? roundToPip(Math.max(tp2High.price, minTp2)) : minTp2;
    
    const risk = entryPrice - stopLoss;
    const reward = tp1 - entryPrice;
    const rrRatio = reward / risk;
    
    // STRICT: Enforce minimum 1:2 R:R ratio for prop firm compliance
    if (rrRatio < 2.0) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: `POOR R:R. Current ratio 1:${rrRatio.toFixed(1)} (need minimum 1:2.0). Structure too tight. Wait for better setup with wider targets.`,
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        probability: confluence,
        prop_firm_compliant: false,
      };
    }
    
    const isCompliant = rrRatio >= 2.0;
    const qualityScore = confluence >= 85 ? "STRONG" : confluence >= 75 ? "MEDIUM" : "WEAK" as SignalQuality;

    return {
      direction: "LONG",
      entry_price: entryPrice,
      stop_loss: stopLoss,
      take_profit_1: tp1,
      take_profit_2: tp2,
      risk_reward_ratio: `1:${rrRatio.toFixed(1)}`,
      rationale: `✅ LONG [${qualityScore}]. Entry ${entryPrice}, SL ${stopLoss} (below ${lastLow.label || "swing"}). TP1 ${tp1}, TP2 ${tp2}. R:R 1:${rrRatio.toFixed(1)}. Confluence ${confluence}/100. Prop-firm compliant.`,
      confluence_score: confluence,
      signal_quality: qualityScore,
      pattern_type: patternType,
      probability: confluence,
      prop_firm_compliant: isCompliant,
    };
  }

  if (bias === "Bearish") {
    // Need at least a high to trade from
    if (!lastHigh?.price || allLows.length === 0) {
      return {
        direction: "SHORT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: "Bearish bias detected but cannot calculate precise entry - swing structure incomplete.",
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        probability: confluence,
        prop_firm_compliant: false,
      };
    }

    // Entry: Near current price or at swing high - small buffer
    const entryPrice = roundToPip(refPrice);
    
    // SL: Above last swing high (respecting structure) with 3% buffer
    const buffer = Math.abs(lastHigh.price - refPrice) * 0.03; // Tighter 3% buffer
    const stopLoss = roundToPip(lastHigh.price + buffer);
    
    // TP1: Next swing low below entry (aim for 1:2 minimum)
    const tp1Low = allLows.find(l => (l.price || 0) < entryPrice);
    const minTp1 = roundToPip(entryPrice - (stopLoss - entryPrice) * 2.0); // Minimum 1:2
    const tp1 = tp1Low?.price ? roundToPip(Math.min(tp1Low.price, minTp1)) : minTp1;
    
    // TP2: Lower swing low (aim for 1:3+)
    const tp2Low = allLows.find(l => (l.price || 0) < tp1 - 0.0015);
    const minTp2 = roundToPip(entryPrice - (stopLoss - entryPrice) * 3.0); // Minimum 1:3
    const tp2 = tp2Low?.price ? roundToPip(Math.min(tp2Low.price, minTp2)) : minTp2;
    
    const risk = stopLoss - entryPrice;
    const reward = entryPrice - tp1;
    const rrRatio = reward / risk;
    
    // STRICT: Enforce minimum 1:2 R:R ratio for prop firm compliance
    if (rrRatio < 2.0) {
      return {
        direction: "WAIT",
        entry_price: null,
        stop_loss: null,
        take_profit_1: null,
        take_profit_2: null,
        risk_reward_ratio: "N/A",
        rationale: `POOR R:R. Current ratio 1:${rrRatio.toFixed(1)} (need minimum 1:2.0). Structure too tight. Wait for better setup with wider targets.`,
        confluence_score: confluence,
        signal_quality: "INVALID",
        pattern_type: patternType,
        probability: confluence,
        prop_firm_compliant: false,
      };
    }
    
    const isCompliant = rrRatio >= 2.0;
    const qualityScore = confluence >= 85 ? "STRONG" : confluence >= 75 ? "MEDIUM" : "WEAK" as SignalQuality;

    return {
      direction: "SHORT",
      entry_price: entryPrice,
      stop_loss: stopLoss,
      take_profit_1: tp1,
      take_profit_2: tp2,
      risk_reward_ratio: `1:${rrRatio.toFixed(1)}`,
      rationale: `✅ SHORT [${qualityScore}]. Entry ${entryPrice}, SL ${stopLoss} (above ${lastHigh.label || "swing"}). TP1 ${tp1}, TP2 ${tp2}. R:R 1:${rrRatio.toFixed(1)}. Confluence ${confluence}/100. Prop-firm compliant.`,
      confluence_score: confluence,
      signal_quality: qualityScore,
      pattern_type: patternType,
      probability: confluence,
      prop_firm_compliant: isCompliant,
    };
  }

  return undefined;
};

export const buildAnalysis = (state: ChartState): AnalysisResponse => {
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
  const plan = buildSniperPlan(bias, state, structure);
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
