export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Suit = "picas" | "corazones" | "diamantes" | "treboles";
export type Card = { r: Rank; s: Suit };

const SUITS: Suit[] = ["picas", "corazones", "diamantes", "treboles"];

export function cardValue(rank: Rank): number {
  if (rank === 1) return 11;
  if (rank >= 10) return 10;
  return rank;
}

export function handTotals(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 1) {
      aces += 1;
      total += 11;
    } else {
      total += cardValue(c.r);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotals(cards).total === 21;
}

export function buildShoe(decks = 6): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (let r = 1; r <= 13; r++) {
        cards.push({ r: r as Rank, s });
      }
    }
  }
  return cards;
}

export function shouldShuffle(remaining: number, total = 312): boolean {
  return remaining / total <= 0.25;
}

export type HandResult = "blackjack" | "win" | "lose" | "push" | "bust";

export function settlePlayer(
  player: Card[],
  dealer: Card[],
  doubled: boolean,
): { result: HandResult; payoutMult: number } {
  const p = handTotals(player).total;
  const d = handTotals(dealer).total;
  const pBj = isBlackjack(player);
  const dBj = isBlackjack(dealer);

  if (p > 21) return { result: "bust", payoutMult: 0 };
  if (pBj && !dBj) return { result: "blackjack", payoutMult: doubled ? 2 : 2.5 };
  if (dBj && !pBj) return { result: "lose", payoutMult: 0 };
  if (pBj && dBj) return { result: "push", payoutMult: 1 };
  if (d > 21) return { result: "win", payoutMult: 2 };
  if (p > d) return { result: "win", payoutMult: 2 };
  if (p < d) return { result: "lose", payoutMult: 0 };
  return { result: "push", payoutMult: 1 };
}

export function dealerShouldHit(dealer: Card[]): boolean {
  const { total } = handTotals(dealer);
  return total < 17;
}

export function canSplit(cards: Card[]): boolean {
  return cards.length === 2 && cardValue(cards[0].r) === cardValue(cards[1].r);
}
