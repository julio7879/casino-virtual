"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { Card } from "@/lib/engine/blackjack";
import {
  BACCARAT_PAYOUTS,
  BaccaratBetType,
  BaccaratRoundResult,
  playBaccaratRound,
} from "@/lib/engine/baccarat";

export default function BaccaratGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [selectedBet, setSelectedBet] = useState<BaccaratBetType>("player");
  const [deck, setDeck] = useState<Card[]>([]);
  const [dealing, setDealing] = useState<boolean>(false);
  const [roundResult, setRoundResult] = useState<BaccaratRoundResult | null>(null);
  const [payoutResult, setPayoutResult] = useState<{
    won: boolean;
    payout: number;
    message: string;
  } | null>(null);

  const handleDeal = () => {
    if (dealing) return;
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "baccarat", "Baccarat Punto y Banca");
    if (!ok) return;

    sounds.playDeal();
    setDealing(true);
    setPayoutResult(null);

    setTimeout(() => {
      const { result, remainingDeck } = playBaccaratRound(deck);
      setDeck(remainingDeck);
      setRoundResult(result);
      setDealing(false);

      // Determine win
      let won = false;
      let mult = 0;

      if (selectedBet === "player" && result.winner === "player") {
        won = true;
        mult = BACCARAT_PAYOUTS.player;
      } else if (selectedBet === "banker" && result.winner === "banker") {
        won = true;
        mult = BACCARAT_PAYOUTS.banker;
      } else if (selectedBet === "tie" && result.winner === "tie") {
        won = true;
        mult = BACCARAT_PAYOUTS.tie;
      } else if (selectedBet === "player_pair" && result.playerPair) {
        won = true;
        mult = BACCARAT_PAYOUTS.player_pair;
      } else if (selectedBet === "banker_pair" && result.bankerPair) {
        won = true;
        mult = BACCARAT_PAYOUTS.banker_pair;
      }

      const payout = won ? Math.round(bet * mult) : 0;

      setPayoutResult({
        won,
        payout,
        message: won
          ? `¡Victoria en ${selectedBet.toUpperCase()}! Ganaste $${formatFichas(payout)}`
          : `Gana ${result.winner.toUpperCase()} (${result.playerScore} vs ${result.bankerScore})`,
      });

      if (won) {
        awardWin(payout, "baccarat", "Baccarat Punto y Banca", mult);
      } else {
        sounds.playLose();
      }
    }, 1500);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Felt Tableau */}
      <div className="bg-gradient-to-b from-[#18120c] via-[#21170d] to-[#0d0905] border-4 border-amber-700/60 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col justify-between min-h-[460px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-600/20 pb-3 mb-6">
          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <span>👑</span>
            <span>BACCARAT ROYALE (PUNTO Y BANCA)</span>
          </span>
          <span className="text-xs text-neutral-400">RTP: 98.9%</span>
        </div>

        {/* Both Hands (Player vs Banker) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 my-auto">
          {/* Player Hand */}
          <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-5 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase font-bold text-blue-300 tracking-wider">
                PUNTO (JUGADOR)
              </span>
              {roundResult && (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-black text-sm">
                  {roundResult.playerScore} Pts
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 min-h-[110px]">
              {roundResult?.playerCards.map((card, idx) => (
                <CardViewMini key={idx} card={card} />
              ))}
              {!roundResult && (
                <div className="text-xs text-neutral-400 italic">Esperando tirada...</div>
              )}
            </div>
          </div>

          {/* Banker Hand */}
          <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-5 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase font-bold text-red-300 tracking-wider">
                BANCA (BANKER)
              </span>
              {roundResult && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono font-black text-sm">
                  {roundResult.bankerScore} Pts
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 min-h-[110px]">
              {roundResult?.bankerCards.map((card, idx) => (
                <CardViewMini key={idx} card={card} />
              ))}
              {!roundResult && (
                <div className="text-xs text-neutral-400 italic">Esperando tirada...</div>
              )}
            </div>
          </div>
        </div>

        {/* Result notification */}
        {payoutResult && (
          <div
            className={`mt-4 py-3 px-6 rounded-2xl border font-bold text-center text-sm shadow-xl animate-in zoom-in-75 ${
              payoutResult.won
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                : "bg-neutral-800 border-neutral-700 text-neutral-300"
            }`}
          >
            {payoutResult.message}
          </div>
        )}
      </div>

      {/* Betting Options */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          disabled={dealing}
          onClick={() => setSelectedBet("player")}
          className={`py-4 rounded-2xl border flex flex-col items-center justify-center transition ${
            selectedBet === "player"
              ? "bg-blue-600/30 border-blue-400 text-white ring-2 ring-blue-400/50"
              : "bg-[#141824] border-neutral-800 text-neutral-300 hover:bg-[#1d2335]"
          }`}
        >
          <span className="font-bold text-sm">PUNTO</span>
          <span className="text-xs text-amber-400 font-mono font-bold mt-0.5">Paga 1 a 1 (2.0x)</span>
        </button>

        <button
          type="button"
          disabled={dealing}
          onClick={() => setSelectedBet("tie")}
          className={`py-4 rounded-2xl border flex flex-col items-center justify-center transition ${
            selectedBet === "tie"
              ? "bg-emerald-600/30 border-emerald-400 text-white ring-2 ring-emerald-400/50"
              : "bg-[#141824] border-neutral-800 text-neutral-300 hover:bg-[#1d2335]"
          }`}
        >
          <span className="font-bold text-sm">EMPATE</span>
          <span className="text-xs text-amber-400 font-mono font-bold mt-0.5">Paga 8 a 1 (9.0x)</span>
        </button>

        <button
          type="button"
          disabled={dealing}
          onClick={() => setSelectedBet("banker")}
          className={`py-4 rounded-2xl border flex flex-col items-center justify-center transition ${
            selectedBet === "banker"
              ? "bg-red-600/30 border-red-400 text-white ring-2 ring-red-400/50"
              : "bg-[#141824] border-neutral-800 text-neutral-300 hover:bg-[#1d2335]"
          }`}
        >
          <span className="font-bold text-sm">BANCA</span>
          <span className="text-xs text-amber-400 font-mono font-bold mt-0.5">Paga 0.95 a 1 (1.95x)</span>
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BetSelector
            bet={bet}
            setBet={setBet}
            minBet={25}
            maxBet={10000}
            disabled={dealing}
          />
        </div>

        <div className="lg:col-span-2 flex items-center">
          <button
            onClick={handleDeal}
            disabled={dealing || bet > balance || bet <= 0}
            className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-40"
          >
            {dealing ? "REPARTIENDO..." : `REPARTIR BACCARAT ($${formatFichas(bet)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardViewMini({ card }: { card: Card }) {
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
      className={`w-14 h-20 rounded-xl bg-white border border-neutral-300 shadow-md p-1.5 flex flex-col justify-between font-mono font-black select-none ${
        isRed ? "text-red-600" : "text-neutral-900"
      }`}
    >
      <div className="text-left text-[11px] leading-none">
        <div>{displayRank}</div>
        <div className="text-[10px]">{suitIcons[card.s]}</div>
      </div>
      <div className="text-center text-lg my-auto">{suitIcons[card.s]}</div>
    </div>
  );
}
