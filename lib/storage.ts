import { AnalysisResponse } from "./types";

const KEY = "structuregpt-history-v1";
const DATE_KEY = "structuregpt-last-clear-date";
const LIMIT = 20;

// Check if history should be cleared (daily refresh)
const shouldClearHistory = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const lastClear = window.localStorage.getItem(DATE_KEY);
    const today = new Date().toDateString();
    
    if (!lastClear || lastClear !== today) {
      window.localStorage.setItem(DATE_KEY, today);
      return lastClear !== null; // Don't clear on first visit
    }
    return false;
  } catch (err) {
    console.error("Failed to check history date", err);
    return false;
  }
};

export const loadHistory = (): AnalysisResponse[] => {
  if (typeof window === "undefined") return [];
  try {
    // Clear history if it's a new day
    if (shouldClearHistory()) {
      window.localStorage.removeItem(KEY);
      return [];
    }
    
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
