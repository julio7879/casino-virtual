export type DiceBetType =
  | "under_7"
  | "exact_7"
  | "over_7"
  | "any_double"
  | "even"
  | "odd"
  | "exact_sum";

export type DiceBet = {
  type: DiceBetType;
  exactTarget?: number; // 2 to 12
  amount: number;
};

export const DICE_PAYOUTS: Record<DiceBetType, number> = {
  under_7: 2.3, // Payout multiplier (total returned = bet * 2.3)
  exact_7: 5.8,
  over_7: 2.3,
  any_double: 3.5,
  even: 1.95,
  odd: 1.95,
  exact_sum: 0, // dynamic based on target
};

export const EXACT_SUM_PAYOUTS: Record<number, number> = {
  2: 32.0,
  3: 16.0,
  4: 10.5,
  5: 8.0,
  6: 6.5,
  7: 5.8,
  8: 6.5,
  9: 8.0,
  10: 10.5,
  11: 16.0,
  12: 32.0,
};

export function rollDice(): [number, number] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

export function evaluateDiceBet(bet: DiceBet, d1: number, d2: number): { win: boolean; multiplier: number; payout: number } {
  const sum = d1 + d2;
  const isDouble = d1 === d2;
  let win = false;
  let multiplier = 0;

  switch (bet.type) {
    case "under_7":
      win = sum < 7;
      multiplier = DICE_PAYOUTS.under_7;
      break;
    case "exact_7":
      win = sum === 7;
      multiplier = DICE_PAYOUTS.exact_7;
      break;
    case "over_7":
      win = sum > 7;
      multiplier = DICE_PAYOUTS.over_7;
      break;
    case "any_double":
      win = isDouble;
      multiplier = DICE_PAYOUTS.any_double;
      break;
    case "even":
      win = sum % 2 === 0;
      multiplier = DICE_PAYOUTS.even;
      break;
    case "odd":
      win = sum % 2 !== 0;
      multiplier = DICE_PAYOUTS.odd;
      break;
    case "exact_sum":
      win = sum === bet.exactTarget;
      multiplier = EXACT_SUM_PAYOUTS[bet.exactTarget ?? 7] ?? 5.8;
      break;
  }

  const payout = win ? Math.round(bet.amount * multiplier) : 0;
  return { win, multiplier: win ? multiplier : 0, payout };
}
