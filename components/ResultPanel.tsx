"use client";

import { AnalysisResponse } from "@/lib/types";

interface Props {
  data: AnalysisResponse | null;
  isLoading: boolean;
  error?: string;
}

const biasColors: Record<string, string> = {
  Bullish: "bg-emerald-500/20 text-emerald-300",
  Bearish: "bg-rose-500/20 text-rose-300",
  Range: "bg-amber-500/20 text-amber-300",
  Transition: "bg-sky-500/20 text-sky-300",
};

const widthClassByStep5: Record<number, string> = {
  0: "w-[0%]",
  5: "w-[5%]",
  10: "w-[10%]",
  15: "w-[15%]",
  20: "w-[20%]",
  25: "w-[25%]",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-[40%]",
  45: "w-[45%]",
  50: "w-[50%]",
  55: "w-[55%]",
  60: "w-[60%]",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-[75%]",
  80: "w-[80%]",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-[100%]",
};

function percentToWidthClass(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const snapped = Math.round(clamped / 5) * 5;
  return widthClassByStep5[snapped] ?? widthClassByStep5[0];
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

function getAlignmentCount(bias: string, frames?: AnalysisResponse["top_down"]): { aligned: number; total: number } {
  if (!frames || !frames.length) return { aligned: 0, total: 0 };
  if (bias !== "Bullish" && bias !== "Bearish") return { aligned: 0, total: frames.length };

  const aligned = frames.filter((tf) => {
    const tfBias = typeof tf.bias === "string" ? tf.bias.toLowerCase() : String(tf.bias).toLowerCase();
    return bias === "Bullish" ? tfBias === "bullish" : tfBias === "bearish";
  }).length;

  return { aligned, total: frames.length };
}

export function ResultPanel({ data, isLoading, error }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-panel/60 p-6">
        <div className="animate-pulse text-muted">Analyzing chart structure...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-6 text-rose-100">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-border bg-panel/40 p-6 text-muted">
        Upload a chart to see the structure analysis.
      </div>
    );
  }

  const bias = data.bias.state;
  const conf = data.confidence.score;
  const alignment = getAlignmentCount(bias, data.top_down);

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-panel/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${biasColors[bias]}`}>{bias}</span>
          <p className="text-sm text-muted max-w-xl">{data.bias.reason}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>Confidence</span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-border">
            <div className={`h-full bg-accent ${percentToWidthClass(Number(conf))}`} />
          </div>
          <span className="text-accent font-semibold">{conf}</span>
        </div>
      </div>

      <div className="text-xs text-muted">
        Source: <span className="text-slate-200">{data.meta.source}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel/80 p-4 space-y-2">
          <h3 className="font-semibold">Structure</h3>
          <p className="text-sm text-muted">{data.structure.trend_definition}</p>
          {data.top_down && data.top_down.length > 0 && (
            <div className="mt-2 p-3 rounded border border-border/60 bg-panel/60">
              <p className="text-xs uppercase text-muted mb-1">Top-down bias</p>
              <ul className="text-sm space-y-1">
                {data.top_down.map((tf, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-muted">•</span>
                    <span>
                      {tf.timeframe}: {typeof tf.bias === 'string' ? tf.bias : String(tf.bias)}
                      {tf.key_level && <span className="ml-2 text-xs text-muted">@ {tf.key_level}</span>}
                      {tf.narrative && <span className="ml-2 text-xs text-muted">— {tf.narrative}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs uppercase text-muted">Recent swings</p>
            <ul className="text-sm space-y-1">
              {data.structure.recent_swings.map((s, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-muted">•</span>
                  <span>
                    {s.label} ({s.type}) @ {s.zone}
                    {typeof s.price === "number" && (
                      <span className="ml-2 font-mono text-accent text-xs">({formatPrice(s.price)})</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Breaks</p>
            <ul className="text-sm space-y-1">
              {data.structure.breaks.map((b, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-muted">•</span>
                  <span>{b.type}: {b.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Range</p>
            <p className="text-sm">{data.structure.range.is_range ? `${data.structure.range.bottom_zone} to ${data.structure.range.top_zone}` : "Not ranging"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel/80 p-4 space-y-3">
          <h3 className="font-semibold">Sniper plan</h3>
          <p className="text-sm text-muted">Plan type: {data.sniper_plan.type}</p>
          <div>
            <p className="text-xs uppercase text-muted">Wait for</p>
            <ul className="text-sm space-y-1">
              {data.sniper_plan.wait_for.map((w, idx) => (
                <li key={idx} className="flex gap-2"><span className="text-muted">•</span><span>{w}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Trigger</p>
            <ul className="text-sm space-y-1">
              {data.sniper_plan.trigger.map((w, idx) => (
                <li key={idx} className="flex gap-2"><span className="text-muted">•</span><span>{w}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Invalidation</p>
            <ul className="text-sm space-y-1">
              {data.sniper_plan.invalidation.map((w, idx) => (
                <li key={idx} className="flex gap-2"><span className="text-muted">•</span><span>{w}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">Targets</p>
            <ul className="text-sm space-y-1">
              {data.sniper_plan.targets.map((w, idx) => (
                <li key={idx} className="flex gap-2"><span className="text-muted">•</span><span>{w}</span></li>
              ))}
            </ul>
          </div>

          {/* Entry Signal Section */}
          {data.sniper_plan.entry_signal && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-accent">Entry Signal</h4>
                <div className="flex gap-2 items-center">
                  {data.sniper_plan.entry_signal.signal_quality && (
                    <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                      data.sniper_plan.entry_signal.signal_quality === 'STRONG'
                        ? 'bg-emerald-500/30 text-emerald-200'
                        : data.sniper_plan.entry_signal.signal_quality === 'MEDIUM'
                        ? 'bg-amber-500/30 text-amber-200'
                        : data.sniper_plan.entry_signal.signal_quality === 'WEAK'
                        ? 'bg-rose-500/30 text-rose-200'
                        : 'bg-zinc-500/30 text-zinc-200'
                    }`}>
                      {data.sniper_plan.entry_signal.signal_quality}
                    </span>
                  )}
                  {data.sniper_plan.entry_signal.prop_firm_compliant && (
                    <span className="px-2 py-0.5 text-xs rounded font-semibold bg-emerald-500/30 text-emerald-200">
                      ✓ Compliant
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    data.sniper_plan.entry_signal.direction === 'LONG' 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : data.sniper_plan.entry_signal.direction === 'SHORT'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {data.sniper_plan.entry_signal.direction}
                  </span>
                  <span className="text-xs text-muted">
                    R:R {data.sniper_plan.entry_signal.risk_reward_ratio}
                  </span>
                </div>

                {data.sniper_plan.entry_signal.confluence_score !== undefined && (
                  <div className="bg-zinc-900/50 p-2 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs text-muted">TP Hit Chance</p>
                      <p className="text-sm font-semibold text-accent">{data.sniper_plan.entry_signal.confluence_score}/100</p>
                    </div>
                    <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          data.sniper_plan.entry_signal.confluence_score >= 80 ? 'bg-emerald-500' :
                          data.sniper_plan.entry_signal.confluence_score >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        } ${percentToWidthClass(Number(data.sniper_plan.entry_signal.confluence_score))}`}
                      />
                    </div>
                    {alignment.total > 0 && (
                      <div className="mt-2 text-[11px] text-muted">
                        TF alignment: {alignment.aligned}/{alignment.total}
                      </div>
                    )}
                  </div>
                )}

                {data.sniper_plan.entry_signal.pattern_type && (
                  <div className="bg-zinc-900/50 p-2 rounded text-center">
                    <p className="text-xs text-muted">Pattern</p>
                    <p className="text-sm font-semibold text-accent">{data.sniper_plan.entry_signal.pattern_type}</p>
                  </div>
                )}

                {data.sniper_plan.entry_signal.entry_price !== null ? (
                  <div className="bg-zinc-900/50 p-3 rounded">
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div className="flex flex-col">
                        <p className="text-xs text-muted">Entry</p>
                        <p className="font-mono text-accent font-semibold">{formatPrice(data.sniper_plan.entry_signal.entry_price)}</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted">SL</p>
                        <p className="font-mono text-rose-400 font-semibold">{formatPrice(data.sniper_plan.entry_signal.stop_loss || 0)}</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted">TP1</p>
                        <p className="font-mono text-emerald-400 font-semibold">{formatPrice(data.sniper_plan.entry_signal.take_profit_1 || 0)}</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-xs text-muted">TP2</p>
                        <p className="font-mono text-emerald-400 font-semibold">{formatPrice(data.sniper_plan.entry_signal.take_profit_2 || 0)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-center">
                    <p className="text-sm text-amber-300">No precise entry levels available</p>
                  </div>
                )}

                <div className="text-xs text-muted leading-relaxed p-2 bg-zinc-900/30 rounded">
                  {data.sniper_plan.entry_signal.rationale}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel/80 p-4 space-y-2">
        <h3 className="font-semibold">Key levels</h3>
        <ul className="text-sm space-y-1">
          {data.key_levels.map((lvl, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-muted">•</span>
              <span>{lvl.name}: {lvl.zone} — {lvl.why_it_matters}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-panel/80 p-4 space-y-2">
        <h3 className="font-semibold">Risk notes</h3>
        <ul className="text-sm space-y-1">
          {data.risk_notes.map((note, idx) => (
            <li key={idx} className="flex gap-2"><span className="text-muted">•</span><span>{note}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
