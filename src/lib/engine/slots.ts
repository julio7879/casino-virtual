export type SlotSymbol = {
  id: string;
  name: string;
  icon: string;
  value: number; // multiplier for 3-of-a-kind
  weight: number; // frequency in reel
  isWild?: boolean;
};

export const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: "cherry", name: "Cerezas", icon: "🍒", value: 3, weight: 10 },
  { id: "lemon", name: "Limón", icon: "🍋", value: 5, weight: 9 },
  { id: "orange", name: "Naranja", icon: "🍊", value: 8, weight: 8 },
  { id: "grape", name: "Uvas", icon: "🍇", value: 12, weight: 7 },
  { id: "bell", name: "Campana", icon: "🔔", value: 20, weight: 5 },
  { id: "bar", name: "BAR Dorado", icon: "🍫", value: 40, weight: 4 },
  { id: "seven", name: "777 de la Suerte", icon: "💎", value: 100, weight: 3 },
  { id: "wild", name: "Estrella WILD", icon: "⭐", value: 250, weight: 2, isWild: true },
];

export const REEL_ROWS = 3;
export const REEL_COLS = 5;

// 5 Standard Paylines across 5 columns:
// 0: Middle horizontal [1, 1, 1, 1, 1]
// 1: Top horizontal [0, 0, 0, 0, 0]
// 2: Bottom horizontal [2, 2, 2, 2, 2]
// 3: V-shape [0, 1, 2, 1, 0]
// 4: Inverted V [2, 1, 0, 1, 2]
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // Centro
  [0, 0, 0, 0, 0], // Superior
  [2, 2, 2, 2, 2], // Inferior
  [0, 1, 2, 1, 0], // Diagonal V
  [2, 1, 0, 1, 2], // Diagonal Invertida
];

export function getRandomSymbol(): SlotSymbol {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  for (const s of SLOT_SYMBOLS) {
    if (random < s.weight) return s;
    random -= s.weight;
  }
  return SLOT_SYMBOLS[0];
}

export function spinGrid(): SlotSymbol[][] {
  // Returns grid[row][col]
  const grid: SlotSymbol[][] = [];
  for (let r = 0; r < REEL_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < REEL_COLS; c++) {
      grid[r][c] = getRandomSymbol();
    }
  }
  return grid;
}

export type LineWin = {
  lineIndex: number;
  symbol: SlotSymbol;
  count: number;
  multiplier: number;
  payout: number;
};

export function evaluateSlots(grid: SlotSymbol[][], betPerLine: number) {
  const lineWins: LineWin[] = [];
  let totalMultiplier = 0;

  PAYLINES.forEach((linePattern, lineIndex) => {
    const lineSymbols = linePattern.map((row, col) => grid[row][col]);
    
    // Check from left to right for matches (Wild matches any regular symbol)
    let baseSymbol: SlotSymbol | null = null;
    let matchCount = 0;

    for (const sym of lineSymbols) {
      if (sym.isWild) {
        matchCount++;
      } else if (!baseSymbol) {
        baseSymbol = sym;
        matchCount++;
      } else if (sym.id === baseSymbol.id) {
        matchCount++;
      } else {
        break;
      }
    }

    const effectiveSymbol = baseSymbol || SLOT_SYMBOLS.find(s => s.isWild)!;

    if (matchCount >= 3) {
      let mult = effectiveSymbol.value;
      if (matchCount === 4) mult *= 2.5;
      if (matchCount === 5) mult *= 6;

      const payout = betPerLine * mult;
      lineWins.push({
        lineIndex,
        symbol: effectiveSymbol,
        count: matchCount,
        multiplier: mult,
        payout,
      });
      totalMultiplier += mult;
    }
  });

  const totalPayout = lineWins.reduce((sum, w) => sum + w.payout, 0);
  return {
    lineWins,
    totalMultiplier,
    totalPayout,
  };
}
