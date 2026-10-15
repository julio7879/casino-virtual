import { Card, Rank, Suit } from "./blackjack";

export type BaccaratBetType = "player" | "banker" | "tie" | "player_pair" | "banker_pair";

export const BACCARAT_PAYOUTS: Record<BaccaratBetType, number> = {
  player: 2.0, // 1:1 payout (returns 2x bet)
  banker: 1.95, // 0.95:1 payout (5% commission, returns 1.95x bet)
  tie: 9.0, // 8:1 payout (returns 9x bet)
  player_pair: 12.0, // 11:1
  banker_pair: 12.0, // 11:1
};

export function baccaratCardValue(c: Card): number {
  if (c.r >= 10) return 0;
  return c.r; // Ace is 1, 2-9 are face value
}

export function baccaratHandTotal(cards: Card[]): number {
  const sum = cards.reduce((acc, c) => acc + baccaratCardValue(c), 0);
  return sum % 10;
}

export type BaccaratRoundResult = {
  playerCards: Card[];
  bankerCards: Card[];
  playerScore: number;
  bankerScore: number;
  winner: "player" | "banker" | "tie";
  playerPair: boolean;
  bankerPair: boolean;
};

export function playBaccaratRound(deck: Card[]): { result: BaccaratRoundResult; remainingDeck: Card[] } {
  let d = [...deck];
  if (d.length < 10) {
    const SUITS: Suit[] = ["picas", "corazones", "diamantes", "treboles"];
    d = [];
    for (let deckCount = 0; deckCount < 6; deckCount++) {
      for (const s of SUITS) {
        for (let r = 1; r <= 13; r++) {
          d.push({ r: r as Rank, s });
        }
      }
    }
    // Shuffle
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
  }

  const drawCard = (): Card => d.pop()!;

  // Initial deal
  const p1 = drawCard();
  const b1 = drawCard();
  const p2 = drawCard();
  const b2 = drawCard();

  const playerCards: Card[] = [p1, p2];
  const bankerCards: Card[] = [b1, b2];

  let pScore = baccaratHandTotal(playerCards);
  let bScore = baccaratHandTotal(bankerCards);

  const playerPair = p1.r === p2.r;
  const bankerPair = b1.r === b2.r;

  // Check Naturals (8 or 9)
  const isNatural = pScore >= 8 || bScore >= 8;

  if (!isNatural) {
    // Player third card rule
    let p3: Card | null = null;
    if (pScore <= 5) {
      p3 = drawCard();
      playerCards.push(p3);
      pScore = baccaratHandTotal(playerCards);
    }

    // Banker third card rule
    if (p3 === null) {
      // Player stood on 6 or 7
      if (bScore <= 5) {
        bankerCards.push(drawCard());
        bScore = baccaratHandTotal(bankerCards);
      }
    } else {
      // Player drew 3rd card
      const p3Val = baccaratCardValue(p3);
      if (bScore <= 2) {
        bankerCards.push(drawCard());
      } else if (bScore === 3 && p3Val !== 8) {
        bankerCards.push(drawCard());
      } else if (bScore === 4 && [2, 3, 4, 5, 6, 7].includes(p3Val)) {
        bankerCards.push(drawCard());
      } else if (bScore === 5 && [4, 5, 6, 7].includes(p3Val)) {
        bankerCards.push(drawCard());
      } else if (bScore === 6 && [6, 7].includes(p3Val)) {
        bankerCards.push(drawCard());
      }
      bScore = baccaratHandTotal(bankerCards);
    }
  }

  let winner: "player" | "banker" | "tie" = "tie";
  if (pScore > bScore) winner = "player";
  else if (bScore > pScore) winner = "banker";

  return {
    result: {
      playerCards,
      bankerCards,
      playerScore: pScore,
      bankerScore: bScore,
      winner,
      playerPair,
      bankerPair,
    },
    remainingDeck: d,
  };
}
