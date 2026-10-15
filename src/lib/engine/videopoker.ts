import { Card, Rank, Suit } from "./blackjack";

export type PokerHandRank =
  | "royal_flush"
  | "straight_flush"
  | "four_of_a_kind"
  | "full_house"
  | "flush"
  | "straight"
  | "three_of_a_kind"
  | "two_pair"
  | "jacks_or_better"
  | "high_card";

export const POKER_PAYOUTS: Record<PokerHandRank, { name: string; multiplier: number }> = {
  royal_flush: { name: "Flor Imperial (Royal Flush)", multiplier: 250 },
  straight_flush: { name: "Escalera de Color", multiplier: 50 },
  four_of_a_kind: { name: "Póker (4 Iguales)", multiplier: 25 },
  full_house: { name: "Full House", multiplier: 9 },
  flush: { name: "Color (Flush)", multiplier: 6 },
  straight: { name: "Escalera (Straight)", multiplier: 4 },
  three_of_a_kind: { name: "Trío (3 Iguales)", multiplier: 3 },
  two_pair: { name: "Doble Pareja", multiplier: 2 },
  jacks_or_better: { name: "Pareja de Jotas o Mejor", multiplier: 1 },
  high_card: { name: "Sin Premio", multiplier: 0 },
};

const ALL_SUITS: Suit[] = ["picas", "corazones", "diamantes", "treboles"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of ALL_SUITS) {
    for (let r = 1; r <= 13; r++) {
      deck.push({ r: r as Rank, s });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function evaluatePokerHand(cards: Card[]): { rank: PokerHandRank; name: string; multiplier: number } {
  if (cards.length !== 5) {
    return { rank: "high_card", ...POKER_PAYOUTS.high_card };
  }

  // Rank values for poker: Ace is high (14) or low (1)
  const ranks = cards.map((c) => (c.r === 1 ? 14 : c.r)).sort((a, b) => a - b);
  const suits = cards.map((c) => c.s);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight
  let isStraight = false;
  // Standard straight check
  let sequential = true;
  for (let i = 0; i < 4; i++) {
    if (ranks[i + 1] !== ranks[i] + 1) {
      sequential = false;
      break;
    }
  }
  if (sequential) isStraight = true;

  // Ace-low straight check: A, 2, 3, 4, 5 => [2, 3, 4, 5, 14]
  if (!isStraight && ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14) {
    isStraight = true;
  }

  // Count frequencies
  const counts: Record<number, number> = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }
  const freq = Object.values(counts).sort((a, b) => b - a);

  // Royal flush: 10, J, Q, K, A of same suit
  if (isFlush && isStraight && ranks[4] === 14 && ranks[0] === 10) {
    return { rank: "royal_flush", ...POKER_PAYOUTS.royal_flush };
  }

  // Straight flush
  if (isFlush && isStraight) {
    return { rank: "straight_flush", ...POKER_PAYOUTS.straight_flush };
  }

  // Four of a kind
  if (freq[0] === 4) {
    return { rank: "four_of_a_kind", ...POKER_PAYOUTS.four_of_a_kind };
  }

  // Full house
  if (freq[0] === 3 && freq[1] === 2) {
    return { rank: "full_house", ...POKER_PAYOUTS.full_house };
  }

  // Flush
  if (isFlush) {
    return { rank: "flush", ...POKER_PAYOUTS.flush };
  }

  // Straight
  if (isStraight) {
    return { rank: "straight", ...POKER_PAYOUTS.straight };
  }

  // Three of a kind
  if (freq[0] === 3) {
    return { rank: "three_of_a_kind", ...POKER_PAYOUTS.three_of_a_kind };
  }

  // Two pair
  if (freq[0] === 2 && freq[1] === 2) {
    return { rank: "two_pair", ...POKER_PAYOUTS.two_pair };
  }

  // Jacks or Better: One pair of Jacks (11), Queens (12), Kings (13), or Aces (14)
  if (freq[0] === 2) {
    const pairRank = Number(Object.keys(counts).find((k) => counts[Number(k)] === 2));
    if (pairRank >= 11) {
      return { rank: "jacks_or_better", ...POKER_PAYOUTS.jacks_or_better };
    }
  }

  return { rank: "high_card", ...POKER_PAYOUTS.high_card };
}
