import { CRASH_GROWTH, CRASH_MAX_MULT } from "@/lib/constants";

export function crashPoint(houseEdge: number, r: number): number {
  const clamped = Math.min(Math.max(r, 0), 0.999999999999);
  const raw = Math.floor((100 * (1 - houseEdge)) / (1 - clamped)) / 100;
  return Math.min(CRASH_MAX_MULT, Math.max(1, raw));
}

export function multiplierAt(tSeconds: number, growth = CRASH_GROWTH): number {
  return Math.exp(growth * Math.max(0, tSeconds));
}

export function secondsToReach(multiplier: number, growth = CRASH_GROWTH): number {
  return Math.log(Math.max(1, multiplier)) / growth;
}

export function survivalProbability(houseEdge: number, m: number): number {
  return (1 - houseEdge) / m;
}
