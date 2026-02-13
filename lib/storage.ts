import { AnalysisResponse } from "./types";

const LEGACY_HISTORY_KEY = "structuregpt-history-v1";
const USER_ID_KEY = "structuregpt-user-id-v1";

const HISTORY_KEY_PREFIX = "structuregpt-history-v2:";
const DATE_KEY_PREFIX = "structuregpt-last-clear-date-v2:";
const LIMIT = 20;

const getOrCreateUserId = (): string => {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(USER_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof window.crypto !== "undefined" &&
      "randomUUID" in window.crypto &&
      typeof (window.crypto as Crypto).randomUUID === "function"
        ? (window.crypto as Crypto).randomUUID()
        : `uid_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

    window.localStorage.setItem(USER_ID_KEY, generated);
    return generated;
  } catch (err) {
    console.error("Failed to access local profile id", err);
    return "fallback";
  }
};

const historyKeyForUser = (userId: string) => `${HISTORY_KEY_PREFIX}${userId}`;
const dateKeyForUser = (userId: string) => `${DATE_KEY_PREFIX}${userId}`;

const migrateLegacyHistoryIfNeeded = (userId: string) => {
  if (typeof window === "undefined") return;
  try {
    const legacy = window.localStorage.getItem(LEGACY_HISTORY_KEY);
    if (!legacy) return;

    const scopedKey = historyKeyForUser(userId);
    const alreadyScoped = window.localStorage.getItem(scopedKey);
    if (!alreadyScoped) {
      window.localStorage.setItem(scopedKey, legacy);
    }

    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
  } catch (err) {
    console.error("Failed to migrate legacy history", err);
  }
};

// Check if history should be cleared (daily refresh)
const shouldClearHistory = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const lastClear = window.localStorage.getItem(dateKeyForUser(userId));
    const today = new Date().toDateString();
    
    if (!lastClear || lastClear !== today) {
      window.localStorage.setItem(dateKeyForUser(userId), today);
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
    const userId = getOrCreateUserId();

    // One-time migration from legacy global key
    migrateLegacyHistoryIfNeeded(userId);

    // Clear history if it's a new day
    if (shouldClearHistory(userId)) {
      window.localStorage.removeItem(historyKeyForUser(userId));
      return [];
    }
    
    const raw = window.localStorage.getItem(historyKeyForUser(userId));
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
    const userId = getOrCreateUserId();
    const existing = loadHistory();
    const next = [item, ...existing].slice(0, LIMIT);
    window.localStorage.setItem(historyKeyForUser(userId), JSON.stringify(next));
  } catch (err) {
    console.error("Failed to save history", err);
  }
};
