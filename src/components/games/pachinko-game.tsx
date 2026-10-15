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

interface PachinkoBall {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  score: number;
  finished: boolean;
  bucketLabel?: string;
}

interface BumperPin {
  x: number;
  y: number;
  radius: number;
  points: number;
  flash: number;
}

const BUCKETS = [
  { label: "10x", mult: 10, color: "#f59e0b" },
  { label: "25x", mult: 25, color: "#8b5cf6" },
  { label: "50x", mult: 50, color: "#ec4899" },
  { label: "100x 👑", mult: 100, color: "#fbbf24" },
  { label: "50x", mult: 50, color: "#ec4899" },
  { label: "25x", mult: 25, color: "#8b5cf6" },
  { label: "10x", mult: 10, color: "#f59e0b" },
];

export default function PachinkoGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `pk-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dropping, setDropping] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PachinkoBall[]>([]);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [champion, setChampion] = useState<PachinkoBall | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const ballsRef = useRef<PachinkoBall[]>([]);
  const pinsRef = useRef<BumperPin[]>([]);
  const lastChimeRef = useRef<number>(0);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.slice(0, 10).map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  const handleAdd = (name: string) => {
    if (participants.length >= 10) {
      alert("La torre admite hasta 10 fichas simultáneas.");
      return;
    }
    setParticipants(rebindParticipants([...participants, { id: `pk-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.slice(0, 10).map((name, i) => ({ id: `pkb-${i}-${Date.now()}`, name })))
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
      rebindParticipants(DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `pks-${i}`, name })))
    );
    setLeaderboard([]);
    setChampion(null);
  };

  const handleClear = () => {
    setParticipants([]);
    setLeaderboard([]);
    setChampion(null);
    setBetCandidateId(null);
  };

  // Init Pins & Balls
  const initBoard = useCallback(
    (width: number, height: number) => {
      const pins: BumperPin[] = [];
      const rows = 8;
      const startY = 100;
      const endY = height - 100;
      const stepY = (endY - startY) / rows;

      for (let r = 0; r < rows; r++) {
        const y = startY + r * stepY;
        const cols = r % 2 === 0 ? 8 : 7;
        const stepX = (width - 60) / cols;
        const offsetX = r % 2 === 0 ? 30 : 30 + stepX / 2;

        for (let c = 0; c < cols; c++) {
          pins.push({
            x: offsetX + c * stepX,
            y,
            radius: 6,
            points: (r + 1) * 10,
            flash: 0,
          });
        }
      }
      pinsRef.current = pins;

      const count = participants.length;
      const slotW = count > 1 ? (width - 80) / (count - 1) : width / 2;

      ballsRef.current = participants.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: count === 1 ? width / 2 : 40 + i * slotW,
        y: 40 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0,
        radius: Math.max(9, Math.min(13, 260 / Math.max(count, 10))),
        score: 0,
        finished: false,
      }));
    },
    [participants]
  );

  // Draw Canvas
  const drawTower = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);

      // Cyber Arcade Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#0e0d1f");
      bgGrad.addColorStop(0.5, "#15132d");
      bgGrad.addColorStop(1, "#090814");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Side Rails with Neon Border
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(139, 92, 246, 0.5)";
      ctx.shadowBlur = 10;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      // Pins (Glowing Neon Bumpers)
      for (const pin of pinsRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pin.radius + (pin.flash > 0 ? 3 : 0), 0, Math.PI * 2);
        ctx.fillStyle = pin.flash > 0 ? "#ffffff" : "#c084fc";
        ctx.shadowColor = pin.flash > 0 ? "#ffffff" : "#a855f7";
        ctx.shadowBlur = pin.flash > 0 ? 15 : 6;
        ctx.fill();
        ctx.strokeStyle = "#f3e8ff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        if (pin.flash > 0) pin.flash--;
      }

      // Bottom Buckets / Catch Pots
      const bucketCount = BUCKETS.length;
      const bucketW = (width - 32) / bucketCount;
      const bucketY = height - 50;

      for (let b = 0; b < bucketCount; b++) {
        const bx = 16 + b * bucketW;
        const bucket = BUCKETS[b];

        ctx.save();
        ctx.fillStyle = "#1e1b4b";
        ctx.fillRect(bx, bucketY, bucketW, 34);
        ctx.strokeStyle = bucket.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, bucketY, bucketW, 34);

        ctx.fillStyle = bucket.color;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(bucket.label, bx + bucketW / 2, bucketY + 22);
        ctx.restore();
      }

      // Draw Balls / Discs
      for (const ball of ballsRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(
          ball.x - ball.radius * 0.35,
          ball.y - ball.radius * 0.35,
          ball.radius * 0.1,
          ball.x,
          ball.y,
          ball.radius
        );
        ballGrad.addColorStop(0, "#ffffff");
        ballGrad.addColorStop(0.4, ball.color);
        ballGrad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = ballGrad;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Name tag
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
        let displayName = ball.name;
        if (displayName.length > 8) displayName = displayName.substring(0, 7) + ".";
        ctx.fillText(displayName, ball.x, ball.y - ball.radius - 3);

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
    initBoard(canvas.width, canvas.height);
    drawTower(ctx, canvas.width, canvas.height);
  }, [participants, initBoard, drawTower]);

  // Drop Discs
  const handleStartDrop = () => {
    if (dropping || participants.length < 2) return;

    let hasBet = false;
    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "pachinko-royale", "Torre Pachinko Neón Royale");
      if (!ok) return;
      hasBet = true;
    }

    setDropping(true);
    setLeaderboard([]);
    setChampion(null);
    setShowWinnerModal(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    initBoard(width, height);

    const gravity = 0.24;
    const bucketY = height - 50;
    const bucketW = (width - 32) / BUCKETS.length;
    let finishedCount = 0;

    const physicsLoop = () => {
      const balls = ballsRef.current;
      const pins = pinsRef.current;
      const now = performance.now();

      for (const b of balls) {
        if (b.finished) continue;

        b.vy += gravity;
        b.vx += (Math.random() - 0.5) * 0.18;
        b.vx *= 0.99;

        b.x += b.vx;
        b.y += b.vy;

        // Walls
        if (b.x - b.radius < 20) {
          b.x = 20 + b.radius;
          b.vx = -b.vx * 0.75 + Math.random();
        } else if (b.x + b.radius > width - 20) {
          b.x = width - 20 - b.radius;
          b.vx = -b.vx * 0.75 - Math.random();
        }

        // Bumper collisions
        for (const pin of pins) {
          const dx = b.x - pin.x;
          const dy = b.y - pin.y;
          const dist = Math.hypot(dx, dy);
          const minDist = b.radius + pin.radius;

          if (dist < minDist) {
            const angle = Math.atan2(dy, dx);
            b.x = pin.x + Math.cos(angle) * minDist;
            b.y = pin.y + Math.sin(angle) * minDist;

            const speed = Math.hypot(b.vx, b.vy);
            const bounce = Math.max(speed * 0.75, 1.8);
            b.vx = Math.cos(angle) * bounce + (Math.random() - 0.5) * 1.5;
            b.vy = Math.sin(angle) * bounce;

            pin.flash = 6;
            b.score += pin.points;

            if (now - lastChimeRef.current > 70) {
              sounds.playChip();
              lastChimeRef.current = now;
            }
          }
        }

        // Landed in a bucket!
        if (b.y >= bucketY && !b.finished) {
          b.finished = true;
          finishedCount++;

          // Identify bucket
          const bucketIdx = Math.max(
            0,
            Math.min(BUCKETS.length - 1, Math.floor((b.x - 16) / bucketW))
          );
          const bucket = BUCKETS[bucketIdx];
          b.bucketLabel = bucket.label;
          b.score = (b.score + 50) * bucket.mult;

          sounds.playDeal();
        }
      }

      drawTower(ctx, width, height);

      if (finishedCount < balls.length) {
        animFrameRef.current = requestAnimationFrame(physicsLoop);
      } else {
        // Complete! Rank by total score
        setDropping(false);
        const sorted = [...balls].sort((a, b) => b.score - a.score);
        setLeaderboard(sorted);
        setChampion(sorted[0]);
        setShowWinnerModal(true);
        sounds.playBigWin();

        if (hasBet && betCandidateId) {
          if (sorted[0].id === betCandidateId) {
            const mult = participants.length;
            const payout = betAmount * mult;
            awardWin(payout, "pachinko-royale", "Torre Pachinko Neón Royale", mult);
          } else {
            sounds.playLose();
          }
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(physicsLoop);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#1c1538] via-[#2c1d56] to-[#120e24] border border-purple-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl">
            🎰
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Torre Pachinko Neón Royale
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                PUNTUACIONES NEÓN
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Las fichas caen por la torre arcade rebotando en bumpers luminosos hacia las canastas de 10x a 100x Jackpot.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartDrop}
          disabled={dropping || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-400 hover:from-purple-400 hover:to-pink-300 text-black font-black text-sm transition shadow-xl shadow-purple-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{dropping ? "⚡" : "🎰"}</span>
          <span>{dropping ? "¡FICHAS CAYENDO...!" : "¡SOLTAR FICHAS AL PACHINKO!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Pachinko Stage (7 cols) */}
        <div className="lg:col-span-7 bg-[#0d101a] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={440}
            height={620}
            className="max-w-full h-auto rounded-2xl border border-purple-900/40 shadow-2xl"
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
            disabled={dropping}
            betCandidateId={betCandidateId}
            onSelectCandidate={setBetCandidateId}
            betAmount={betAmount}
            onChangeBetAmount={setBetAmount}
          />
        </div>
      </div>

      {/* Winner Modal */}
      {showWinnerModal && champion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#2a1742] to-[#0c0814] border-2 border-purple-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">👑</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-purple-400">
              ¡MÁXIMA PUNTUACIÓN PACHINKO!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#1b102b] border border-purple-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: champion.color }}
              />
              <span className="text-xs text-purple-300 font-bold uppercase tracking-wider">
                {champion.bucketLabel} ({formatFichas(champion.score)} Puntos)
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{champion.name}</h2>
            </div>

            {leaderboard.length > 1 && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {leaderboard[1] && (
                  <div className="p-3 rounded-xl bg-[#120a1e] border border-neutral-800 text-center">
                    <span className="text-[10px] text-neutral-400 block">🥈 2do Puesto</span>
                    <span className="text-xs font-bold text-white truncate block">{leaderboard[1].name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">{formatFichas(leaderboard[1].score)} pts</span>
                  </div>
                )}
                {leaderboard[2] && (
                  <div className="p-3 rounded-xl bg-[#120a1e] border border-neutral-800 text-center">
                    <span className="text-[10px] text-neutral-400 block">🥉 3er Puesto</span>
                    <span className="text-xs font-bold text-white truncate block">{leaderboard[2].name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">{formatFichas(leaderboard[2].score)} pts</span>
                  </div>
                )}
              </div>
            )}

            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  champion.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {champion.id === betCandidateId
                  ? `🎉 ¡Tu ficha logró el récord de puntos! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu ficha no logró la máxima puntuación.`}
              </div>
            )}

            <button
              onClick={() => setShowWinnerModal(false)}
              className="w-full py-3.5 rounded-2xl bg-purple-500 hover:bg-purple-400 text-black font-bold text-sm transition shadow-lg shadow-purple-500/25"
            >
              Cerrar y Nueva Partida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
