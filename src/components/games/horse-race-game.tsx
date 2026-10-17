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

interface HorseRunner {
  id: string;
  name: string;
  color: string;
  progress: number; // 0 to 100
  speed: number;
  lane: number;
  finished: boolean;
  finishRank: number | null;
}

export default function HorseRaceGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `h-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [racing, setRacing] = useState(false);
  const [winner, setWinner] = useState<PlayerParticipant | null>(null);
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [podium, setPodium] = useState<PlayerParticipant[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const runnersRef = useRef<HorseRunner[]>([]);
  const finishOrderRef = useRef<string[]>([]);
  const lastGallopTickRef = useRef<number>(0);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.slice(0, 10).map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        rebindParticipants(saved.slice(0, 10).map((name, i) => ({ id: `h-${i}-${Date.now()}`, name })))
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    if (participants.length >= 10) {
      alert("El derby admite un máximo de 10 caballos en la pista.");
      return;
    }
    setParticipants(rebindParticipants([...participants, { id: `h-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `hb-${i}-${Date.now()}`, name })))
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
        DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `hs-${i}`, name }))
      )
    );
    setPodium([]);
  };

  const handleClear = () => {
    setParticipants([]);
    setPodium([]);
    setBetCandidateId(null);
  };

  const initRunners = useCallback(() => {
    runnersRef.current = participants.map((p, idx) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      progress: 0,
      speed: 0.2 + Math.random() * 0.1,
      lane: idx,
      finished: false,
      finishRank: null,
    }));
    finishOrderRef.current = [];
  }, [participants]);

  const drawTurf = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, frameTick: number) => {
      ctx.clearRect(0, 0, width, height);

      // Turf grass background
      const turfGrad = ctx.createLinearGradient(0, 0, 0, height);
      turfGrad.addColorStop(0, "#14532d"); // Dark green
      turfGrad.addColorStop(0.5, "#15803d"); // Lush turf
      turfGrad.addColorStop(1, "#166534");
      ctx.fillStyle = turfGrad;
      ctx.fillRect(0, 0, width, height);

      // Track texture stripes
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      for (let y = 0; y < height; y += 30) {
        if (Math.floor(y / 30) % 2 === 0) {
          ctx.fillRect(0, y, width, 30);
        }
      }

      const totalLanes = Math.max(participants.length, 1);
      const laneH = height / totalLanes;

      // Draw Rails and Lanes
      for (let i = 0; i < totalLanes; i++) {
        const laneY = i * laneH;

        // Lane divider rail
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, laneY);
        ctx.lineTo(width, laneY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lane number marker
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`CARRIL #${i + 1}`, 12, laneY + 16);
      }

      // Finish Line at 86% of track
      const finishX = width * 0.88;
      const checkSize = 10;
      for (let y = 0; y < height; y += checkSize) {
        ctx.fillStyle = Math.floor(y / checkSize) % 2 === 0 ? "#ffffff" : "#000000";
        ctx.fillRect(finishX, y, checkSize, checkSize);
      }

      // Finish Banner text
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁 META", finishX + 5, 20);
      ctx.restore();

      // Draw Horses
      for (const h of runnersRef.current) {
        const laneCenterY = h.lane * laneH + laneH / 2;
        // Map progress (0 to 100) to X pixel coordinate
        const trackStartX = 40;
        const trackEndX = finishX;
        const horseX = trackStartX + (h.progress / 100) * (trackEndX - trackStartX);

        ctx.save();

        // Gallop bobbing animation
        const gallopOffset = racing && !h.finished ? Math.sin(frameTick * 0.2 + h.lane) * 3 : 0;
        const currentY = laneCenterY + gallopOffset;

        // Shadow under horse
        ctx.beginPath();
        ctx.ellipse(horseX, currentY + 12, 18, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        // Horse Silk / Saddle Pad
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.roundRect(horseX - 8, currentY - 6, 16, 12, 4);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Horse Emoji Graphic
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏇", horseX, currentY);

        // Name & Jersey Tag
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "left";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
        let displayName = h.name;
        if (displayName.length > 14) displayName = displayName.substring(0, 12) + "..";
        ctx.fillText(displayName, horseX + 16, currentY - 2);

        // Rank Badge
        if (h.finishRank !== null) {
          ctx.fillStyle = h.finishRank === 1 ? "#fbbf24" : h.finishRank === 2 ? "#e2e8f0" : "#d97706";
          ctx.beginPath();
          ctx.arc(horseX - 16, currentY, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#000000";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(h.finishRank), horseX - 16, currentY + 3);
        }

        ctx.restore();
      }
    },
    [participants, racing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    initRunners();
    drawTurf(ctx, canvas.width, canvas.height, 0);
  }, [participants, initRunners, drawTurf]);

  // Race Loop
  const handleStartRace = () => {
    if (racing || participants.length < 2) return;

    let hasBet = false;
    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "carrera-caballos", "Derby Turf Royale");
      if (!ok) return;
      hasBet = true;
    }

    setRacing(true);
    setWinner(null);
    setPodium([]);
    setShowPodiumModal(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    initRunners();
    const width = canvas.width;
    const height = canvas.height;

    let frame = 0;
    let finishedCount = 0;

    const runLoop = () => {
      frame++;
      const now = performance.now();

      // Audio gallop rhythm
      if (now - lastGallopTickRef.current > 160 && finishedCount === 0) {
        sounds.playChip();
        lastGallopTickRef.current = now;
      }

      for (const h of runnersRef.current) {
        if (h.finished) continue;

        // Dynamic speed with surges and stamina
        const sprintSurge = Math.random() < 0.08 ? Math.random() * 0.45 : 0;
        const progressFactor = h.progress > 70 ? 0.35 + Math.random() * 0.4 : 0.25;
        h.speed = progressFactor + sprintSurge;
        h.progress += h.speed;

        if (h.progress >= 100 && !h.finished) {
          h.finished = true;
          h.progress = 100;
          finishedCount++;
          h.finishRank = finishedCount;
          finishOrderRef.current.push(h.id);

          if (finishedCount === 1) {
            sounds.playWin();
          }
        }
      }

      drawTurf(ctx, width, height, frame);

      if (finishedCount < runnersRef.current.length) {
        animFrameRef.current = requestAnimationFrame(runLoop);
      } else {
        // Finished
        setRacing(false);
        const ordered = finishOrderRef.current.map(
          (id) => participants.find((p) => p.id === id)!
        );
        setPodium(ordered);
        setWinner(ordered[0]);
        setShowPodiumModal(true);
        sounds.playBigWin();

        if (hasBet && betCandidateId && ordered.length > 0) {
          if (ordered[0].id === betCandidateId) {
            const mult = participants.length;
            const payout = betAmount * mult;
            awardWin(payout, "carrera-caballos", "Derby Turf Royale", mult);
          } else {
            sounds.playLose();
          }
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(runLoop);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#142818] via-[#1a3821] to-[#0e1c12] border border-emerald-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl">
            🏇
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Derby Turf Royale
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                HIPÓDROMO EN VIVO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Asigna a tus amigos a cada caballo. Galopan en carriles individuales hacia la gloria.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartRace}
          disabled={racing || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-black font-black text-sm transition shadow-xl shadow-emerald-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{racing ? "🏇" : "🚩"}</span>
          <span>{racing ? "¡CORRIENDO DERBY...!" : "¡LARGAR CARRERA!"}</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Track Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-[#0d101a] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={620}
            height={Math.max(380, participants.length * 52)}
            className="max-w-full h-auto rounded-2xl border border-neutral-800 shadow-2xl"
          />
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
            disabled={racing}
            betCandidateId={betCandidateId}
            onSelectCandidate={setBetCandidateId}
            betAmount={betAmount}
            onChangeBetAmount={setBetAmount}
          />
        </div>
      </div>

      {/* Podium Modal */}
      {showPodiumModal && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#16271a] to-[#0d101a] border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">🏆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
              ¡CAMPEÓN DEL GRAN DERBY!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#121c15] border border-emerald-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: winner.color }}
              />
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                🥇 Ganador del Trofeo Dorado
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{winner.name}</h2>
            </div>

            {podium.length > 1 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {podium[1] && (
                  <div className="p-3 rounded-xl bg-[#131622] border border-neutral-800 text-center">
                    <span className="text-[10px] text-neutral-400 block">🥈 2do Lugar</span>
                    <span className="text-xs font-bold text-white truncate block">
                      {podium[1].name}
                    </span>
                  </div>
                )}
                {podium[2] && (
                  <div className="p-3 rounded-xl bg-[#131622] border border-neutral-800 text-center">
                    <span className="text-[10px] text-neutral-400 block">🥉 3er Lugar</span>
                    <span className="text-xs font-bold text-white truncate block">
                      {podium[2].name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  winner.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {winner.id === betCandidateId
                  ? `🎉 ¡Tu caballo ganó la carrera! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu caballo no logró el primer lugar.`}
              </div>
            )}

            <button
              onClick={() => setShowPodiumModal(false)}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition shadow-lg shadow-emerald-500/25"
            >
              Cerrar y Nueva Carrera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
