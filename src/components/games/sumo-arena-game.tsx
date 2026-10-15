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

interface SumoFighter {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  fallScale: number;
  knockoutOrder: number | null;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export default function SumoArenaGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `s-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [battling, setBattling] = useState(false);
  const [champion, setChampion] = useState<PlayerParticipant | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [eliminatedList, setEliminatedList] = useState<string[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const fightersRef = useRef<SumoFighter[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const lastImpactSoundRef = useRef<number>(0);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.slice(0, 12).map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  const handleAdd = (name: string) => {
    if (participants.length >= 12) {
      alert("El ring admite un máximo de 12 luchadores simultáneos.");
      return;
    }
    setParticipants(rebindParticipants([...participants, { id: `s-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `sb-${i}-${Date.now()}`, name })))
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
        DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `ss-${i}`, name }))
      )
    );
    setEliminatedList([]);
    setChampion(null);
  };

  const handleClear = () => {
    setParticipants([]);
    setEliminatedList([]);
    setChampion(null);
    setBetCandidateId(null);
  };

  // Init fighters positioned around the ring center
  const initFighters = useCallback(
    (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const spawnRadius = Math.min(centerX, centerY) * 0.45;
      const count = participants.length;

      fightersRef.current = participants.map((p, i) => {
        const angle = (i * Math.PI * 2) / Math.max(count, 1);
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          x: centerX + Math.cos(angle) * spawnRadius,
          y: centerY + Math.sin(angle) * spawnRadius,
          vx: 0,
          vy: 0,
          radius: Math.max(14, Math.min(22, 180 / Math.max(count, 6))),
          alive: true,
          fallScale: 1.0,
          knockoutOrder: null,
        };
      });
      sparksRef.current = [];
      setEliminatedList([]);
    },
    [participants]
  );

  // Draw Arena & Fighters
  const drawArena = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const arenaRadius = Math.min(centerX, centerY) - 24;

      // 1. Abyss Background (Outside ring)
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        arenaRadius * 0.8,
        centerX,
        centerY,
        arenaRadius * 1.3
      );
      bgGrad.addColorStop(0, "#080c16");
      bgGrad.addColorStop(0.7, "#03060c");
      bgGrad.addColorStop(1, "#000000");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Abyss fog ring particles
      ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(centerX, centerY, arenaRadius + 8, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Main Circular Ring Platform (Neon Cyber Arena)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, arenaRadius, 0, Math.PI * 2);
      const ringGrad = ctx.createRadialGradient(
        centerX - 20,
        centerY - 20,
        10,
        centerX,
        centerY,
        arenaRadius
      );
      ringGrad.addColorStop(0, "#1f293d");
      ringGrad.addColorStop(0.6, "#141c2c");
      ringGrad.addColorStop(0.9, "#0d131f");
      ringGrad.addColorStop(1, "#f59e0b"); // Gold neon ring edge
      ctx.fillStyle = ringGrad;
      ctx.fill();

      // Ring edge hazard lines
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(245, 158, 11, 0.6)";
      ctx.shadowBlur = 15;
      ctx.stroke();

      // Center Octagon / Target logo
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, arenaRadius * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.font = "bold 48px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚡", centerX, centerY);
      ctx.restore();

      // 3. Draw Sparks
      for (const sp of sparksRef.current) {
        ctx.save();
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.5 * (sp.life / sp.maxLife), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Draw Fighters
      for (const f of fightersRef.current) {
        if (!f.alive && f.fallScale <= 0) continue;

        ctx.save();
        const drawRadius = f.radius * f.fallScale;

        // Shadow under fighter
        if (f.alive) {
          ctx.beginPath();
          ctx.ellipse(f.x, f.y + drawRadius * 0.5, drawRadius * 1.1, drawRadius * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.fill();
        }

        // Body Sphere
        ctx.beginPath();
        ctx.arc(f.x, f.y, drawRadius, 0, Math.PI * 2);
        const bodyGrad = ctx.createRadialGradient(
          f.x - drawRadius * 0.35,
          f.y - drawRadius * 0.35,
          drawRadius * 0.1,
          f.x,
          f.y,
          drawRadius
        );
        bodyGrad.addColorStop(0, "#ffffff");
        bodyGrad.addColorStop(0.3, f.color);
        bodyGrad.addColorStop(1, "#090d16");
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = f.alive ? "#ffffff" : "#ef4444";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Eyes (looking toward center if alive)
        if (f.alive) {
          const eyeAngle = Math.atan2(centerY - f.y, centerX - f.x);
          const eyeDist = drawRadius * 0.35;
          const eyeX1 = f.x + Math.cos(eyeAngle - 0.4) * eyeDist;
          const eyeY1 = f.y + Math.sin(eyeAngle - 0.4) * eyeDist;
          const eyeX2 = f.x + Math.cos(eyeAngle + 0.4) * eyeDist;
          const eyeY2 = f.y + Math.sin(eyeAngle + 0.4) * eyeDist;

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(eyeX1, eyeY1, 3.5, 0, Math.PI * 2);
          ctx.arc(eyeX2, eyeY2, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(eyeX1 + Math.cos(eyeAngle) * 1.5, eyeY1 + Math.sin(eyeAngle) * 1.5, 1.8, 0, Math.PI * 2);
          ctx.arc(eyeX2 + Math.cos(eyeAngle) * 1.5, eyeY2 + Math.sin(eyeAngle) * 1.5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Name tag
        if (f.alive) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.9)";
          ctx.shadowBlur = 4;
          let displayName = f.name;
          if (displayName.length > 9) displayName = displayName.substring(0, 8) + ".";
          ctx.fillText(displayName, f.x, f.y - drawRadius - 4);
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
    initFighters(canvas.width, canvas.height);
    drawArena(ctx, canvas.width, canvas.height);
  }, [participants, initFighters, drawArena]);

  // Battle Physics Loop
  const handleStartBattle = () => {
    if (battling || participants.length < 2) return;

    let hasBet = false;
    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "ring-sumo", "Sumo Bumper Arena Royale");
      if (!ok) return;
      hasBet = true;
    }

    setBattling(true);
    setChampion(null);
    setShowWinnerModal(false);
    setEliminatedList([]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const arenaRadius = Math.min(centerX, centerY) - 24;

    initFighters(width, height);

    const updatePhysics = () => {
      const fighters = fightersRef.current;
      const sparks = sparksRef.current;
      const now = performance.now();

      // 1. Update Sparks
      for (let s = sparks.length - 1; s >= 0; s--) {
        const sp = sparks[s];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life--;
        if (sp.life <= 0) sparks.splice(s, 1);
      }

      // 2. AI Movement & Physics for alive fighters
      const aliveList = fighters.filter((f) => f.alive);

      for (const f of fighters) {
        if (!f.alive) {
          // Falling into abyss animation
          if (f.fallScale > 0) {
            f.fallScale -= 0.04;
            f.x += f.vx * 0.5;
            f.y += f.vy * 0.5;
          }
          continue;
        }

        // Slight center gravitational pull + wander impulse
        const toCenterX = centerX - f.x;
        const toCenterY = centerY - f.y;
        const distCenter = Math.hypot(toCenterX, toCenterY);

        f.vx += (toCenterX / distCenter) * 0.08;
        f.vy += (toCenterY / distCenter) * 0.08;

        // Charge toward a nearby rival
        if (aliveList.length > 1 && Math.random() < 0.1) {
          const others = aliveList.filter((other) => other.id !== f.id);
          const target = others[Math.floor(Math.random() * others.length)];
          const dx = target.x - f.x;
          const dy = target.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          const impulse = 0.55 + Math.random() * 0.6;
          f.vx += (dx / d) * impulse;
          f.vy += (dy / d) * impulse;
        }

        // Drag/Friction
        f.vx *= 0.97;
        f.vy *= 0.97;

        f.x += f.vx;
        f.y += f.vy;

        // Check if pushed outside ring boundary!
        if (distCenter > arenaRadius) {
          // Knockout!
          f.alive = false;
          f.knockoutOrder = fighters.filter((x) => !x.alive).length;
          sounds.playCrash();
          setEliminatedList((prev) => [f.name, ...prev]);
        }
      }

      // 3. Fighter vs Fighter Bumper Collisions
      for (let i = 0; i < fighters.length; i++) {
        const f1 = fighters[i];
        if (!f1.alive) continue;

        for (let j = i + 1; j < fighters.length; j++) {
          const f2 = fighters[j];
          if (!f2.alive) continue;

          const dx = f2.x - f1.x;
          const dy = f2.y - f1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = f1.radius + f2.radius;

          if (dist < minDist && dist > 0) {
            // Overlap resolution
            const angle = Math.atan2(dy, dx);
            const overlap = minDist - dist;
            f1.x -= Math.cos(angle) * (overlap / 2);
            f1.y -= Math.sin(angle) * (overlap / 2);
            f2.x += Math.cos(angle) * (overlap / 2);
            f2.y += Math.sin(angle) * (overlap / 2);

            // Elastic bounce impulse
            const bounceForce = 2.4 + Math.random() * 1.8;
            f1.vx -= Math.cos(angle) * bounceForce;
            f1.vy -= Math.sin(angle) * bounceForce;
            f2.vx += Math.cos(angle) * bounceForce;
            f2.vy += Math.sin(angle) * bounceForce;

            // Generate spark particles at collision point
            const midX = (f1.x + f2.x) / 2;
            const midY = (f1.y + f2.y) / 2;
            for (let k = 0; k < 6; k++) {
              sparks.push({
                x: midX,
                y: midY,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 14 + Math.random() * 10,
                maxLife: 24,
                color: Math.random() < 0.5 ? "#facc15" : "#ffffff",
              });
            }

            // Play bumper clash sound
            if (now - lastImpactSoundRef.current > 110) {
              sounds.playChip();
              lastImpactSoundRef.current = now;
            }
          }
        }
      }

      drawArena(ctx, width, height);

      // Check remaining alive
      const remaining = fighters.filter((f) => f.alive);

      if (remaining.length > 1) {
        animFrameRef.current = requestAnimationFrame(updatePhysics);
      } else {
        // We have our Last Fighter Standing!
        setBattling(false);
        const winner = remaining.length === 1 ? remaining[0] : fighters[0];
        const winnerParticipant = participants.find((p) => p.id === winner.id)!;
        setChampion(winnerParticipant);
        setShowWinnerModal(true);
        sounds.playBigWin();

        if (hasBet && betCandidateId) {
          if (winner.id === betCandidateId) {
            const mult = participants.length;
            const payout = betAmount * mult;
            awardWin(payout, "ring-sumo", "Sumo Bumper Arena Royale", mult);
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
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#201010] via-[#331515] to-[#140b0b] border border-rose-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl">
            🥊
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Sumo Bumper Arena Royale
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                CHOQUES 2D CON CHISPAS
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Los luchadores chocan y rebotan con física elástica en el ring. El que caiga al abismo
              queda eliminado.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartBattle}
          disabled={battling || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-black font-black text-sm transition shadow-xl shadow-rose-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{battling ? "💥" : "🥊"}</span>
          <span>{battling ? "¡LUCHA EN CURSO...!" : "¡INICIAR COMBATE!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Arena Canvas (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#0d101a] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
            <canvas
              ref={canvasRef}
              width={520}
              height={520}
              className="max-w-full h-auto rounded-full border border-neutral-800 shadow-2xl"
            />
          </div>

          {/* Knockout Ticker */}
          {eliminatedList.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#0e121b] border border-rose-900/30 flex flex-col gap-2">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>💀</span>
                <span>Caídos del Ring ({eliminatedList.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {eliminatedList.map((name, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono line-through"
                  >
                    {name}
                  </span>
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
            disabled={battling}
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
          <div className="w-full max-w-md bg-gradient-to-b from-[#2a1315] to-[#0d0708] border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">👑</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-rose-400">
              ¡REY DEL RING DE SUMO!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#1b0d0f] border border-rose-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: champion.color }}
              />
              <span className="text-xs text-rose-300 font-bold uppercase tracking-wider">
                Último Luchador en Pie
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{champion.name}</h2>
            </div>

            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  champion.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {champion.id === betCandidateId
                  ? `🎉 ¡Tu luchador ganó el torneo de sumo! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu luchador cayó fuera del ring.`}
              </div>
            )}

            <button
              onClick={() => setShowWinnerModal(false)}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition shadow-lg shadow-rose-600/30"
            >
              Cerrar y Nueva Batalla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
