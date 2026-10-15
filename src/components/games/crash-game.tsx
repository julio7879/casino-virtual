"use client";

import React, { useState, useEffect, useRef } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas, formatMult } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { crashPoint, multiplierAt } from "@/lib/engine/crash";

export default function CrashGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [gameState, setGameState] = useState<"idle" | "running" | "crashed">("idle");
  const [currentMult, setCurrentMult] = useState<number>(1.0);
  const [cashedOut, setCashedOut] = useState<boolean>(false);
  const [cashoutMult, setCashoutMult] = useState<number>(0);
  const [recentCrashes, setRecentCrashes] = useState<number[]>([1.45, 3.22, 1.12, 14.5, 2.1, 1.05, 5.8]);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(1.0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleStartGame = () => {
    if (gameState === "running") return;
    if (bet > balance) {
      sounds.playLose();
      return;
    }

    const success = placeBet(bet, "crash", "Crash Rocket");
    if (!success) return;

    // Generate crash point (house edge 3%)
    const cp = crashPoint(0.03, Math.random());
    crashPointRef.current = cp;

    setGameState("running");
    setCashedOut(false);
    setCashoutMult(0);
    setCurrentMult(1.0);
    startTimeRef.current = performance.now();

    const targetAuto = parseFloat(autoCashout);

    const tick = (now: number) => {
      const elapsedSeconds = (now - startTimeRef.current) / 1000;
      const mult = multiplierAt(elapsedSeconds, 0.08);

      if (mult >= crashPointRef.current) {
        // Crashed!
        setCurrentMult(crashPointRef.current);
        setGameState("crashed");
        sounds.playCrash();
        setRecentCrashes((prev) => [crashPointRef.current, ...prev.slice(0, 8)]);
        return;
      }

      setCurrentMult(mult);

      // Auto cashout check
      if (!cashedOut && !isNaN(targetAuto) && targetAuto > 1.0 && mult >= targetAuto) {
        handleCashOut(mult);
      }

      // Draw canvas curve
      drawGraph(mult, false);

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const handleCashOut = (multOverride?: number) => {
    if (gameState !== "running" || cashedOut) return;
    const finalMult = multOverride || currentMult;
    setCashedOut(true);
    setCashoutMult(finalMult);
    const winAmount = Math.round(bet * finalMult);
    awardWin(winAmount, "crash", "Crash Rocket", finalMult);
  };

  const drawGraph = (mult: number, crashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 50; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Rocket trajectory curve
    const progress = Math.min(1, (mult - 1) / 8);
    const endX = 40 + progress * (w - 100);
    const endY = h - 30 - Math.pow(progress, 0.7) * (h - 80);

    const gradient = ctx.createLinearGradient(0, h, endX, endY);
    if (crashed) {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0.8)");
    } else {
      gradient.addColorStop(0, "rgba(245, 158, 11, 0.05)");
      gradient.addColorStop(1, "rgba(245, 158, 11, 0.9)");
    }

    // Curve fill
    ctx.beginPath();
    ctx.moveTo(40, h - 30);
    ctx.quadraticCurveTo(40 + (endX - 40) * 0.4, h - 30, endX, endY);
    ctx.lineTo(endX, h - 30);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Curve line
    ctx.beginPath();
    ctx.moveTo(40, h - 30);
    ctx.quadraticCurveTo(40 + (endX - 40) * 0.4, h - 30, endX, endY);
    ctx.strokeStyle = crashed ? "#ef4444" : "#f59e0b";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw Rocket or Explosion at end point
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (crashed) {
      ctx.fillText("💥", endX, endY);
    } else {
      ctx.fillText("🚀", endX, endY);
    }
  };

  useEffect(() => {
    drawGraph(currentMult, gameState === "crashed");
  }, [currentMult, gameState]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      {/* Recent history badges */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs font-semibold text-neutral-400 shrink-0">Historial:</span>
        {recentCrashes.map((val, idx) => (
          <span
            key={idx}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
              val >= 2.0
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-neutral-800 border border-neutral-700 text-neutral-400"
            }`}
          >
            {formatMult(val)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph Display Area */}
        <div className="lg:col-span-2 relative aspect-[16/10] bg-[#0e121b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-6">
          <canvas
            ref={canvasRef}
            width={700}
            height={420}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* Top Info */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60 text-xs font-bold text-neutral-300">
              🚀 CRASH ROCKET
            </span>
            <span className="text-xs text-neutral-400">RTP: 97.0%</span>
          </div>

          {/* Central Multiplier Indicator */}
          <div className="relative z-10 my-auto text-center pointer-events-none">
            {gameState === "running" && (
              <div className="animate-in zoom-in-90 duration-100">
                <div className="text-6xl md:text-8xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_35px_rgba(245,158,11,0.5)]">
                  {formatMult(currentMult)}
                </div>
                {cashedOut && (
                  <div className="mt-2 inline-block px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-sm">
                    ¡Retirado en {formatMult(cashoutMult)}! (+${formatFichas(Math.round(bet * cashoutMult))})
                  </div>
                )}
              </div>
            )}

            {gameState === "crashed" && (
              <div className="animate-in zoom-in-75 duration-200">
                <div className="text-6xl md:text-8xl font-black font-mono tracking-tight text-rose-500 drop-shadow-[0_0_35px_rgba(244,63,94,0.6)]">
                  {formatMult(currentMult)}
                </div>
                <div className="text-base font-bold text-rose-400 uppercase tracking-widest mt-2">
                  ¡El cohete explotó!
                </div>
              </div>
            )}

            {gameState === "idle" && (
              <div className="flex flex-col items-center">
                <span className="text-5xl mb-3 animate-bounce">🚀</span>
                <span className="text-neutral-400 text-sm font-semibold">
                  Ajusta tu apuesta y pulsa Despegar para iniciar
                </span>
              </div>
            )}
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-neutral-400">
            <span>Inicio: 1.00x</span>
            <span>Máximo: 1,000x</span>
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="flex flex-col gap-4">
          <BetSelector
            bet={bet}
            setBet={setBet}
            minBet={10}
            maxBet={5000}
            disabled={gameState === "running"}
          />

          {/* Auto Cashout setting */}
          <div className="bg-[#12161f] border border-neutral-800/80 rounded-2xl p-4">
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Auto Retiro Multiplicador
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="1.01"
                max="1000"
                value={autoCashout}
                disabled={gameState === "running"}
                onChange={(e) => setAutoCashout(e.target.value)}
                className="w-full bg-[#181e2b] border border-neutral-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm outline-none transition disabled:opacity-50"
              />
              <span className="absolute right-3.5 top-2.5 text-neutral-400 font-bold text-sm">
                x
              </span>
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Se cobrará automáticamente si alcanza este valor.
            </span>
          </div>

          {/* Main Action Button */}
          {gameState === "running" ? (
            <button
              onClick={() => handleCashOut()}
              disabled={cashedOut}
              className={`w-full py-5 rounded-2xl font-black text-xl transition shadow-xl flex flex-col items-center justify-center ${
                cashedOut
                  ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black shadow-emerald-500/30 active:scale-95 animate-pulse"
              }`}
            >
              <span>{cashedOut ? "RETIRADO" : "¡RETIRAR AHORA!"}</span>
              <span className="text-sm font-mono font-bold mt-0.5">
                ${formatFichas(Math.round(bet * (cashedOut ? cashoutMult : currentMult)))}
              </span>
            </button>
          ) : (
            <button
              onClick={handleStartGame}
              disabled={bet > balance || bet <= 0}
              className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              DESPEGAR (APOSTAR)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
