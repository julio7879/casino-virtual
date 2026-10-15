"use client";

import React from "react";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { useWallet } from "@/lib/wallet-context";

type BetSelectorProps = {
  bet: number;
  setBet: (b: number) => void;
  minBet?: number;
  maxBet?: number;
  disabled?: boolean;
};

const CHIPS = [10, 50, 100, 250, 500, 1000];

export default function BetSelector({
  bet,
  setBet,
  minBet = 10,
  maxBet = 5000,
  disabled = false,
}: BetSelectorProps) {
  const { balance } = useWallet();

  const handleChipClick = (amount: number) => {
    if (disabled) return;
    sounds.playChip();
    setBet(Math.min(balance, Math.min(maxBet, bet + amount)));
  };

  const handleHalf = () => {
    if (disabled) return;
    sounds.playChip();
    setBet(Math.max(minBet, Math.floor(bet / 2)));
  };

  const handleDouble = () => {
    if (disabled) return;
    sounds.playChip();
    setBet(Math.min(balance, Math.min(maxBet, bet * 2)));
  };

  const handleMax = () => {
    if (disabled) return;
    sounds.playChip();
    setBet(Math.min(balance, maxBet));
  };

  const handleMin = () => {
    if (disabled) return;
    sounds.playChip();
    setBet(minBet);
  };

  return (
    <div className="bg-[#12161f]/90 border border-neutral-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-wider uppercase text-neutral-400">
          Monto de Apuesta
        </span>
        <span className="text-xs text-neutral-400">
          Límites: ${formatFichas(minBet)} - ${formatFichas(maxBet)}
        </span>
      </div>

      {/* Main input & quick modifier controls */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-amber-400 font-bold">
            $
          </div>
          <input
            type="number"
            min={minBet}
            max={maxBet}
            value={bet}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) setBet(Math.max(0, Math.min(maxBet, val)));
            }}
            disabled={disabled}
            className="w-full bg-[#181e2b] border border-neutral-700/80 focus:border-amber-500 rounded-xl py-2.5 pl-8 pr-4 text-white font-mono font-bold text-lg outline-none transition disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleMin}
            disabled={disabled}
            className="px-2.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
          >
            MIN
          </button>
          <button
            type="button"
            onClick={handleHalf}
            disabled={disabled}
            className="px-2.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
          >
            ½
          </button>
          <button
            type="button"
            onClick={handleDouble}
            disabled={disabled}
            className="px-2.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
          >
            2X
          </button>
          <button
            type="button"
            onClick={handleMax}
            disabled={disabled}
            className="px-2.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold transition disabled:opacity-50"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Chip quick selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CHIPS.map((chip) => {
          let color = "bg-neutral-700 border-neutral-500 text-neutral-200";
          if (chip === 50) color = "bg-blue-900/60 border-blue-500 text-blue-200";
          if (chip === 100) color = "bg-red-900/60 border-red-500 text-red-200";
          if (chip === 250) color = "bg-emerald-900/60 border-emerald-500 text-emerald-200";
          if (chip === 500) color = "bg-purple-900/60 border-purple-500 text-purple-200";
          if (chip === 1000) color = "bg-amber-900/60 border-amber-500 text-amber-200 shadow-md shadow-amber-500/20";

          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={disabled || bet + chip > maxBet || bet + chip > balance}
              className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-mono font-bold transition hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 ${color}`}
            >
              +{chip >= 1000 ? `${chip / 1000}k` : chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}
