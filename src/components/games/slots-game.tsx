"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import {
  evaluateSlots,
  getRandomSymbol,
  REEL_COLS,
  REEL_ROWS,
  SLOT_SYMBOLS,
  SlotSymbol,
  spinGrid,
} from "@/lib/engine/slots";

export default function SlotsGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [betPerLine, setBetPerLine] = useState<number>(10);
  const totalBet = betPerLine * 5; // 5 paylines

  const [grid, setGrid] = useState<SlotSymbol[][]>(() => spinGrid());
  const [spinning, setSpinning] = useState<boolean>(false);
  const [winningLines, setWinningLines] = useState<number[]>([]);
  const [lastWinPayout, setLastWinPayout] = useState<number>(0);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(0);

  const handleSpin = () => {
    if (spinning) return;
    if (freeSpinsLeft === 0 && totalBet > balance) {
      sounds.playLose();
      return;
    }

    if (freeSpinsLeft > 0) {
      setFreeSpinsLeft((prev) => prev - 1);
    } else {
      const ok = placeBet(totalBet, "slots", "Neon Fruits 777");
      if (!ok) return;
    }

    setSpinning(true);
    setWinningLines([]);
    setLastWinPayout(0);

    // Audio spin ticks
    let count = 0;
    const interval = setInterval(() => {
      sounds.playSpinTick();
      count++;
      if (count > 16) clearInterval(interval);
    }, 100);

    // After animation delay, resolve final grid
    setTimeout(() => {
      clearInterval(interval);
      const newGrid = spinGrid();
      setGrid(newGrid);

      const evaluation = evaluateSlots(newGrid, betPerLine);
      setSpinning(false);

      if (evaluation.totalPayout > 0) {
        setWinningLines(evaluation.lineWins.map((w) => w.lineIndex));
        setLastWinPayout(evaluation.totalPayout);
        awardWin(
          evaluation.totalPayout,
          "slots",
          "Neon Fruits 777",
          evaluation.totalMultiplier
        );
      } else {
        sounds.playLose();
      }
    }, 1800);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Slot Machine Chassis */}
      <div className="relative bg-gradient-to-b from-[#19152b] via-[#100d1e] to-[#0a0814] border-4 border-fuchsia-600/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-fuchsia-600/10 flex flex-col items-center">
        {/* Neon Slot Header */}
        <div className="w-full flex items-center justify-between mb-4 border-b border-fuchsia-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">🎰</span>
            <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300 text-lg tracking-wider">
              NEON FRUITS 777
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-fuchsia-950/60 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-bold">
              5 LÍNEAS ACTIVAS
            </span>
          </div>
        </div>

        {/* The 5x3 Reels Grid */}
        <div className="relative w-full max-w-2xl bg-[#090710] border-2 border-fuchsia-500/40 rounded-2xl p-3 sm:p-4 shadow-inner mb-6">
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: REEL_COLS }).map((_, col) => (
              <div
                key={col}
                className="flex flex-col gap-2 sm:gap-3 bg-[#151125] border border-neutral-800 rounded-xl p-1.5 sm:p-2"
              >
                {Array.from({ length: REEL_ROWS }).map((_, row) => {
                  const sym = grid[row]?.[col] || SLOT_SYMBOLS[0];
                  return (
                    <div
                      key={row}
                      className={`h-20 sm:h-24 rounded-lg bg-[#1f1936] border border-fuchsia-500/20 flex flex-col items-center justify-center transition-all duration-300 ${
                        spinning ? "blur-sm translate-y-1 scale-95 opacity-60" : "scale-100 opacity-100"
                      }`}
                    >
                      <span className="text-3xl sm:text-4xl filter drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">
                        {sym.icon}
                      </span>
                      <span className="text-[10px] text-fuchsia-300 font-bold uppercase tracking-wider mt-1">
                        {sym.name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Win Overlay Banner */}
          {lastWinPayout > 0 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center animate-in zoom-in-75">
              <span className="text-3xl sm:text-4xl mb-1">🎉</span>
              <span className="text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
                ¡PREMIO GANADOR!
              </span>
              <span className="text-2xl sm:text-4xl font-mono font-black text-white mt-1">
                +${formatFichas(lastWinPayout)}
              </span>
              <span className="text-xs text-fuchsia-300 font-bold mt-1">
                {winningLines.length} línea(s) premiada(s)
              </span>
            </div>
          )}
        </div>

        {/* Paytable snippet */}
        <div className="w-full flex items-center justify-around overflow-x-auto text-xs text-neutral-400 py-2 border-t border-fuchsia-500/20">
          <span className="flex items-center gap-1 font-semibold text-neutral-300">
            <span>⭐ WILD:</span> <span className="text-amber-400">250x</span>
          </span>
          <span className="flex items-center gap-1 font-semibold text-neutral-300">
            <span>💎 777:</span> <span className="text-amber-400">100x</span>
          </span>
          <span className="flex items-center gap-1 font-semibold text-neutral-300">
            <span>🍫 BAR:</span> <span className="text-amber-400">40x</span>
          </span>
          <span className="flex items-center gap-1 font-semibold text-neutral-300">
            <span>🔔 Campana:</span> <span className="text-amber-400">20x</span>
          </span>
        </div>
      </div>

      {/* Bet & Spin Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <BetSelector
            bet={betPerLine}
            setBet={setBetPerLine}
            minBet={2}
            maxBet={500}
            disabled={spinning}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col justify-center">
          <button
            onClick={handleSpin}
            disabled={spinning || (freeSpinsLeft === 0 && totalBet > balance)}
            className="w-full py-5 bg-gradient-to-r from-fuchsia-600 via-pink-500 to-amber-400 hover:from-fuchsia-500 hover:to-amber-300 text-black font-black text-2xl rounded-2xl shadow-xl shadow-fuchsia-500/25 transition active:scale-95 disabled:opacity-40 flex flex-col items-center justify-center"
          >
            <span>{spinning ? "GIRANDO RODILLOS..." : "¡GIRAR TRAGAMONEDAS!"}</span>
            <span className="text-xs font-mono font-bold mt-0.5 text-neutral-900">
              Apuesta Total: ${formatFichas(totalBet)} (5 x ${formatFichas(betPerLine)})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
