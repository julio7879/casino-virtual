export type PlinkoRisk = "low" | "medium" | "high";

// Multipliers per row count and risk level for Plinko bins
export const PLINKO_MULTIPLIERS: Record<PlinkoRisk, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export function simulatePlinkoPath(rows: number): { path: number[]; binIndex: number } {
  const path: number[] = [];
  let position = 0; // starts at top center

  for (let r = 0; r < rows; r++) {
    // 0 = bounce left (-0.5), 1 = bounce right (+0.5)
    const direction = Math.random() < 0.5 ? 0 : 1;
    path.push(direction);
    position += direction;
  }

  // Final bin index is the number of right bounces (from 0 to rows)
  return { path, binIndex: position };
}

export function getPlinkoMultiplier(risk: PlinkoRisk, rows: number, binIndex: number): number {
  const mults = PLINKO_MULTIPLIERS[risk]?.[rows] || PLINKO_MULTIPLIERS.medium[8];
  return mults[binIndex] ?? 1;
}
