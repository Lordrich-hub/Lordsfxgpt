"use client";

import { AnalysisResponse } from "@/lib/types";

interface Props {
  items: AnalysisResponse[];
  onSelect: (item: AnalysisResponse) => void;
  storageLabel?: string;
  emptyMessage?: string;
  onClear?: () => void;
}

export function HistoryPanel({ items, onSelect, storageLabel, emptyMessage, onClear }: Props) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-border bg-panel/50 p-4 text-sm text-muted">
        {emptyMessage ?? "History will appear after your first analysis."}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-panel/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Recent analyses</h3>
        <div className="flex items-center gap-3">
          {typeof onClear === "function" && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-muted hover:text-rose-200"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted">{storageLabel ?? "Stored locally"}</span>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(item)}
            className="w-full rounded-xl border border-border bg-panel/80 p-3 text-left transition hover:border-accent"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-accent">{item.bias.state}</span>
              <span className="text-xs text-muted">{item.meta.pair} · {item.meta.timeframe}</span>
            </div>
            <p className="text-xs text-muted">{item.structure.trend_definition}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
