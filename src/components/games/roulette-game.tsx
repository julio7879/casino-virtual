"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { RED_NUMBERS, RouletteBet, settleBets } from "@/lib/engine/roulette";

export default function RouletteGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [chipValue, setChipValue] = useState<number>(50);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastRoundResult, setLastRoundResult] = useState<{
    staked: number;
    returned: number;
  } | null>(null);
  const [recentWinners, setRecentWinners] = useState<number[]>([17, 0, 32, 19, 7, 24, 11]);

  const totalBetAmount = bets.reduce((sum, b) => sum + b.monto, 0);

  const addBet = (type: RouletteBet["tipo"], numeros?: number[]) => {
    if (spinning) return;
    if (totalBetAmount + chipValue > balance) {
      sounds.playLose();
      return;
    }
    sounds.playChip();
    setBets((prev) => {
      // Find existing bet of same type/numbers
      const key = `${type}-${(numeros ?? []).join(",")}`;
      const existing = prev.find((b) => `${b.tipo}-${(b.numeros ?? []).join(",")}` === key);
      if (existing) {
        return prev.map((b) =>
          `${b.tipo}-${(b.numeros ?? []).join(",")}` === key
            ? { ...b, monto: b.monto + chipValue }
            : b
        );
      }
      return [...prev, { tipo: type, numeros, monto: chipValue }];
    });
  };

  const clearBets = () => {
    if (spinning) return;
    sounds.playClick();
    setBets([]);
  };

  const handleSpin = () => {
    if (spinning || bets.length === 0) return;
    if (totalBetAmount > balance) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(totalBetAmount, "roulette", "Ruleta Royale 3D");
    if (!ok) return;

    setSpinning(true);
    setWinningNumber(null);
    setLastRoundResult(null);

    // Audio spinning ticks
    let ticks = 0;
    const tickInterval = setInterval(() => {
      sounds.playSpinTick();
      ticks++;
      if (ticks > 25) clearInterval(tickInterval);
    }, 120);

    // Pick random winning number 0-36
    const outcome = Math.floor(Math.random() * 37);

    setTimeout(() => {
      clearInterval(tickInterval);
      setWinningNumber(outcome);
      setSpinning(false);
      setRecentWinners((prev) => [outcome, ...prev.slice(0, 8)]);

      const result = settleBets(bets, outcome);
      setLastRoundResult(result);

      if (result.returned > 0) {
        awardWin(result.returned, "roulette", "Ruleta Royale 3D", result.returned / result.staked);
      } else {
        sounds.playLose();
      }
    }, 3500);
  };

  const isRed = (n: number) => RED_NUMBERS.has(n);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      {/* Recent winning numbers */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs font-semibold text-neutral-400 shrink-0">Números Recientes:</span>
        {recentWinners.map((n, i) => (
          <span
            key={i}
            className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 text-white shadow-sm ${
              n === 0 ? "bg-emerald-600" : isRed(n) ? "bg-red-600" : "bg-neutral-900 border border-neutral-700"
            }`}
          >
            {n}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roulette Wheel & Outcome Display */}
        <div className="lg:col-span-1 bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-between text-center">
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Ruleta Europea
            </span>
            <span className="text-xs text-neutral-400">RTP: 97.3%</span>
          </div>

          {/* Wheel Graphic */}
          <div className="relative my-6 w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Outer ring */}
            <div
              className={`w-full h-full rounded-full border-8 border-amber-600/80 bg-neutral-900 shadow-2xl shadow-amber-500/10 flex items-center justify-center relative overflow-hidden transition-transform duration-[3500ms] cubic-bezier(0.1, 0.9, 0.2, 1) ${
                spinning ? "rotate-[1440deg]" : "rotate-0"
              }`}
            >
              {/* Wheel segments decoration */}
              <div className="absolute inset-2 rounded-full border-4 border-dashed border-amber-500/30" />
              <div className="absolute inset-8 rounded-full border border-neutral-700 bg-[#121622] flex items-center justify-center">
                <span className="text-3xl animate-pulse">👑</span>
              </div>
            </div>

            {/* Winning Number Reveal Overlay */}
            {winningNumber !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full backdrop-blur-sm animate-in zoom-in-50">
                <div
                  className={`w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shadow-2xl text-white ${
                    winningNumber === 0
                      ? "bg-emerald-600 border-emerald-300"
                      : isRed(winningNumber)
                      ? "bg-red-600 border-red-300"
                      : "bg-neutral-900 border-neutral-400"
                  }`}
                >
                  <span className="text-xs uppercase font-bold text-white/80">Número</span>
                  <span className="text-3xl font-mono font-black">{winningNumber}</span>
                </div>
              </div>
            )}
          </div>

          {/* Round message */}
          {lastRoundResult && (
            <div
              className={`w-full p-3 rounded-2xl border text-center text-xs font-bold ${
                lastRoundResult.returned > 0
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-red-500/15 border-red-500/40 text-red-300"
              }`}
            >
              {lastRoundResult.returned > 0
                ? `¡Premio de $${formatFichas(lastRoundResult.returned)} fichas!`
                : "Sin premio en esta tirada."}
            </div>
          )}

          {/* Total Staked Badge */}
          <div className="w-full mt-4 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-3">
            <span>Apuestas colocadas:</span>
            <span className="font-mono font-bold text-amber-400">
              ${formatFichas(totalBetAmount)}
            </span>
          </div>
        </div>

        {/* Interactive Betting Board */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Tapete de Apuestas (Haz clic para colocar fichas)
              </span>
              <button
                onClick={clearBets}
                disabled={spinning || bets.length === 0}
                className="text-xs text-rose-400 hover:text-rose-300 font-bold transition disabled:opacity-40"
              >
                Limpiar Mesa
              </button>
            </div>

            {/* Zero + Numbers Grid (0 to 36) */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
              {/* Zero */}
              <button
                type="button"
                onClick={() => addBet("pleno", [0])}
                disabled={spinning}
                className="w-12 bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                <span className="text-sm">0</span>
                {bets.find((b) => b.tipo === "pleno" && b.numeros?.[0] === 0) && (
                  <span className="text-[10px] bg-amber-400 text-black px-1 rounded-full font-sans">
                    ${bets.find((b) => b.tipo === "pleno" && b.numeros?.[0] === 0)!.monto}
                  </span>
                )}
              </button>

              {/* Numbers 1 to 36 in 3 rows */}
              <div className="grid grid-rows-3 grid-flow-col gap-1.5 flex-1 min-w-[480px]">
                {Array.from({ length: 36 }, (_, i) => i + 1).map((num) => {
                  const red = isRed(num);
                  const placed = bets.find((b) => b.tipo === "pleno" && b.numeros?.[0] === num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => addBet("pleno", [num])}
                      disabled={spinning}
                      className={`h-11 rounded-xl border flex flex-col items-center justify-center font-mono font-bold text-xs transition active:scale-95 relative ${
                        red
                          ? "bg-red-700/80 hover:bg-red-600 border-red-500 text-white"
                          : "bg-[#181c26] hover:bg-[#252b3b] border-neutral-700 text-neutral-200"
                      }`}
                    >
                      <span>{num}</span>
                      {placed && (
                        <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-black px-1 rounded-full font-sans font-bold shadow">
                          ${placed.monto}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Outside Bets: Dozens */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { label: "1ª Docena (1-12)", docena: 1 },
                { label: "2ª Docena (13-24)", docena: 2 },
                { label: "3ª Docena (25-36)", docena: 3 },
              ].map(({ label, docena }) => (
                <button
                  key={docena}
                  type="button"
                  onClick={() => addBet("docena", [docena])}
                  disabled={spinning}
                  className="py-2.5 rounded-xl bg-[#141824] hover:bg-[#1d2335] border border-neutral-700 text-xs font-bold text-neutral-200 transition active:scale-95"
                >
                  {label} (Paga 2:1)
                </button>
              ))}
            </div>

            {/* Outside Bets: 1:1 chances */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => addBet("falta")}
                disabled={spinning}
                className="py-2 rounded-xl bg-[#141824] hover:bg-[#1d2335] border border-neutral-700 text-xs font-bold text-neutral-300"
              >
                1 al 18
              </button>
              <button
                type="button"
                onClick={() => addBet("par")}
                disabled={spinning}
                className="py-2 rounded-xl bg-[#141824] hover:bg-[#1d2335] border border-neutral-700 text-xs font-bold text-neutral-300"
              >
                PAR
              </button>
              <button
                type="button"
                onClick={() => addBet("rojo")}
                disabled={spinning}
                className="py-2 rounded-xl bg-red-800/80 hover:bg-red-700 border border-red-500 text-xs font-bold text-white shadow-md shadow-red-900/30"
              >
                ROJO
              </button>
              <button
                type="button"
                onClick={() => addBet("negro")}
                disabled={spinning}
                className="py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-bold text-white"
              >
                NEGRO
              </button>
              <button
                type="button"
                onClick={() => addBet("impar")}
                disabled={spinning}
                className="py-2 rounded-xl bg-[#141824] hover:bg-[#1d2335] border border-neutral-700 text-xs font-bold text-neutral-300"
              >
                IMPAR
              </button>
              <button
                type="button"
                onClick={() => addBet("pasa")}
                disabled={spinning}
                className="py-2 rounded-xl bg-[#141824] hover:bg-[#1d2335] border border-neutral-700 text-xs font-bold text-neutral-300"
              >
                19 al 36
              </button>
            </div>
          </div>

          {/* Chip Value Selector & Spin Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BetSelector
              bet={chipValue}
              setBet={setChipValue}
              minBet={10}
              maxBet={5000}
              disabled={spinning}
            />

            <button
              onClick={handleSpin}
              disabled={spinning || bets.length === 0 || totalBetAmount > balance}
              className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {spinning ? "GIRANDO RULETA..." : `GIRAR RULETA ($${formatFichas(totalBetAmount)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
