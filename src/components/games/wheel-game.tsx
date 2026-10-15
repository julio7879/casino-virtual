"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { spinWheel, WHEEL_SEGMENTS, WheelSegment } from "@/lib/engine/wheel";

export default function WheelGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(2);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [winningSegment, setWinningSegment] = useState<WheelSegment | null>(null);
  const [lastWin, setLastWin] = useState<{ won: boolean; payout: number } | null>(null);

  const handleSpin = () => {
    if (spinning) return;
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "wheel", "Mega Wheel Fortuna");
    if (!ok) return;

    setSpinning(true);
    setWinningSegment(null);
    setLastWin(null);

    const { segmentIndex, segment } = spinWheel();

    // Calculate angle for the segment
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    // Extra full spins (5 to 8 spins)
    const extraSpins = 360 * 6;
    const targetAngle = extraSpins + (360 - segmentIndex * segmentAngle);

    setRotation((prev) => prev + targetAngle);

    // Audio ticks
    let ticks = 0;
    const interval = setInterval(() => {
      sounds.playSpinTick();
      ticks++;
      if (ticks > 28) clearInterval(interval);
    }, 110);

    setTimeout(() => {
      clearInterval(interval);
      setSpinning(false);
      setWinningSegment(segment);

      const won = segment.value === selectedMultiplier || Boolean(segment.isJackpot);
      const mult = segment.isJackpot ? 100 : segment.value;
      const payout = won ? Math.round(bet * mult) : 0;

      setLastWin({ won, payout });

      if (won) {
        awardWin(payout, "wheel", "Mega Wheel Fortuna", mult);
      } else {
        sounds.playLose();
      }
    }, 3600);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Big Wheel Stage */}
      <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
        {/* Top Pointer */}
        <div className="relative z-20 -mb-5 flex flex-col items-center">
          <div className="w-8 h-8 bg-amber-400 rotate-45 rounded-sm shadow-xl border-2 border-white -mb-3 z-20" />
        </div>

        {/* The Wheel */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 my-4 flex items-center justify-center">
          <div
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3500ms cubic-bezier(0.12, 0.9, 0.15, 1)" : "none",
            }}
            className="w-full h-full rounded-full border-8 border-amber-500 shadow-2xl relative overflow-hidden bg-neutral-900 flex items-center justify-center"
          >
            {/* SVG Wheel graphic */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {WHEEL_SEGMENTS.map((seg, i) => {
                const angle = 360 / WHEEL_SEGMENTS.length;
                const startA = (i * angle * Math.PI) / 180;
                const endA = ((i + 1) * angle * Math.PI) / 180;
                const x1 = 50 + 50 * Math.cos(startA);
                const y1 = 50 + 50 * Math.sin(startA);
                const x2 = 50 + 50 * Math.cos(endA);
                const y2 = 50 + 50 * Math.sin(endA);

                return (
                  <path
                    key={i}
                    d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                    fill={seg.color}
                    stroke="#1e293b"
                    strokeWidth="0.3"
                  />
                );
              })}
            </svg>

            {/* Wheel Center Hub */}
            <div className="absolute w-20 h-20 rounded-full bg-[#121622] border-4 border-amber-400 shadow-2xl flex flex-col items-center justify-center text-center">
              <span className="text-xl">🎯</span>
              <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider">
                MEGA
              </span>
            </div>
          </div>
        </div>

        {/* Winning notification */}
        {winningSegment && (
          <div
            className={`mt-2 py-3 px-6 rounded-2xl border font-bold text-center text-sm shadow-xl animate-in zoom-in-75 ${
              lastWin?.won
                ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                : "bg-neutral-800 border-neutral-700 text-neutral-300"
            }`}
          >
            {lastWin?.won
              ? `¡VICTORIA! La rueda cayó en ${winningSegment.label}. Ganaste $${formatFichas(lastWin.payout)}`
              : `La rueda se detuvo en ${winningSegment.label}. ¡Sigue intentando!`}
          </div>
        )}
      </div>

      {/* Multiplier Selection Bar */}
      <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-2xl">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-3">
          Elige a qué Multiplicador Apostar
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { mult: 1, label: "1X (Gris)", color: "border-slate-500" },
            { mult: 2, label: "2X (Azul)", color: "border-blue-500" },
            { mult: 5, label: "5X (Morado)", color: "border-purple-500" },
            { mult: 10, label: "10X (Dorado)", color: "border-amber-500" },
            { mult: 20, label: "20X (Rojo)", color: "border-red-500" },
            { mult: 40, label: "40X (Verde)", color: "border-emerald-500" },
          ].map((item) => (
            <button
              key={item.mult}
              type="button"
              disabled={spinning}
              onClick={() => setSelectedMultiplier(item.mult)}
              className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center transition ${
                selectedMultiplier === item.mult
                  ? "bg-amber-500 text-black font-black border-amber-400 ring-2 ring-amber-400"
                  : `bg-[#141824] ${item.color} text-neutral-300 hover:bg-[#1d2335]`
              }`}
            >
              <span className="text-lg font-mono font-black">{item.mult}X</span>
              <span className="text-[10px] opacity-80">{item.label}</span>
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
            disabled={spinning}
          />
        </div>

        <div className="lg:col-span-2 flex items-center">
          <button
            onClick={handleSpin}
            disabled={spinning || bet > balance || bet <= 0}
            className="w-full py-5 bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 hover:from-pink-500 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-pink-500/25 active:scale-95 disabled:opacity-40"
          >
            {spinning ? "GIRANDO RUEDA..." : `GIRAR MEGA RUEDA ($${formatFichas(bet)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
