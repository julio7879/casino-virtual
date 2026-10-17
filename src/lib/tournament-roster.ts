"use client";

import {
  PARTICIPANT_COLORS,
  PlayerParticipant,
  DEFAULT_COMPETITORS,
} from "@/components/games/shared/participant-input";

export const ROSTER_STORAGE_KEY = "casino_saved_tournament_roster";
export const ROSTER_UPDATED_EVENT = "casino_tournament_roster_updated";

/**
 * Gets the persisted list of tournament participant names from localStorage.
 * Falls back to DEFAULT_COMPETITORS if nothing is saved or if on server.
 */
export function getSavedTournamentNames(): string[] {
  if (typeof window === "undefined") return DEFAULT_COMPETITORS;
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return DEFAULT_COMPETITORS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed
        .map((n) => (typeof n === "string" ? n.trim() : ""))
        .filter((n) => n.length > 0);
      if (cleaned.length > 0) return cleaned;
    }
  } catch (err) {
    console.warn("Error reading tournament roster from localStorage:", err);
  }
  return DEFAULT_COMPETITORS;
}

/**
 * Persists a list of participant names to localStorage and notifies other components.
 */
export function saveTournamentNames(names: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const unique = Array.from(
      new Set(
        names
          .map((n) => (typeof n === "string" ? n.trim() : ""))
          .filter((n) => n.length > 0)
      )
    );
    const toSave = unique.length > 0 ? unique : DEFAULT_COMPETITORS;
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(toSave));
    window.dispatchEvent(
      new CustomEvent(ROSTER_UPDATED_EVENT, { detail: toSave })
    );
  } catch (err) {
    console.warn("Error saving tournament roster to localStorage:", err);
  }
}

/**
 * Resets the tournament names back to the default sample competitors and saves to localStorage.
 */
export function resetSavedTournamentNames(): string[] {
  if (typeof window === "undefined") return DEFAULT_COMPETITORS;
  try {
    localStorage.setItem(
      ROSTER_STORAGE_KEY,
      JSON.stringify(DEFAULT_COMPETITORS)
    );
    window.dispatchEvent(
      new CustomEvent(ROSTER_UPDATED_EVENT, { detail: DEFAULT_COMPETITORS })
    );
  } catch (err) {
    console.warn("Error resetting tournament roster:", err);
  }
  return DEFAULT_COMPETITORS;
}

/**
 * Helper to build PlayerParticipant array with colors and IDs from a list of names.
 */
export function buildParticipantsFromNames(
  names: string[],
  idPrefix = "p",
  maxCount?: number
): PlayerParticipant[] {
  const slice = maxCount ? names.slice(0, maxCount) : names;
  return slice.map((name, idx) => ({
    id: `${idPrefix}-${idx}-${Date.now()}`,
    name,
    color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
  }));
}
