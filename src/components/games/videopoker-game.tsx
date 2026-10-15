"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { Card } from "@/lib/engine/blackjack";
import {
  createDeck,
  evaluatePokerHand,
  POKER_PAYOUTS,
  PokerHandRank,
} from "@/lib/engine/videopoker";

export default function VideoPokerGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [stage, setStage] = useState<"idle" | "held" | "finished">("idle");
  const [hand, setHand] = useState<Card[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [heldIndices, setHeldIndices] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<{
    rank: PokerHandRank;
    name: string;
    multiplier: number;
    payout: number;
  } | null>(null);

  const handleDeal = () => {
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "videopoker", "Video Poker Jacks+");
    if (!ok) return;

    sounds.playDeal();
    const newDeck = createDeck();
    const dealtCards = newDeck.slice(0, 5);
    const remainingDeck = newDeck.slice(5);

    setHand(dealtCards);
    setDeck(remainingDeck);
    setHeldIndices(new Set());
    setResult(null);
    setStage("held");
  };

  const toggleHold = (index: number) => {
    if (stage !== "held") return;
    sounds.playClick();
    setHeldIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleDraw = () => {
    if (stage !== "held") return;
    sounds.playDeal();

    const currentDeck = [...deck];
    const finalHand = hand.map((card, idx) => {
      if (heldIndices.has(idx)) return card;
      return currentDeck.pop()!;
    });

    setHand(finalHand);
    setDeck(currentDeck);
    setStage("finished");

    const handEval = evaluatePokerHand(finalHand);
    const payout = Math.round(bet * handEval.multiplier);

    setResult({
      ...handEval,
      payout,
    });

    if (payout > 0) {
      awardWin(payout, "videopoker", "Video Poker Jacks+", handEval.multiplier);
    } else {
      sounds.playLose();
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Paytable Board */}
      <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-2xl">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
          Tabla de Pagos (Jacks or Better)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
          {Object.entries(POKER_PAYOUTS)
            .filter(([k]) => k !== "high_card")
            .map(([key, info]) => {
              const isMatch = result?.rank === key;
              return (
                <div
                  key={key}
                  className={`p-2 rounded-xl border flex flex-col justify-between transition ${
                    isMatch
                      ? "bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400"
                      : "bg-[#141824] border-neutral-800 text-neutral-300"
                  }`}
                >
                  <span className="font-semibold">{info.name}</span>
                  <span className="font-mono font-bold text-amber-400 mt-1">
                    {info.multiplier}x
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Cards Felt Area */}
      <div className="bg-gradient-to-b from-[#101b38] to-[#0a1024] border-4 border-blue-900/60 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center">
        <div className="grid grid-cols-5 gap-2 sm:gap-4 max-w-3xl w-full mb-6">
          {Array.from({ length: 5 }).map((_, idx) => {
            const card = hand[idx];
            const isHeld = heldIndices.has(idx);

            if (!card) {
              return (
                <div
                  key={idx}
                  className="aspect-[5/7] rounded-2xl border-2 border-dashed border-blue-500/30 bg-blue-950/20 flex items-center justify-center text-blue-400/40 text-2xl font-bold"
                >
                  ?
                </div>
              );
            }

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
              <button
                key={idx}
                type="button"
                onClick={() => toggleHold(idx)}
                disabled={stage !== "held"}
                className={`relative aspect-[5/7] rounded-2xl border-2 p-2 sm:p-3 flex flex-col justify-between font-mono font-black transition-all select-none shadow-xl ${
                  isHeld
                    ? "bg-amber-50 border-amber-400 -translate-y-2 ring-4 ring-amber-400/50"
                    : "bg-white border-neutral-300 hover:-translate-y-1"
                } ${isRed ? "text-red-600" : "text-neutral-900"}`}
              >
                {/* Hold Badge */}
                {isHeld && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500 text-black font-sans font-black text-[10px] tracking-wider uppercase shadow">
                    MANTENIDO
                  </span>
                )}
                <div className="text-left text-xs sm:text-sm leading-none">
                  <div>{displayRank}</div>
                  <div className="text-xs">{suitIcons[card.s]}</div>
                </div>
                <div className="text-center text-2xl sm:text-3xl my-auto">
                  {suitIcons[card.s]}
                </div>
                <div className="text-right text-xs sm:text-sm leading-none rotate-180">
                  <div>{displayRank}</div>
                  <div className="text-xs">{suitIcons[card.s]}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Hand Result Message */}
        {result && (
          <div
            className={`px-6 py-3 rounded-2xl border font-bold text-base shadow-xl animate-in zoom-in-75 ${
              result.payout > 0
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                : "bg-neutral-800 border-neutral-700 text-neutral-400"
            }`}
          >
            {result.payout > 0
              ? `¡${result.name}! Ganaste $${formatFichas(result.payout)} (${result.multiplier}x)`
              : "Sin combinación ganadora."}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BetSelector
            bet={bet}
            setBet={setBet}
            minBet={10}
            maxBet={5000}
            disabled={stage === "held"}
          />
        </div>

        <div className="lg:col-span-2 flex items-center">
          {stage === "held" ? (
            <button
              onClick={handleDraw}
              className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-emerald-500/25 active:scale-95"
            >
              DESCARTAR Y ROBAR ({heldIndices.size} MANTENIDAS)
            </button>
          ) : (
            <button
              onClick={handleDeal}
              disabled={bet > balance || bet <= 0}
              className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-40"
            >
              REPARTIR 5 CARTAS (${formatFichas(bet)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
