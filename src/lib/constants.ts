export const APP_NAME = "Nogal";
export const LEGAL_LINE =
  "Solo mayores de 18 años. Fichas sin valor monetario.";
export const WELCOME_BONUS = 10_000;
export const RESCUE_BONUS = 1_000;
export const MIN_BET_DEFAULT = 10;
export const MAX_BET_DEFAULT = 5_000;
export const SESSION_REMINDER_MS = 60 * 60 * 1000;
export const CRASH_GROWTH = 0.06;
export const CRASH_COUNTDOWN_MS = 5_000;
export const CRASH_MAX_MULT = 1_000;
export const DEFAULT_TZ = "America/Bogota";

export const DAILY_STREAK: Record<number, number> = {
  1: 500,
  2: 600,
  3: 700,
  4: 800,
  5: 900,
  6: 1_000,
  7: 1_000,
};

export function dailyAmountForStreak(racha: number): number {
  if (racha >= 7) return 1_000;
  return DAILY_STREAK[racha] ?? 500;
}
