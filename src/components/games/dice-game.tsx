"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import {
  DiceBet,
  DiceBetType,
  evaluateDiceBet,
  rollDice,
} from "@/lib/engine/dice";

export default function DiceGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [selectedBetType, setSelectedBetType] = useState<DiceBetType>("over_7");
  const [exactTarget, setExactTarget] = useState<number>(7);
  const [dice, setDice] = useState<[number, number]>([3, 4]);
  const [rolling, setRolling] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    win: boolean;
    multiplier: number;
    payout: number;
    sum: number;
  } | null>(null);

  const handleRoll = () => {
    if (rolling) return;
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "dice", "Dados Hi-Lo Royale");
    if (!ok) return;

    setRolling(true);
    setLastResult(null);

    // Audio rattle
    let ticks = 0;
    const interval = setInterval(() => {
      sounds.playSpinTick();
      ticks++;
      if (ticks > 8) clearInterval(interval);
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      const [d1, d2] = rollDice();
      setDice([d1, d2]);
      setRolling(false);

      const diceBet: DiceBet = {
        type: selectedBetType,
        exactTarget,
        amount: bet,
      };

      const outcome = evaluateDiceBet(diceBet, d1, d2);
      setLastResult({
        ...outcome,
        sum: d1 + d2,
      });

      if (outcome.win) {
        awardWin(outcome.payout, "dice", "Dados Hi-Lo Royale", outcome.multiplier);
      } else {
        sounds.playLose();
      }
    }, 1200);
  };

  const pipPositions: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Dice Stage */}
      <div className="bg-gradient-to-b from-[#1b152b] to-[#0d0917] border-4 border-purple-800/60 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col items-center justify-center">
        {/* The Two 3D Dice */}
        <div className="flex items-center gap-6 sm:gap-10 my-4">
          {[dice[0], dice[1]].map((val, idx) => (
            <div
              key={idx}
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white border-4 border-neutral-300 shadow-2xl grid grid-cols-3 p-3 gap-1 transition-transform duration-300 ${
                rolling ? "animate-spin" : "hover:scale-105"
              }`}
            >
              {Array.from({ length: 9 }).map((_, pIdx) => {
                const hasPip = pipPositions[val]?.includes(pIdx);
                return (
                  <div key={pIdx} className="flex items-center justify-center">
                    {hasPip && (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-neutral-900 shadow-inner" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Dice Sum */}
        <div className="mt-4 flex flex-col items-center">
          <span className="text-xs uppercase font-bold text-neutral-400 tracking-widest">
            Suma Total
          </span>
          <span className="text-4xl font-mono font-black text-amber-400 mt-1">
            {dice[0] + dice[1]}
          </span>
        </div>

        {/* Outcome banner */}
        {lastResult && (
          <div
            className={`mt-4 px-6 py-2.5 rounded-2xl border font-bold text-sm shadow-xl animate-in zoom-in-75 ${
              lastResult.win
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                : "bg-red-500/20 border-red-400 text-red-200"
            }`}
          >
            {lastResult.win
              ? `¡GANASTE! Payout de $${formatFichas(lastResult.payout)} (${lastResult.multiplier}x)`
              : "No acertaste la combinación en este tiro."}
          </div>
        )}
      </div>

      {/* Betting Options Grid */}
      <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-2xl">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-3">
          Elige tu Pronóstico de Dados
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {[
            { type: "under_7" as DiceBetType, label: "Menor a 7 (2 al 6)", mult: "2.3x" },
            { type: "exact_7" as DiceBetType, label: "Siete Exacto (7)", mult: "5.8x" },
            { type: "over_7" as DiceBetType, label: "Mayor a 7 (8 al 12)", mult: "2.3x" },
            { type: "any_double" as DiceBetType, label: "Cualquier Doble", mult: "3.5x" },
            { type: "even" as DiceBetType, label: "Suma PAR", mult: "1.95x" },
            { type: "odd" as DiceBetType, label: "Suma IMPAR", mult: "1.95x" },
          ].map((item) => (
            <button
              key={item.type}
              type="button"
              disabled={rolling}
              onClick={() => setSelectedBetType(item.type)}
              className={`p-3 rounded-2xl border flex flex-col justify-between transition ${
                selectedBetType === item.type
                  ? "bg-purple-600/30 border-purple-400 text-white ring-2 ring-purple-400/50"
                  : "bg-[#141824] border-neutral-800 text-neutral-300 hover:bg-[#1d2335]"
              }`}
            >
              <span className="text-xs font-bold">{item.label}</span>
              <span className="text-sm font-mono font-bold text-amber-400 mt-1">
                {item.mult}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BetSelector
            bet={bet}
            setBet={setBet}
            minBet={10}
            maxBet={5000}
            disabled={rolling}
          />
        </div>

        <div className="lg:col-span-2 flex items-center">
          <button
            onClick={handleRoll}
            disabled={rolling || bet > balance || bet <= 0}
            className="w-full py-5 bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-500 hover:from-purple-500 text-white font-black text-xl rounded-2xl transition shadow-xl shadow-purple-500/25 active:scale-95 disabled:opacity-40"
          >
            {rolling ? "LANZANDO DADOS..." : `LANZAR DADOS ($${formatFichas(bet)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
