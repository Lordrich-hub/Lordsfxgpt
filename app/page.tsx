"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UploadBox } from "@/components/UploadBox";
import { ResultPanel } from "@/components/ResultPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { RiskCalculator } from "@/components/RiskCalculator";
import { AuthBar } from "@/components/AuthBar";
import { AnalysisResponse } from "@/lib/types";

export default function Page() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<AnalysisResponse[]>([]);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [historyEmptyMessage, setHistoryEmptyMessage] = useState<string | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const urlBucketRef = useRef<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/enabled", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { enabled?: boolean } | null;
        if (!mounted) return;
        setAuthEnabled(Boolean(json?.enabled));
      } catch {
        if (!mounted) return;
        setAuthEnabled(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadAccountHistory = async (enabled: boolean) => {
    if (!enabled) {
      setHistory([]);
      setHistoryEmptyMessage("Sign in to save and view your analysis history.");
      return;
    }

    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (res.status === 401) {
        setHistory([]);
        setHistoryEmptyMessage("Sign in to save and view your analysis history.");
        return;
      }
      if (!res.ok) {
        setHistory([]);
        setHistoryEmptyMessage("History is unavailable right now.");
        return;
      }
      const items = (await res.json()) as AnalysisResponse[];
      setHistory(Array.isArray(items) ? items : []);
      setHistoryEmptyMessage(undefined);
    } catch {
      setHistory([]);
      setHistoryEmptyMessage("History is unavailable right now.");
    }
  };

  const clearAccountHistory = async () => {
    if (!authEnabled) return;
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (res.status === 401) {
        setHistory([]);
        setHistoryEmptyMessage("Sign in to save and view your analysis history.");
        return;
      }
      if (!res.ok) {
        setHistoryEmptyMessage("History could not be cleared right now.");
        return;
      }
      setHistory([]);
      setHistoryEmptyMessage("History cleared.");
    } catch {
      setHistoryEmptyMessage("History could not be cleared right now.");
    }
  };

  useEffect(() => {
    void loadAccountHistory(authEnabled);
  }, [authEnabled]);

  useEffect(() => {
    return () => {
      urlBucketRef.current.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      urlBucketRef.current = [];
    };
  }, []);

  const onFilesSelected = (incoming: File[]) => {
    setError(undefined);
    if (!incoming?.length) return;
    const newUrls = incoming.map((f) => URL.createObjectURL(f));
    urlBucketRef.current.push(...newUrls);
    setFiles((prev) => [...prev, ...incoming]);
    setPreviewUrls((prev) => [...prev, ...newUrls]);
  };

  const clearStack = () => {
    urlBucketRef.current.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch {}
    });
    urlBucketRef.current = [];
    setFiles([]);
    setPreviewUrls([]);
  };

  const handleUploadAnalyze = async () => {
    if (!files.length) {
      setError("Upload at least one chart");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("file", f));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
      
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const errorMsg = body.error || `Server error: ${res.status}`;
        throw new Error(errorMsg);
      }
      const json = (await res.json()) as AnalysisResponse;
      setData(json);

      if (authEnabled) {
        const saveRes = await fetch("/api/history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(json),
        });

        // If the user isn't signed in, don't treat it as an app error.
        if (saveRes.status !== 401) {
          await saveRes.json().catch(() => null);
        }

        void loadAccountHistory(true);
      }

      clearStack();
    } catch (err: any) {
      let errorMsg = "Analysis failed";
      
      if (err.name === "AbortError") {
        errorMsg = "Request timed out (90s). The service is taking too long. Please try again.";
      } else if (err instanceof TypeError && err.message.includes("fetch")) {
        errorMsg = "Network error: Cannot reach server. Make sure the app is running.";
      } else if (err.message?.includes("AI service")) {
        errorMsg = err.message;
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!data) return "";
    return `${data.meta.pair} · ${data.meta.timeframe}`;
  }, [data]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950">
      {/* Animated background blur */}
      <div className="fixed inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(147,51,234,0.3),rgba(147,51,234,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_80%_80%,rgba(91,33,182,0.2),rgba(91,33,182,0))]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 md:flex-row">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Header */}
          <header className="space-y-6 animate-fade-in">
            <div className="space-y-3">
              <div className="inline-block">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur px-4 py-2 text-xs font-semibold text-purple-300">
                  <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                  AI-Powered Market Intelligence
                </div>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tight">
                Lords<span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">FX</span>
              </h1>
              <p className="max-w-2xl text-lg text-slate-300 leading-relaxed">
                Professional-grade market analysis. Multi-timeframe confirmation. Institutional-quality signals.
              </p>
              {stats && (
                <p className="text-sm text-purple-400 font-medium">
                  Last Analysis: {stats}
                </p>
              )}
            </div>
          </header>

          {/* File Info */}
          {files.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-purple-400">{files.length}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Chart{files.length > 1 ? "s" : ""} Selected</p>
                  <p className="text-xs text-slate-400">Last chart = entry/SL timeframe (lower TF)</p>
                </div>
              </div>
              <button
                onClick={clearStack}
                className="text-xs font-semibold text-slate-400 hover:text-red-400 transition px-3 py-1 rounded-lg hover:bg-red-500/10"
              >
                Clear
              </button>
            </div>
          )}

          {/* Upload Box */}
          <UploadBox onFilesSelected={onFilesSelected} previewUrls={previewUrls} />

          {/* CTA Button */}
          <button
            onClick={handleUploadAnalyze}
            disabled={isLoading || !files.length}
            className="w-full group relative overflow-hidden rounded-xl px-6 py-4 text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 transition-transform group-hover:scale-105 disabled:scale-100" />
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 blur opacity-0 group-hover:opacity-75 transition-opacity" />
            <div className="relative flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v0a8 8 0 100 16v0a8 8 0 01-8-8z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  Generate Signal
                </>
              )}
            </div>
          </button>

          {/* Error Display */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur p-4">
              <p className="text-sm text-red-300 font-semibold">{error}</p>
            </div>
          )}

          {/* Results */}
          <ResultPanel data={data} isLoading={isLoading} error={error} />
        </div>

        {/* Sidebar */}
        <aside className="w-full max-w-sm space-y-6">
          {/* Risk Calculator */}
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Account Management</h2>
            <AuthBar enabled={authEnabled} />
            <RiskCalculator />
          </div>

          {/* History */}
          <div className="space-y-4 animate-fade-in animation-delay-100">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Recent Analyses</h2>
            <HistoryPanel
              items={history}
              onSelect={(item) => setData(item)}
              storageLabel={authEnabled ? "Stored to your account" : "Account history"}
              emptyMessage={historyEmptyMessage}
              onClear={authEnabled ? clearAccountHistory : undefined}
            />
          </div>

          {/* Info Card */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">How It Works</h3>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex gap-3">
                <span className="text-purple-400 font-bold flex-shrink-0">1.</span>
                <p>Upload one or more TradingView charts</p>
              </div>
              <div className="flex gap-3">
                <span className="text-purple-400 font-bold flex-shrink-0">2.</span>
                <p>Click Generate Signal to run the analysis</p>
              </div>
              <div className="flex gap-3">
                <span className="text-purple-400 font-bold flex-shrink-0">3.</span>
                <p>Review bias, structure, and entry levels (if available)</p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">Confidence-scored analysis. Institutional standards.</p>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 backdrop-blur p-4">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animation-delay-100 {
          animation-delay: 0.1s;
        }
      `}</style>
    </main>
  );
}
