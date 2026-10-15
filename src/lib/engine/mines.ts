export const MINES_TILES = 25;

export function survivalProbability(mines: number, safeRevealed: number): number {
  let p = 1;
  for (let i = 0; i < safeRevealed; i++) {
    p *= (MINES_TILES - mines - i) / (MINES_TILES - i);
  }
  return p;
}

export function minesMultiplier(
  houseEdge: number,
  mines: number,
  safeRevealed: number,
): number {
  if (safeRevealed <= 0) return 1;
  const p = survivalProbability(mines, safeRevealed);
  return (1 - houseEdge) / p;
}

export function placeMines(mines: number, positions: number[]): number[] {
  return positions.slice(0, mines);
}
