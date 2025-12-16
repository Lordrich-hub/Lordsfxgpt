import { AnalysisResponse } from "./types";

const KEY = "structuregpt-history-v1";
const LIMIT = 20;

export const loadHistory = (): AnalysisResponse[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnalysisResponse[];
  } catch (err) {
    console.error("Failed to load history", err);
    return [];
  }
};

export const saveToHistory = (item: AnalysisResponse) => {
  if (typeof window === "undefined") return;
  try {
    const existing = loadHistory();
    const next = [item, ...existing].slice(0, LIMIT);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Failed to save history", err);
  }
};
