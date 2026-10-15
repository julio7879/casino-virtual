"use client";

import React, { useState, useRef, useEffect } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas, formatMult } from "@/lib/format";
import { sounds } from "@/lib/audio";
import {
  getPlinkoMultiplier,
  PLINKO_MULTIPLIERS,
  PlinkoRisk,
  simulatePlinkoPath,
} from "@/lib/engine/plinko";

type ActiveBall = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  currentRow: number;
  path: number[];
  step: number;
  bet: number;
  risk: PlinkoRisk;
  rows: number;
};

export default function PlinkoGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [rows, setRows] = useState<number>(12);
  const [lastWin, setLastWin] = useState<{ amount: number; multiplier: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<ActiveBall[]>([]);
  const requestRef = useRef<number | null>(null);

  const multipliers = PLINKO_MULTIPLIERS[risk]?.[rows] || PLINKO_MULTIPLIERS.medium[8];

  const dropBall = () => {
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "plinko", "Plinko Pachinko");
    if (!ok) return;

    sounds.playChip();
    const { path, binIndex } = simulatePlinkoPath(rows);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;

    const newBall: ActiveBall = {
      id: Math.random().toString(36).substring(2, 9),
      x: w / 2 + (Math.random() - 0.5) * 4,
      y: 20,
      vx: 0,
      vy: 1.5,
      currentRow: 0,
      path,
      step: 0,
      bet,
      risk,
      rows,
    };

    ballsRef.current.push(newBall);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw Pegs (Pyramid)
      const topPadding = 40;
      const bottomPadding = 60;
      const rowSpacing = (h - topPadding - bottomPadding) / rows;

      ctx.fillStyle = "#94a3b8";

      for (let r = 0; r <= rows; r++) {
        const pegsInRow = r + 3;
        const rowWidth = pegsInRow * 32;
        const startX = (w - rowWidth) / 2 + 16;
        const y = topPadding + r * rowSpacing;

        for (let p = 0; p < pegsInRow; p++) {
          const x = startX + p * 32;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Update & Draw Balls
      const aliveBalls: ActiveBall[] = [];

      for (const ball of ballsRef.current) {
        ball.y += 3.8;
        const currentYRatio = (ball.y - topPadding) / rowSpacing;
        const targetRow = Math.floor(currentYRatio);

        if (targetRow > ball.currentRow && targetRow <= rows) {
          ball.currentRow = targetRow;
          const dir = ball.path[targetRow - 1] ?? 0;
          ball.x += dir === 1 ? 16 : -16;
          sounds.playSpinTick();
        }

        // Check if reached bottom bucket
        if (ball.y >= h - bottomPadding + 10) {
          const rightBounces = ball.path.reduce((a, b) => a + b, 0);
          const mult = getPlinkoMultiplier(ball.risk, ball.rows, rightBounces);
          const payout = Math.round(ball.bet * mult);

          setLastWin({ amount: payout, multiplier: mult });
          awardWin(payout, "plinko", "Plinko Pachinko", mult);
        } else {
          aliveBalls.push(ball);

          // Draw Golden Plinko Ball
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.shadowColor = "#f59e0b";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      ballsRef.current = aliveBalls;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animId);
  }, [rows, risk]);

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Plinko Board Canvas */}
      <div className="lg:col-span-2 bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-between">
        <div className="w-full flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            ⚪ PLINKO PACHINKO
          </span>
          <span className="text-xs text-neutral-400">RTP: 97.5%</span>
        </div>

        <div className="relative w-full max-w-lg aspect-[4/3] flex items-center justify-center my-auto">
          <canvas
            ref={canvasRef}
            width={520}
            height={390}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Multipliers bottom bins bar */}
        <div className="w-full flex items-center gap-1 justify-center overflow-x-auto py-2">
          {multipliers.map((m, i) => {
            let bg = "bg-neutral-800 text-neutral-300";
            if (m >= 10) bg = "bg-red-600 text-white font-black";
            else if (m >= 3) bg = "bg-amber-600 text-white font-bold";
            else if (m >= 1) bg = "bg-emerald-700 text-white font-semibold";
            return (
              <div
                key={i}
                className={`flex-1 py-1 px-0.5 rounded text-[10px] sm:text-xs text-center font-mono shrink-0 shadow-sm ${bg}`}
              >
                {m}x
              </div>
            );
          })}
        </div>

        {lastWin && (
          <div className="w-full mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-300 font-bold">
            Última bola: {lastWin.multiplier}x (+${formatFichas(lastWin.amount)} fichas)
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <BetSelector
          bet={bet}
          setBet={setBet}
          minBet={10}
          maxBet={5000}
        />

        {/* Risk Level Selector */}
        <div className="bg-[#12161f] border border-neutral-800/80 rounded-2xl p-4">
          <label className="block text-xs font-semibold text-neutral-400 mb-2">
            Nivel de Riesgo
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as PlinkoRisk[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRisk(r)}
                className={`py-2 rounded-xl text-xs font-bold uppercase transition border ${
                  risk === r
                    ? "bg-amber-500 text-black border-amber-400 shadow-md"
                    : "bg-[#181e2b] text-neutral-300 border-neutral-700/80 hover:bg-neutral-800"
                }`}
              >
                {r === "low" ? "Bajo" : r === "medium" ? "Medio" : "Alto"}
              </button>
            ))}
          </div>
        </div>

        {/* Rows Selector */}
        <div className="bg-[#12161f] border border-neutral-800/80 rounded-2xl p-4">
          <label className="block text-xs font-semibold text-neutral-400 mb-2">
            Filas de Clavijas
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[8, 12, 16].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setRows(num)}
                className={`py-2 rounded-xl text-xs font-bold font-mono transition border ${
                  rows === num
                    ? "bg-amber-500 text-black border-amber-400 shadow-md"
                    : "bg-[#181e2b] text-neutral-300 border-neutral-700/80 hover:bg-neutral-800"
                }`}
              >
                {num} Filas
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={dropBall}
          disabled={bet > balance || bet <= 0}
          className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-50"
        >
          SOLTAR BOLA (${formatFichas(bet)})
        </button>
      </div>
    </div>
  );
}
