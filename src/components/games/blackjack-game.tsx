"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import {
  Card,
  buildShoe,
  dealerShouldHit,
  handTotals,
  isBlackjack,
  settlePlayer,
  HandResult,
} from "@/lib/engine/blackjack";

export default function BlackjackGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [shoe, setShoe] = useState<Card[]>(() => buildShoe(4));
  const [inRound, setInRound] = useState<boolean>(false);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [doubled, setDoubled] = useState<boolean>(false);
  const [dealerHoleHidden, setDealerHoleHidden] = useState<boolean>(true);
  const [roundResult, setRoundResult] = useState<{
    result: HandResult;
    payout: number;
    message: string;
  } | null>(null);

  const drawCard = (currentShoe: Card[]) => {
    let s = [...currentShoe];
    if (s.length < 20) {
      s = buildShoe(4);
    }
    const card = s.pop()!;
    return { card, remainingShoe: s };
  };

  const dealInitialHand = () => {
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "blackjack", "Blackjack 21 Pro");
    if (!ok) return;

    sounds.playDeal();
    let s = [...shoe];
    const p1 = drawCard(s); s = p1.remainingShoe;
    const d1 = drawCard(s); s = d1.remainingShoe;
    const p2 = drawCard(s); s = p2.remainingShoe;
    const d2 = drawCard(s); s = d2.remainingShoe;

    const newPlayer = [p1.card, p2.card];
    const newDealer = [d1.card, d2.card];

    setShoe(s);
    setPlayerHand(newPlayer);
    setDealerHand(newDealer);
    setDoubled(false);
    setDealerHoleHidden(true);
    setRoundResult(null);
    setInRound(true);

    // Check immediate player blackjack
    if (isBlackjack(newPlayer)) {
      setTimeout(() => {
        finishRound(newPlayer, newDealer, false);
      }, 700);
    }
  };

  const handleHit = () => {
    if (!inRound) return;
    sounds.playDeal();
    const { card, remainingShoe } = drawCard(shoe);
    setShoe(remainingShoe);
    const updatedHand = [...playerHand, card];
    setPlayerHand(updatedHand);

    const totals = handTotals(updatedHand);
    if (totals.total > 21) {
      // Bust
      finishRound(updatedHand, dealerHand, doubled);
    }
  };

  const handleDouble = () => {
    if (!inRound || playerHand.length !== 2 || bet * 2 > balance) return;
    placeBet(bet, "blackjack", "Blackjack 21 Pro (Doblar)");
    setDoubled(true);
    sounds.playDeal();
    const { card, remainingShoe } = drawCard(shoe);
    setShoe(remainingShoe);
    const updatedHand = [...playerHand, card];
    setPlayerHand(updatedHand);

    setTimeout(() => {
      handleStand(updatedHand, true);
    }, 500);
  };

  const handleStand = (currentPHand = playerHand, isDoubled = doubled) => {
    if (!inRound) return;
    setDealerHoleHidden(false);

    // Dealer draws until 17+
    let curDealer = [...dealerHand];
    let curShoe = [...shoe];

    while (dealerShouldHit(curDealer)) {
      const { card, remainingShoe } = drawCard(curShoe);
      curDealer.push(card);
      curShoe = remainingShoe;
    }

    setShoe(curShoe);
    setDealerHand(curDealer);
    finishRound(currentPHand, curDealer, isDoubled);
  };

  const finishRound = (pHand: Card[], dHand: Card[], isDoubled: boolean) => {
    setDealerHoleHidden(false);
    setInRound(false);

    const settlement = settlePlayer(pHand, dHand, isDoubled);
    const effectiveBet = isDoubled ? bet * 2 : bet;
    const payout = Math.round(effectiveBet * settlement.payoutMult);

    let message = "";
    if (settlement.result === "blackjack") {
      message = "¡BLACKJACK NATURAL! Pagado 3 a 2 👑";
    } else if (settlement.result === "win") {
      message = "¡GANASTE LA MANO! ✨";
    } else if (settlement.result === "bust") {
      message = "Te pasaste de 21 (Bust) 💥";
    } else if (settlement.result === "push") {
      message = "Empate (Push) - Apuesta devuelta 🔄";
    } else {
      message = "La banca gana esta mano ❌";
    }

    setRoundResult({
      result: settlement.result,
      payout,
      message,
    });

    if (payout > 0) {
      awardWin(payout, "blackjack", "Blackjack 21 Pro", settlement.payoutMult);
    } else {
      sounds.playLose();
    }
  };

  const pTotal = handTotals(playerHand);
  const dTotal = handTotals(dealerHoleHidden ? dealerHand.slice(0, 1) : dealerHand);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Felt Casino Table */}
      <div className="relative bg-gradient-to-b from-[#0b3323] via-[#092b1d] to-[#061e14] border-4 border-amber-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl min-h-[480px] flex flex-col justify-between">
        {/* Table Felt Logo */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="text-center font-serif text-white">
            <span className="text-8xl">♠</span>
            <div className="text-2xl font-bold tracking-widest mt-2">
              BLACKJACK PAYS 3 TO 2
            </div>
            <div className="text-sm">Dealer must stand on 17 and must draw to 16</div>
          </div>
        </div>

        {/* Dealer Area */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase font-bold text-emerald-200 tracking-wider">
              Banca (Dealer)
            </span>
            {dealerHand.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-black/40 text-amber-300 font-mono font-bold text-xs">
                {dealerHoleHidden ? `${handTotals([dealerHand[0]]).total} + ?` : dTotal.total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 min-h-[110px]">
            {dealerHand.map((card, idx) => {
              if (idx === 1 && dealerHoleHidden) {
                return (
                  <div
                    key={idx}
                    className="w-18 h-26 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-950 border-2 border-blue-400/50 shadow-xl flex items-center justify-center text-blue-300 text-2xl font-black"
                  >
                    🂠
                  </div>
                );
              }
              return <CardView key={idx} card={card} />;
            })}
          </div>
        </div>

        {/* Center Round Banner */}
        <div className="relative z-10 my-4 text-center">
          {roundResult && (
            <div
              className={`inline-block px-6 py-2.5 rounded-2xl border font-bold text-base shadow-xl animate-in zoom-in-90 ${
                roundResult.payout > (doubled ? bet * 2 : bet)
                  ? "bg-emerald-500/25 border-emerald-400 text-emerald-200"
                  : roundResult.result === "push"
                  ? "bg-blue-500/25 border-blue-400 text-blue-200"
                  : "bg-red-500/25 border-red-400 text-red-200"
              }`}
            >
              {roundResult.message}
            </div>
          )}
        </div>

        {/* Player Area */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-3 min-h-[110px] mb-2">
            {playerHand.map((card, idx) => (
              <CardView key={idx} card={card} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-emerald-200 tracking-wider">
              Tu Mano (Jugador)
            </span>
            {playerHand.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-amber-300 font-mono font-black text-sm">
                {pTotal.total} {pTotal.soft && "(Soft)"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BetSelector
            bet={bet}
            setBet={setBet}
            minBet={20}
            maxBet={10000}
            disabled={inRound}
          />
        </div>

        {/* Action Buttons */}
        <div className="lg:col-span-2 flex items-center gap-3">
          {inRound ? (
            <>
              <button
                onClick={handleHit}
                className="flex-1 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-xl transition active:scale-95 flex flex-col items-center justify-center"
              >
                <span>PEDIR CARTA</span>
                <span className="text-xs text-blue-200 font-medium">Hit</span>
              </button>
              <button
                onClick={() => handleStand()}
                className="flex-1 py-5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-lg rounded-2xl shadow-xl transition active:scale-95 flex flex-col items-center justify-center"
              >
                <span>PLANTARSE</span>
                <span className="text-xs text-red-200 font-medium">Stand</span>
              </button>
              {playerHand.length === 2 && bet * 2 <= balance && (
                <button
                  onClick={handleDouble}
                  className="flex-1 py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-lg rounded-2xl shadow-xl transition active:scale-95 flex flex-col items-center justify-center"
                >
                  <span>DOBLAR (2X)</span>
                  <span className="text-xs text-neutral-800 font-medium">+${formatFichas(bet)}</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={dealInitialHand}
              disabled={bet > balance || bet <= 0}
              className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-40"
            >
              REPARTIR CARTAS (${formatFichas(bet)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CardView({ card }: { card: Card }) {
  const isRed = card.s === "corazones" || card.s === "diamantes";
  const suitIcons: Record<string, string> = {
    picas: "♠",
    corazones: "♥",
    diamantes: "♦",
    treboles: "♣",
  };
  const rankNames: Record<number, string> = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K",
  };
  const displayRank = rankNames[card.r] || String(card.r);

  return (
    <div
      className={`w-18 h-26 rounded-xl bg-white border-2 border-neutral-300 shadow-2xl p-2 flex flex-col justify-between font-mono font-black select-none animate-in zoom-in-75 duration-200 ${
        isRed ? "text-red-600" : "text-neutral-900"
      }`}
    >
      <div className="text-left text-xs leading-none">
        <div>{displayRank}</div>
        <div className="text-xs">{suitIcons[card.s]}</div>
      </div>
      <div className="text-center text-2xl my-auto">{suitIcons[card.s]}</div>
      <div className="text-right text-xs leading-none rotate-180">
        <div>{displayRank}</div>
        <div className="text-xs">{suitIcons[card.s]}</div>
      </div>
    </div>
  );
}
