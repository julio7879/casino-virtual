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
import TournamentChallengeModal from "./shared/tournament-challenge-modal";

interface Duck {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  speed: number;
  wobble: number;
  finished: boolean;
  finishRank: number | null;
}

interface RiverRock {
  x: number;
  y: number;
  radius: number;
}

export default function DuckRaceGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `d-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [racing, setRacing] = useState(false);
  const [podium, setPodium] = useState<PlayerParticipant[]>([]);
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const ducksRef = useRef<Duck[]>([]);
  const rocksRef = useRef<RiverRock[]>([]);
  const finishOrderRef = useRef<string[]>([]);
  const lastQuackSoundRef = useRef<number>(0);

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
        rebindParticipants(saved.slice(0, 10).map((name, i) => ({ id: `d-${i}-${Date.now()}`, name })))
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    if (participants.length >= 10) {
      alert("El río admite hasta 10 patitos simultáneos.");
      return;
    }
    setParticipants(rebindParticipants([...participants, { id: `d-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.slice(0, 10).map((name, i) => ({ id: `db-${i}-${Date.now()}`, name })))
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
      rebindParticipants(DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `ds-${i}`, name })))
    );
    setPodium([]);
  };

  const handleClear = () => {
    setParticipants([]);
    setPodium([]);
    setBetCandidateId(null);
  };

  // Setup River & Ducks
  const initRiver = useCallback(
    (width: number, height: number) => {
      // River rocks obstacles
      rocksRef.current = [
        { x: width * 0.3, y: height * 0.28, radius: 14 },
        { x: width * 0.7, y: height * 0.38, radius: 16 },
        { x: width * 0.45, y: height * 0.52, radius: 15 },
        { x: width * 0.25, y: height * 0.68, radius: 14 },
        { x: width * 0.75, y: height * 0.78, radius: 15 },
      ];

      const count = participants.length;
      const slotW = count > 1 ? (width - 80) / (count - 1) : width / 2;

      ducksRef.current = participants.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: count === 1 ? width / 2 : 40 + i * slotW,
        y: 40 + Math.random() * 20,
        speed: 0.8 + Math.random() * 0.4,
        wobble: Math.random() * Math.PI * 2,
        finished: false,
        finishRank: null,
      }));
      finishOrderRef.current = [];
    },
    [participants]
  );

  // Draw River Canvas
  const drawRiver = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) => {
      ctx.clearRect(0, 0, width, height);

      // 1. River Water Gradient
      const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
      waterGrad.addColorStop(0, "#0284c7"); // Blue 600
      waterGrad.addColorStop(0.5, "#0369a1"); // Deep cyan
      waterGrad.addColorStop(1, "#075985");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 0, width, height);

      // River Banks (Green grassy shores)
      ctx.fillStyle = "#166534";
      ctx.fillRect(0, 0, 16, height);
      ctx.fillRect(width - 16, 0, 16, height);

      // Shore boundary lines
      ctx.strokeStyle = "#ca8a04";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(16, height);
      ctx.moveTo(width - 16, 0);
      ctx.lineTo(width - 16, height);
      ctx.stroke();

      // Animated Water Waves / Currents
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.8;
      for (let y = 30; y < height; y += 45) {
        ctx.beginPath();
        const waveOffset = Math.sin(frame * 0.05 + y) * 15;
        ctx.moveTo(25, y + waveOffset);
        ctx.bezierCurveTo(
          width * 0.35,
          y - 8 + waveOffset,
          width * 0.65,
          y + 8 + waveOffset,
          width - 25,
          y + waveOffset
        );
        ctx.stroke();
      }

      // Finish Line at bottom
      const finishY = height - 55;
      const checkW = 12;
      for (let x = 16; x < width - 16; x += checkW) {
        ctx.fillStyle = Math.floor(x / checkW) % 2 === 0 ? "#ffffff" : "#000000";
        ctx.fillRect(x, finishY, checkW, 12);
      }
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁 META DE LOS RÁPIDOS 🏁", width / 2, finishY + 28);

      // River Rocks
      for (const rock of rocksRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#475569";
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rock water splash ripples
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rock.x, rock.y + 4, rock.radius + 3, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Rubber Ducks
      for (const d of ducksRef.current) {
        ctx.save();

        // Water ripple under duck
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + 10, 18, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Rubber Duck Emoji
        ctx.font = "28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const wobbleX = Math.sin(d.wobble) * 2;
        ctx.fillText("🦆", d.x + wobbleX, d.y);

        // Colored headband / collar dot
        ctx.beginPath();
        ctx.arc(d.x + wobbleX, d.y - 12, 5, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Name Tag
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 4;
        let displayName = d.name;
        if (displayName.length > 8) displayName = displayName.substring(0, 7) + ".";
        ctx.fillText(displayName, d.x, d.y - 20);

        // Rank Badge if finished
        if (d.finishRank !== null) {
          ctx.fillStyle = d.finishRank === 1 ? "#fbbf24" : d.finishRank === 2 ? "#e2e8f0" : "#d97706";
          ctx.beginPath();
          ctx.arc(d.x - 14, d.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#000000";
          ctx.font = "bold 8px sans-serif";
          ctx.fillText(String(d.finishRank), d.x - 14, d.y + 3);
        }

        ctx.restore();
      }
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    initRiver(canvas.width, canvas.height);
    drawRiver(ctx, canvas.width, canvas.height, 0);
  }, [participants, initRiver, drawRiver]);

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
      const ok = placeBet(betAmount, "carrera-patos", "Carrera Fluvial de Patitos");
      if (!ok) return;
      hasBet = true;
    }

    setRacing(true);
    setPodium([]);
    setShowPodiumModal(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    initRiver(width, height);

    let frame = 0;
    let finishedCount = 0;
    const finishY = height - 55;

    const runLoop = () => {
      frame++;
      const ducks = ducksRef.current;
      const rocks = rocksRef.current;
      const now = performance.now();

      // Splashing audio
      if (now - lastQuackSoundRef.current > 240 && finishedCount === 0) {
        sounds.playChip();
        lastQuackSoundRef.current = now;
      }

      for (const d of ducks) {
        if (d.finished) continue;

        d.wobble += 0.12;

        // Dynamic current speed + surges
        const currentSpeed = 0.9 + Math.random() * 0.9;
        d.y += currentSpeed;
        d.x += Math.sin(frame * 0.08 + d.y * 0.05) * 0.8;

        // Shore barriers
        if (d.x < 30) d.x = 30;
        if (d.x > width - 30) d.x = width - 30;

        // Rock collisions
        for (const rock of rocks) {
          const dist = Math.hypot(d.x - rock.x, d.y - rock.y);
          if (dist < rock.radius + 14) {
            // Deflect duck sideways
            d.x += (d.x > rock.x ? 1 : -1) * 2;
          }
        }

        // Finish line crossed!
        if (d.y >= finishY && !d.finished) {
          d.finished = true;
          finishedCount++;
          d.finishRank = finishedCount;
          finishOrderRef.current.push(d.id);

          if (finishedCount === 1) {
            sounds.playWin();
          }
        }
      }

      drawRiver(ctx, width, height, frame);

      if (finishedCount < ducks.length && finishedCount < Math.min(ducks.length, 6)) {
        animFrameRef.current = requestAnimationFrame(runLoop);
      } else {
        // Race Ended
        setRacing(false);
        const ordered = finishOrderRef.current.map(
          (id) => participants.find((p) => p.id === id)!
        );
        setPodium(ordered);
        setShowPodiumModal(true);
        sounds.playBigWin();

        if (hasBet && betCandidateId && ordered.length > 0) {
          if (ordered[0].id === betCandidateId) {
            const mult = participants.length;
            const payout = betAmount * mult;
            awardWin(payout, "carrera-patos", "Carrera Fluvial de Patitos", mult);
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#0c2333] via-[#10354e] to-[#081824] border border-cyan-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-2xl">
            🦆
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Carrera Fluvial de Patitos
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                RÁPIDOS EN VIVO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Patos de goma personalizados flotando por los rápidos del río con corrientes, remolinos y rocas.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartRace}
          disabled={racing || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-amber-300 hover:from-cyan-300 hover:to-amber-200 text-black font-black text-sm transition shadow-xl shadow-cyan-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{racing ? "🌊" : "🦆"}</span>
          <span>{racing ? "¡PATITOS EN EL RÍO...!" : "¡SOLTAR PATITOS AL AGUA!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* River Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-[#0d101a] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={440}
            height={620}
            className="max-w-full h-auto rounded-2xl border border-cyan-900/40 shadow-2xl"
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
      {showPodiumModal && podium.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#0f2c42] to-[#071520] border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">🦆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-400">
              ¡PATO CAMPEÓN DEL RÍO!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#0b2030] border border-cyan-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: podium[0]?.color }}
              />
              <span className="text-xs text-cyan-300 font-bold uppercase tracking-wider">
                🥇 Cruzó primero la cascada
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{podium[0]?.name}</h2>
            </div>

            {podium.length > 1 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {podium[1] && (
                  <div className="p-3 rounded-xl bg-[#091824] border border-neutral-800 text-center">
                    <span className="text-[10px] text-neutral-400 block">🥈 2do Puesto</span>
                    <span className="text-xs font-bold text-white truncate block">{podium[1].name}</span>
                  </div>
                )}
                {podium[2] && (
                  <div className="p-3 rounded-xl bg-[#091824] border border-neutral-800 text-center">
                    <span className="text-[10px] text-neutral-400 block">🥉 3er Puesto</span>
                    <span className="text-xs font-bold text-white truncate block">{podium[2].name}</span>
                  </div>
                )}
              </div>
            )}

            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  podium[0]?.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {podium[0]?.id === betCandidateId
                  ? `🎉 ¡Tu patito ganó la carrera en el río! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu patito no llegó en primer puesto.`}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowChallengeModal(true)}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-black font-extrabold text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <span>📜</span>
                <span>Resolver Reto de Inglés</span>
              </button>
              <button
                onClick={() => setShowPodiumModal(false)}
                className="px-5 py-3.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold text-sm transition"
              >
                Cerrar Podio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* English Challenge Modal for the Duck Race Winner */}
      {podium.length > 0 && (
        <TournamentChallengeModal
          isOpen={showChallengeModal}
          participantName={podium[0].name}
          participantColor={podium[0].color}
          role="winner"
          gameTitle="Carrera de Patos"
          onClose={() => setShowChallengeModal(false)}
        />
      )}
    </div>
  );
}
