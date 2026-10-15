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

interface MarblePhysics {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  finished: boolean;
  finishRank: number | null;
}

interface Obstacle {
  x: number;
  y: number;
  radius: number;
}

export default function MarbleRaceGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.map((name, i) => ({
      id: `m-${i}-${Date.now()}`,
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

  const animFrameRef = useRef<number | null>(null);
  const marblesRef = useRef<MarblePhysics[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const finishOrderRef = useRef<string[]>([]);
  const lastSoundTickRef = useRef<number>(0);

  // Sync participant colors
  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  const handleAdd = (name: string) => {
    setParticipants(rebindParticipants([...participants, { id: `m-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `mb-${i}-${Date.now()}`, name })))
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
      rebindParticipants(DEFAULT_COMPETITORS.map((name, i) => ({ id: `ms-${i}`, name })))
    );
    setPodium([]);
  };

  const handleClear = () => {
    setParticipants([]);
    setPodium([]);
    setBetCandidateId(null);
  };

  // Setup track & obstacles
  const initTrack = useCallback(
    (width: number, height: number) => {
      // Create pins grid along track
      const obstacles: Obstacle[] = [];
      const rows = 9;
      const startY = 110;
      const endY = height - 120;
      const stepY = (endY - startY) / rows;

      for (let r = 0; r < rows; r++) {
        const y = startY + r * stepY;
        const cols = r % 2 === 0 ? 8 : 7;
        const stepX = (width - 60) / cols;
        const offsetX = r % 2 === 0 ? 30 : 30 + stepX / 2;

        for (let c = 0; c < cols; c++) {
          obstacles.push({
            x: offsetX + c * stepX,
            y,
            radius: 6,
          });
        }
      }
      obstaclesRef.current = obstacles;

      // Initialize marbles at top starting line
      const count = participants.length;
      const slotW = count > 1 ? (width - 80) / (count - 1) : width / 2;
      const marbles: MarblePhysics[] = participants.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: count === 1 ? width / 2 : 40 + i * slotW,
        y: 40 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0,
        radius: Math.max(9, Math.min(13, 260 / Math.max(count, 10))),
        finished: false,
        finishRank: null,
      }));
      marblesRef.current = marbles;
      finishOrderRef.current = [];
    },
    [participants]
  );

  // Draw static/interactive canvas
  const drawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);

      // Track background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#0b0e17");
      bgGrad.addColorStop(0.5, "#101424");
      bgGrad.addColorStop(1, "#07090f");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Side rails (bumpers)
      ctx.fillStyle = "#1e2438";
      ctx.fillRect(0, 0, 16, height);
      ctx.fillRect(width - 16, 0, 16, height);

      // Top Starting Gate Line
      ctx.strokeStyle = "rgba(234, 179, 8, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(16, 75);
      ctx.lineTo(width - 16, 75);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#eab308";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LÍNEA DE SALIDA", width / 2, 70);

      // Bottom Finish Line Checkered Banner
      const finishY = height - 60;
      const checkW = 12;
      for (let x = 16; x < width - 16; x += checkW) {
        ctx.fillStyle = Math.floor(x / checkW) % 2 === 0 ? "#ffffff" : "#000000";
        ctx.fillRect(x, finishY, checkW, 14);
      }
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁 META FINAL 🏁", width / 2, finishY + 30);

      // Draw obstacle pins (pegs)
      for (const obs of obstaclesRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        const pinGrad = ctx.createRadialGradient(
          obs.x - 2,
          obs.y - 2,
          1,
          obs.x,
          obs.y,
          obs.radius
        );
        pinGrad.addColorStop(0, "#fbbf24");
        pinGrad.addColorStop(1, "#78350f");
        ctx.fillStyle = pinGrad;
        ctx.fill();
        ctx.strokeStyle = "#fef08a";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Marbles
      for (const m of marblesRef.current) {
        ctx.save();
        // Shadow
        ctx.beginPath();
        ctx.ellipse(m.x + 2, m.y + 3, m.radius * 1.1, m.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fill();

        // 3D Sphere Body
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        const marbleGrad = ctx.createRadialGradient(
          m.x - m.radius * 0.35,
          m.y - m.radius * 0.35,
          m.radius * 0.1,
          m.x,
          m.y,
          m.radius
        );
        marbleGrad.addColorStop(0, "#ffffff");
        marbleGrad.addColorStop(0.3, m.color);
        marbleGrad.addColorStop(1, "#0f172a");
        ctx.fillStyle = marbleGrad;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Name tag label above marble
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
        let displayName = m.name;
        if (displayName.length > 8) displayName = displayName.substring(0, 7) + ".";
        ctx.fillText(displayName, m.x, m.y - m.radius - 3);

        // Rank badge if finished
        if (m.finishRank !== null) {
          ctx.fillStyle = m.finishRank === 1 ? "#fbbf24" : m.finishRank === 2 ? "#e2e8f0" : "#d97706";
          ctx.beginPath();
          ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#000000";
          ctx.font = "bold 8px sans-serif";
          ctx.fillText(String(m.finishRank), m.x, m.y + 3);
        }
        ctx.restore();
      }
    },
    []
  );

  // Initialize track on mount/resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    initTrack(canvas.width, canvas.height);
    drawCanvas(ctx, canvas.width, canvas.height);
  }, [participants, initTrack, drawCanvas]);

  // Start Race Simulation
  const handleStartRace = () => {
    if (racing || participants.length < 2) return;

    let hasBet = false;
    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "carrera-canicas", "Carrera de Canicas Royale");
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
    initTrack(width, height);

    const gravity = 0.22;
    const finishY = height - 60;
    let finishedCount = 0;

    const updatePhysics = () => {
      const marbles = marblesRef.current;
      const obstacles = obstaclesRef.current;
      const now = performance.now();

      for (const m of marbles) {
        if (m.finished) continue;

        // Apply gravity & random wind/jitter
        m.vy += gravity;
        m.vx += (Math.random() - 0.5) * 0.15;
        m.vx *= 0.99; // drag

        m.x += m.vx;
        m.y += m.vy;

        // Wall collisions
        if (m.x - m.radius < 18) {
          m.x = 18 + m.radius;
          m.vx = -m.vx * 0.7 + Math.random() * 0.8;
        } else if (m.x + m.radius > width - 18) {
          m.x = width - 18 - m.radius;
          m.vx = -m.vx * 0.7 - Math.random() * 0.8;
        }

        // Obstacle (Peg) collisions
        for (const obs of obstacles) {
          const dx = m.x - obs.x;
          const dy = m.y - obs.y;
          const dist = Math.hypot(dx, dy);
          const minDist = m.radius + obs.radius;

          if (dist < minDist) {
            // Collision resolution
            const angle = Math.atan2(dy, dx);
            const targetX = obs.x + Math.cos(angle) * minDist;
            const targetY = obs.y + Math.sin(angle) * minDist;
            m.x = targetX;
            m.y = targetY;

            // Bounce impulse
            const speed = Math.hypot(m.vx, m.vy);
            const bounceSpeed = Math.max(speed * 0.75, 1.5);
            m.vx = Math.cos(angle) * bounceSpeed + (Math.random() - 0.5) * 1.5;
            m.vy = Math.sin(angle) * bounceSpeed;

            // Play collision sound
            if (now - lastSoundTickRef.current > 60) {
              sounds.playChip();
              lastSoundTickRef.current = now;
            }
          }
        }

        // Finish line crossed!
        if (m.y >= finishY && !m.finished) {
          m.finished = true;
          finishedCount++;
          m.finishRank = finishedCount;
          finishOrderRef.current.push(m.id);

          // Decelerate past finish
          m.vy = Math.min(m.vy, 1.2);

          if (finishedCount === 1) {
            sounds.playWin();
          }
        }
      }

      drawCanvas(ctx, width, height);

      // Check if all or top 3 finished
      if (finishedCount < marbles.length && finishedCount < Math.min(marbles.length, 6)) {
        animFrameRef.current = requestAnimationFrame(updatePhysics);
      } else {
        // Race complete!
        setRacing(false);
        const ordered = finishOrderRef.current.map(
          (id) => participants.find((p) => p.id === id)!
        );
        setPodium(ordered);
        setShowPodiumModal(true);
        sounds.playBigWin();

        // Check Bet
        if (hasBet && betCandidateId && ordered.length > 0) {
          if (ordered[0].id === betCandidateId) {
            const mult = participants.length;
            const payout = betAmount * mult;
            awardWin(payout, "carrera-canicas", "Carrera de Canicas Royale", mult);
          } else {
            sounds.playLose();
          }
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(updatePhysics);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#111928] via-[#152038] to-[#0f1422] border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
            🔮
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Carrera de Canicas Royale
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                FÍSICA 2D EN VIVO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Cada jugador tiene su propia canica. Descienden esquivando pines hasta cruzar la meta.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartRace}
          disabled={racing || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm transition shadow-xl shadow-amber-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{racing ? "🏁" : "🚀"}</span>
          <span>{racing ? "¡CORRIENDO...!" : "¡LARGAR CARRERA!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Track Canvas (7 cols) */}
        <div className="lg:col-span-7 bg-[#0d101a] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={440}
            height={620}
            className="max-w-full h-auto rounded-2xl border border-neutral-800/80 shadow-2xl"
          />
        </div>

        {/* Participant Manager & Betting (5 cols) */}
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
          <div className="w-full max-w-md bg-gradient-to-b from-[#181f34] to-[#0d101a] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">🏆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
              ¡PODIO DE LA CARRERA!
            </span>

            {/* 1st Place */}
            <div className="my-5 p-5 rounded-2xl bg-[#121728] border border-amber-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: podium[0]?.color }}
              />
              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                🥇 1er Lugar (Campeón)
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{podium[0]?.name}</h2>
            </div>

            {/* 2nd and 3rd */}
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

            {/* Bet result */}
            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  podium[0]?.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {podium[0]?.id === betCandidateId
                  ? `🎉 ¡Ganaste tu apuesta! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu canica no llegó en 1er puesto.`}
              </div>
            )}

            <button
              onClick={() => setShowPodiumModal(false)}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition shadow-lg shadow-amber-500/25"
            >
              Cerrar y Nueva Carrera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
