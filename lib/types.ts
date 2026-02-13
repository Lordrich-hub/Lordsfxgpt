export type BiasState = "Bullish" | "Bearish" | "Range" | "Transition";

export interface Meta {
  pair: string;
  timeframe: string;
  source: string;
  notes: string;
}

export interface Bias {
  state: BiasState;
  reason: string;
}

export type SwingType = "SwingHigh" | "SwingLow";
export type BreakType = "BoS" | "Shift" | "None";
export type PlanType = "Continuation" | "Reversal" | "RangePlay" | "NoTrade";

export interface Structure {
  trend_definition: string;
  recent_swings: { type: SwingType; label: string; zone: string; price?: number }[];
  breaks: { type: BreakType; description: string }[];
  range: {
    is_range: boolean;
    top_zone: string;
    bottom_zone: string;
  };
}

export interface KeyLevel {
  name: string;
  zone: string;
  why_it_matters: string;
}

export type SignalQuality = "STRONG" | "MEDIUM" | "WEAK" | "INVALID";
export type PatternType = "REVERSAL" | "BREAKOUT" | "CONTINUATION" | "PULLBACK" | "NONE";

export interface EntrySignal {
  direction: "LONG" | "SHORT" | "WAIT";
  entry_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  risk_reward_ratio: string;
  rationale: string;
  confluence_score?: number; // 0-100: higher = more probable
  signal_quality?: SignalQuality; // Qualitative label derived from confluence thresholds
  pattern_type?: PatternType; // Type of setup detected
  prop_firm_compliant?: boolean; // Meets max DD/risk limits
}

export interface TopDownFrame {
  timeframe: string;
  bias: TrendHint | BiasState;
  key_level?: string;
  narrative?: string;
}

export interface SniperPlan {
  type: PlanType;
  wait_for: string[];
  trigger: string[];
  invalidation: string[];
  targets: string[];
  entry_signal?: EntrySignal;
}

export interface Confidence {
  score: number;
  explanation: string;
}

export interface AnalysisResponse {
  meta: Meta;
  bias: Bias;
  structure: Structure;
  key_levels: KeyLevel[];
  sniper_plan: SniperPlan;
  risk_notes: string[];
  confidence: Confidence;
  top_down?: TopDownFrame[];
}

// Stage A extracted state from vision model
export type TrendHint = "bullish" | "bearish" | "range" | "transition" | "unknown";

export interface ChartSwing {
  type: SwingType;
  label: string;
  zone: string;
  price?: number;
}

export interface ChartBreak {
  type: "bos" | "shift" | "none";
  confirmed: boolean;
  description?: string;
}

export interface ChartRange {
  hasRange: boolean;
  topZone?: string;
  bottomZone?: string;
  falseBreaks?: boolean;
}

export interface ChartState {
  pair?: string;
  timeframe?: string;
  current_price?: number;
  price_region?: string;
  trend_hint: TrendHint;
  swings: ChartSwing[];
  breaks: ChartBreak[];
  range: ChartRange;
  chop_detected?: boolean;
  retest_present?: boolean;
  notes?: string;
  top_down?: TopDownFrame[];
}
