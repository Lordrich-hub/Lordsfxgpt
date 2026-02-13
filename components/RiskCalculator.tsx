"use client";

import { useState } from "react";

interface RiskCalcResult {
  lotSize: number;
  riskAmount: number;
  units: number;
  notionalQuoteCcy: number;
  pipsAtRisk: number;
  recommendation: string;
}

export function RiskCalculator() {
  const [accountBalance, setAccountBalance] = useState<string>("");
  const [riskPercentage, setRiskPercentage] = useState<string>("1");
  const [entryPrice, setEntryPrice] = useState<string>("");
  const [stopLoss, setStopLoss] = useState<string>("");
  const [pipSize, setPipSize] = useState<string>("0.0001");
  const [pipValuePerLot, setPipValuePerLot] = useState<string>("10");
  const [contractSize, setContractSize] = useState<string>("100000");
  const [result, setResult] = useState<RiskCalcResult | null>(null);
  const [formError, setFormError] = useState<string>("");

  const calculateRisk = () => {
    setFormError("");
    const balance = parseFloat(accountBalance);
    const risk = parseFloat(riskPercentage);
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const pip = parseFloat(pipSize);
    const pipValue = parseFloat(pipValuePerLot);
    const contract = parseFloat(contractSize);

    if ([balance, risk, entry, sl, pip, pipValue, contract].some((v) => !Number.isFinite(v))) {
      setFormError("Please fill in all fields with valid numbers.");
      return;
    }

    if (balance <= 0) {
      setFormError("Account balance must be greater than 0.");
      return;
    }

    if (risk <= 0 || risk > 100) {
      setFormError("Risk percentage must be between 0 and 100.");
      return;
    }

    if (pip <= 0) {
      setFormError("Pip size must be greater than 0.");
      return;
    }

    if (pipValue <= 0) {
      setFormError("Pip value per lot must be greater than 0.");
      return;
    }

    if (contract <= 0) {
      setFormError("Contract size must be greater than 0.");
      return;
    }

    // Soft guidance (no blocking)

    const riskAmount = (balance * risk) / 100;
    const pipDifference = Math.abs(entry - sl);

    const pipsAtRisk = pipDifference / pip;

    if (pipsAtRisk === 0) {
      setFormError("Stop loss must differ from entry price.");
      return;
    }

    // pipValuePerLot is provided by the user (in account currency)
    const riskPerLot = pipsAtRisk * pipValue;
    if (riskPerLot <= 0) {
      setFormError("Invalid inputs produced a zero/negative risk per lot.");
      return;
    }

    const lotSize = riskAmount / riskPerLot;
    const units = lotSize * contract;
    const notionalQuoteCcy = units * entry;

    // Generate recommendation
    let recommendation = "";
    if (risk <= 1) {
      recommendation = "Conservative risk. Common for funded accounts and long-term consistency.";
    } else if (risk <= 2) {
      recommendation = "Moderate risk. Consider limiting trade frequency and correlated exposure.";
    } else if (risk <= 3) {
      recommendation = "Aggressive risk. Only consider if the setup quality and liquidity are strong.";
    } else {
      recommendation = "Very high risk. Strongly consider reducing to 0.5–2%.";
    }

    setResult({
      lotSize: parseFloat(lotSize.toFixed(2)),
      riskAmount: parseFloat(riskAmount.toFixed(2)),
      units: Math.round(units),
      notionalQuoteCcy: parseFloat(notionalQuoteCcy.toFixed(2)),
      pipsAtRisk: parseFloat(pipsAtRisk.toFixed(1)),
      recommendation,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-panel/50 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Risk Calculator</h3>
        <span className="text-xs text-purple-400 font-semibold">Account Management</span>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Account Balance ($)
          </label>
          <input
            type="number"
            value={accountBalance}
            onChange={(e) => setAccountBalance(e.target.value)}
            placeholder="10000"
            className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white placeholder-slate-500 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Risk Percentage (%)
          </label>
          <input
            type="number"
            value={riskPercentage}
            onChange={(e) => setRiskPercentage(e.target.value)}
            placeholder="1"
            step="0.1"
            max="5"
            className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white placeholder-slate-500 focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">Recommended: 0.5% - 2%</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="pipSize" className="text-sm font-medium text-slate-300 block mb-2">Pip Size</label>
            <select
              id="pipSize"
              value={pipSize}
              onChange={(e) => setPipSize(e.target.value)}
              className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white focus:border-accent focus:outline-none"
            >
              <option value="0.0001">0.0001 (Most FX)</option>
              <option value="0.01">0.01 (JPY pairs / many CFDs)</option>
              <option value="0.1">0.1</option>
              <option value="1">1</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 block mb-2">Pip Value per 1.00 Lot (Account Currency)</label>
            <input
              type="number"
              value={pipValuePerLot}
              onChange={(e) => setPipValuePerLot(e.target.value)}
              placeholder="10"
              step="0.01"
              className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white placeholder-slate-500 focus:border-accent focus:outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">For EURUSD (USD account), 1.00 lot is typically ~$10 per pip.</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">Contract Size (Units per 1.00 Lot)</label>
          <input
            type="number"
            value={contractSize}
            onChange={(e) => setContractSize(e.target.value)}
            placeholder="100000"
            step="1"
            className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white placeholder-slate-500 focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">FX standard lot is usually 100,000 units (broker-dependent).</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Entry Price
          </label>
          <input
            type="number"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            placeholder="1.08500"
            step="0.00001"
            className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white placeholder-slate-500 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 block mb-2">
            Stop Loss Price
          </label>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="1.08300"
            step="0.00001"
            className="w-full rounded-lg border border-border bg-slate-900/50 px-4 py-2 text-white placeholder-slate-500 focus:border-accent focus:outline-none"
          />
        </div>

        <button
          onClick={calculateRisk}
          className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
        >
          Calculate Position Size
        </button>

        {formError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {formError}
          </div>
        )}
      </div>

      {result && (
        <div className="mt-6 space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Stop Distance:</span>
            <span className="text-lg font-bold text-white">{result.pipsAtRisk} pips</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Lot Size:</span>
            <span className="text-lg font-bold text-accent">{result.lotSize} lots</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Risk Amount:</span>
            <span className="text-lg font-bold text-white">${result.riskAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Units:</span>
            <span className="text-sm text-slate-400">{result.units.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-300">Notional (Quote CCY):</span>
            <span className="text-sm text-slate-400">{result.notionalQuoteCcy.toLocaleString()}</span>
          </div>
          <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
            <p className="text-sm text-slate-200">{result.recommendation}</p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong>Tip:</strong> Many professional traders keep risk per trade between 0.5% and 1.0%. Always confirm your broker's contract size and pip value.
        </p>
      </div>
    </div>
  );
}
