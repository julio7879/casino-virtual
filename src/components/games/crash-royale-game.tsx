"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ParticipantInput, {
  PlayerParticipant,
  PARTICIPANT_COLORS,
  DEFAULT_COMPETITORS,
} from "./shared/participant-input";
import { sounds } from "@/lib/audio";
import { formatFichas } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { getSavedTournamentNames } from "@/lib/tournament-roster";

interface SpaceRider {
  id: string;
  name: string;
  color: string;
  ejected: boolean;
  ejectMultiplier: number | null;
  crashed: boolean;
}

export default function CrashRoyaleGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `cr-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [flying, setFlying] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [winner, setWinner] = useState<SpaceRider | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [riders, setRiders] = useState<SpaceRider[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const multiplierRef = useRef<number>(1.0);
  const crashPointRef = useRef<number>(2.0);
  const ridersRef = useRef<SpaceRider[]>([]);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        rebindParticipants(saved.map((name, i) => ({ id: `cr-${i}-${Date.now()}`, name })))
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    setParticipants(rebindParticipants([...participants, { id: `cr-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `crb-${i}-${Date.now()}`, name })))
    );
  };

  const handleRemove = (id: string) => {
    setParticipants(rebindParticipants(participants.filter((p) => p.id !== id)));
    if (betCandidateId === id) setBetCandidateId(null);
  };

  const handleShuffle = () => {
    const shuf = [...participants].sort(() => Math.random() - 0.5);
    setParticipants(rebindParticipants(shuf));
  };

  const handleResetSample = () => {
    setParticipants(
      rebindParticipants(
        DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `crs-${i}`, name }))
      )
    );
  };

  const handleClear = () => {
    setParticipants([]);
    setBetCandidateId(null);
  };

  // Draw Space Canvas
  const drawFlight = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, mult: number, isCrash: boolean) => {
      ctx.clearRect(0, 0, width, height);

      // Deep space background
      const spaceGrad = ctx.createLinearGradient(0, 0, width, height);
      spaceGrad.addColorStop(0, "#060814");
      spaceGrad.addColorStop(0.5, "#0b1022");
      spaceGrad.addColorStop(1, "#030408");
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      for (let s = 0; s < 40; s++) {
        const sx = ((s * 97) % width);
        const sy = ((s * 53) % height);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Trajectory curve
      const originX = 50;
      const originY = height - 60;
      const progress = Math.min(1, (mult - 1) / 8);
      const targetX = originX + progress * (width - 120);
      const targetY = originY - Math.pow(progress, 0.8) * (height - 140);

      // Draw Curve Line
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.quadraticCurveTo((originX + targetX) / 2, originY, targetX, targetY);
      ctx.strokeStyle = isCrash ? "#f43f5e" : "#f59e0b";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Rocket or Explosion
      ctx.save();
      if (isCrash) {
        ctx.font = "38px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("💥", targetX, targetY);
      } else {
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🚀", targetX, targetY);

        // Rocket exhaust particles
        ctx.beginPath();
        ctx.arc(targetX - 16, targetY + 12, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(249, 115, 22, 0.7)";
        ctx.fill();
      }
      ctx.restore();

      // Center Multiplier Display
      ctx.save();
      ctx.fillStyle = isCrash ? "#f43f5e" : "#ffffff";
      ctx.font = "bold 44px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = isCrash ? "rgba(244, 63, 94, 0.8)" : "rgba(245, 158, 11, 0.6)";
      ctx.shadowBlur = 15;
      ctx.fillText(`${mult.toFixed(2)}x`, width / 2, 80);

      if (isCrash) {
        ctx.fillStyle = "#f43f5e";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("¡EL COHETE EXPLOTÓ!", width / 2, 110);
      }
      ctx.restore();
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFlight(ctx, canvas.width, canvas.height, 1.0, false);
  }, [drawFlight]);

  // Start Flight
  const handleLaunch = () => {
    if (flying || participants.length < 2) return;

    let hasBet = false;
    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "crash-royale", "Crash Royale Espacial");
      if (!ok) return;
      hasBet = true;
    }

    setFlying(true);
    setCrashed(false);
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setWinner(null);
    setShowResultModal(false);

    // Pick fair crash point (e.g. 1.20x to 10.0x with weighted probability)
    const rand = Math.random();
    const crashAt = Math.max(1.15, +(0.99 / (1 - rand * 0.9)).toFixed(2));
    crashPointRef.current = Math.min(crashAt, 15.0);

    // Assign randomized eject points for each rider (some are conservative, some are greedy)
    const initialRiders: SpaceRider[] = participants.map((p) => {
      // Planned eject point: random between 1.15x and 8.0x
      const targetEject = +(1.15 + Math.random() * 6.5).toFixed(2);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        ejected: false,
        ejectMultiplier: targetEject,
        crashed: false,
      };
    });

    ridersRef.current = initialRiders;
    setRiders(initialRiders);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const startTime = performance.now();

    const flightLoop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      // Exponential rise
      const currentMult = +(1.0 + Math.pow(elapsed * 0.7, 1.6)).toFixed(2);
      multiplierRef.current = currentMult;
      setMultiplier(currentMult);

      // Check rider ejections
      for (const r of ridersRef.current) {
        if (!r.ejected && r.ejectMultiplier && currentMult >= r.ejectMultiplier) {
          r.ejected = true;
          sounds.playDeal();
        }
      }
      setRiders([...ridersRef.current]);

      // Check Crash
      if (currentMult >= crashPointRef.current) {
        // BOOM!
        sounds.playCrash();
        setCrashed(true);
        setFlying(false);

        // Riders who didn't eject crash
        for (const r of ridersRef.current) {
          if (!r.ejected) {
            r.crashed = true;
          }
        }
        setRiders([...ridersRef.current]);

        drawFlight(ctx, width, height, currentMult, true);

        // Determine Winner: the ejected rider with the HIGHEST multiplier!
        const successfulEjects = ridersRef.current.filter((r) => r.ejected && !r.crashed);
        successfulEjects.sort(
          (a, b) => (b.ejectMultiplier ?? 0) - (a.ejectMultiplier ?? 0)
        );

        const champion = successfulEjects.length > 0 ? successfulEjects[0] : null;
        setWinner(champion);
        setShowResultModal(true);

        if (champion) {
          sounds.playBigWin();
        }

        // Bet outcome
        if (hasBet && betCandidateId) {
          if (champion && champion.id === betCandidateId) {
            const mult = participants.length;
            const payout = betAmount * mult;
            awardWin(payout, "crash-royale", "Crash Royale Espacial", mult);
          } else {
            sounds.playLose();
          }
        }
        return;
      }

      drawFlight(ctx, width, height, currentMult, false);
      animFrameRef.current = requestAnimationFrame(flightLoop);
    };

    animFrameRef.current = requestAnimationFrame(flightLoop);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#170e28] via-[#24133d] to-[#120a22] border border-fuchsia-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-2xl">
            🚀
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Crash Royale Espacial
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40">
                MULTIPLICADOR EN VIVO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Todos los participantes suben al cohete. Gana quien salte al multiplicador más alto
              antes de la explosión.
            </p>
          </div>
        </div>

        <button
          onClick={handleLaunch}
          disabled={flying || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-rose-400 hover:from-fuchsia-400 hover:to-rose-300 text-black font-black text-sm transition shadow-xl shadow-fuchsia-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{flying ? "🔥" : "🚀"}</span>
          <span>{flying ? "¡EN VUELO...!" : "¡LANZAR COHETE!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Flight Stage & Riders Status (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#0d101a] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
            <canvas
              ref={canvasRef}
              width={560}
              height={380}
              className="max-w-full h-auto rounded-2xl border border-neutral-800 shadow-2xl"
            />
          </div>

          {/* Riders Status Badges */}
          {riders.length > 0 && (
            <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-xl">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Estado de los Tripulantes
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {riders.map((r) => (
                  <div
                    key={r.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      r.crashed
                        ? "bg-rose-950/30 border-rose-800/40 text-rose-400"
                        : r.ejected
                        ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-400"
                        : "bg-[#141824] border-neutral-800 text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="font-bold truncate">{r.name}</span>
                    </div>
                    <span className="font-mono font-bold text-[11px] shrink-0 ml-1">
                      {r.crashed ? "💥 BOOM" : r.ejected ? `🪂 ${r.ejectMultiplier}x` : "En cabina"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Participant Manager (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <ParticipantInput
            participants={participants}
            onAddParticipant={handleAdd}
            onImportBulk={handleBulk}
            onRemoveParticipant={handleRemove}
            onShuffle={handleShuffle}
            onResetSample={handleResetSample}
            onClearAll={handleClear}
            disabled={flying}
            betCandidateId={betCandidateId}
            onSelectCandidate={setBetCandidateId}
            betAmount={betAmount}
            onChangeBetAmount={setBetAmount}
          />
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#231238] to-[#0d0918] border-2 border-fuchsia-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">{winner ? "👑" : "💥"}</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-fuchsia-400">
              {winner ? "¡CAMPEÓN DE LA EXPEDICIÓN!" : "¡TODOS LOS TRIPULANTES EXPLOTARON!"}
            </span>

            {winner ? (
              <div className="my-5 p-5 rounded-2xl bg-[#170e28] border border-fuchsia-500/40 shadow-inner flex flex-col items-center">
                <span
                  className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                  style={{ backgroundColor: winner.color }}
                />
                <span className="text-xs text-fuchsia-300 font-bold uppercase tracking-wider">
                  Saltó con éxito a {winner.ejectMultiplier}x
                </span>
                <h2 className="text-2xl font-black text-white mt-1">{winner.name}</h2>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 my-4">
                El cohete explotó demasiado rápido y ningún tripulante logró eyectarse a tiempo.
              </p>
            )}

            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  winner && winner.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {winner && winner.id === betCandidateId
                  ? `🎉 ¡Tu participante fue el más valiente! Ganaste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu participante no fue el campeón de esta misión.`}
              </div>
            )}

            <button
              onClick={() => setShowResultModal(false)}
              className="w-full py-3.5 rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-sm transition shadow-lg shadow-fuchsia-600/30"
            >
              Cerrar y Nueva Misión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
