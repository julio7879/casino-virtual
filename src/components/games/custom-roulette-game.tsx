"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { sounds } from "@/lib/audio";
import { formatFichas } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import {
  getSavedTournamentNames,
  saveTournamentNames,
  resetSavedTournamentNames,
} from "@/lib/tournament-roster";
import TournamentChallengeModal from "./shared/tournament-challenge-modal";

// Vibrant luxury palette for roulette slices
const SLICE_COLORS = [
  "#dc2626", // Red 600
  "#2563eb", // Blue 600
  "#059669", // Emerald 600
  "#d97706", // Amber 600
  "#7c3aed", // Violet 600
  "#db2777", // Pink 600
  "#0891b2", // Cyan 600
  "#ea580c", // Orange 600
  "#4f46e5", // Indigo 600
  "#16a34a", // Green 600
  "#c026d3", // Fuchsia 600
  "#0284c7", // Light Blue 600
  "#e11d48", // Rose 600
  "#65a30d", // Lime 600
];

interface Participant {
  id: string;
  name: string;
  color: string;
}

const DEFAULT_NAMES = [
  "Carlos M.",
  "Valentina R.",
  "Mateo G.",
  "Camila S.",
  "Lucas B.",
  "Sofía T.",
  "Diego H.",
  "Isabella P.",
];

export default function CustomRouletteGame() {
  const { balance, placeBet, awardWin } = useWallet();

  // Participants state
  const [participants, setParticipants] = useState<Participant[]>(() =>
    DEFAULT_NAMES.map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }))
  );

  // Inputs
  const [singleInput, setSingleInput] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Game Modes: "direct" (Gana el que toque) | "elimination" (Battle Royale: se elimina el que toque)
  const [gameMode, setGameMode] = useState<"direct" | "elimination">("direct");
  const [eliminatedList, setEliminatedList] = useState<{ name: string; order: number }[]>([]);

  // Optional Betting
  const [betAmount, setBetAmount] = useState<number>(0);
  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);

  // Roulette animation state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState<"fast" | "normal" | "slow">("normal");

  // Physics animation references
  const animFrameRef = useRef<number | null>(null);
  const wheelAngleRef = useRef<number>(0);
  const ballAngleRef = useRef<number>(0);
  const ballRadiusRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(0);

  // Sync colors when participants change
  const refreshParticipantColors = (list: { id: string; name: string }[]): Participant[] => {
    return list.map((item, idx) => ({
      ...item,
      color: SLICE_COLORS[idx % SLICE_COLORS.length],
    }));
  };

  // Load saved tournament roster across games
  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        refreshParticipantColors(
          saved.map((name, i) => ({ id: `p-${i}-${Date.now()}`, name }))
        )
      );
    }
  }, []);

  // Add single participant
  const handleAddSingle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = singleInput.trim();
    if (!trimmed) return;
    if (participants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Ya existe un participante con ese nombre.");
      return;
    }
    sounds.playChip();
    const updated = refreshParticipantColors([
      ...participants,
      { id: `p-${Date.now()}-${Math.random()}`, name: trimmed },
    ]);
    setParticipants(updated);
    saveTournamentNames(updated.map((p) => p.name));
    setSingleInput("");
  };

  // Add bulk participants
  const handleImportBulk = () => {
    const rawLines = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawLines.length === 0) return;

    // Deduplicate
    const unique = Array.from(new Set(rawLines));
    sounds.playDeal();
    const newItems = unique.map((name, i) => ({
      id: `bulk-${i}-${Date.now()}-${Math.random()}`,
      name,
    }));
    setParticipants(refreshParticipantColors(newItems));
    saveTournamentNames(unique);
    setBulkText("");
    setShowBulkModal(false);
    setEliminatedList([]);
  };

  // Remove participant
  const handleRemoveParticipant = (id: string) => {
    if (spinning) return;
    sounds.playClick();
    const filtered = participants.filter((p) => p.id !== id);
    setParticipants(refreshParticipantColors(filtered));
    saveTournamentNames(filtered.map((p) => p.name));
    if (betCandidateId === id) setBetCandidateId(null);
  };

  // Shuffle participants
  const handleShuffle = () => {
    if (spinning || participants.length < 2) return;
    sounds.playDeal();
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    setParticipants(refreshParticipantColors(shuffled));
    saveTournamentNames(shuffled.map((p) => p.name));
  };

  // Reset to default sample
  const handleResetSample = () => {
    if (spinning) return;
    sounds.playDeal();
    const def = resetSavedTournamentNames();
    setParticipants(
      refreshParticipantColors(
        def.map((name, i) => ({
          id: `sample-${i}-${Date.now()}`,
          name,
        }))
      )
    );
    setEliminatedList([]);
    setWinner(null);
  };

  // Clear all
  const handleClearAll = () => {
    if (spinning) return;
    sounds.playClick();
    setParticipants([]);
    setEliminatedList([]);
    setWinner(null);
    setBetCandidateId(null);
  };

  // ----------------------------------------------------
  // CANVAS RENDER & DRAWING LOGIC
  // ----------------------------------------------------
  const drawWheel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      wheelAngle: number,
      ballAngle: number,
      ballRadius: number,
      isBallActive: boolean,
      winningIndex: number | null
    ) => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 16;
      const N = participants.length;

      if (N === 0) {
        // Empty placeholder state
        ctx.save();
        ctx.fillStyle = "#1e2436";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#9ca3af";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Agrega nombres para armar la ruleta", centerX, centerY);
        ctx.restore();
        return;
      }

      const arc = (Math.PI * 2) / N;

      // 1. Outer wooden/bronze border
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
      const outerGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        radius - 10,
        centerX,
        centerY,
        radius + 12
      );
      outerGrad.addColorStop(0, "#1f2430");
      outerGrad.addColorStop(0.5, "#d97706"); // Gold rim
      outerGrad.addColorStop(0.8, "#78350f"); // Dark bronze
      outerGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = outerGrad;
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Outer rim gold studs / pins
      const pinCount = Math.max(N, 16);
      for (let p = 0; p < pinCount; p++) {
        const pinA = (p * Math.PI * 2) / pinCount;
        const px = centerX + Math.cos(pinA) * (radius + 5);
        const py = centerY + Math.sin(pinA) * (radius + 5);
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fef08a";
        ctx.fill();
      }
      ctx.restore();

      // 2. Draw Wheel Slices
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(wheelAngle);

      for (let i = 0; i < N; i++) {
        const startA = i * arc;
        const endA = startA + arc;
        const participant = participants[i];
        const isSelectedWinner = winningIndex === i && !spinning;

        // Slice background
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startA, endA);
        ctx.closePath();

        ctx.fillStyle = isSelectedWinner ? "#facc15" : participant.color;
        ctx.fill();

        // Slice borders / separator wire
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Slice text rendering (radial orientation)
        ctx.save();
        const midA = startA + arc / 2;
        ctx.rotate(midA);

        // Text positioning
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isSelectedWinner ? "#000000" : "#ffffff";

        // Dynamic font size depending on number of slices & name length
        let fontSize = Math.max(10, Math.min(16, Math.floor(400 / N)));
        if (participant.name.length > 14) fontSize = Math.max(9, fontSize - 2);
        ctx.font = `bold ${fontSize}px sans-serif`;

        // Text shadow for high contrast
        if (!isSelectedWinner) {
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = 4;
        }

        // Truncate if too long
        let displayName = participant.name;
        if (displayName.length > 18) {
          displayName = displayName.substring(0, 16) + "..";
        }

        ctx.fillText(displayName, radius - 24, 0);
        ctx.restore();
      }

      // Inner Pocket Deflector ring (metallic separator track)
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore(); // restore wheel rotation

      // 3. Center Hub / Spinner Dome
      ctx.save();
      const centerGrad = ctx.createRadialGradient(
        centerX - 8,
        centerY - 8,
        4,
        centerX,
        centerY,
        radius * 0.28
      );
      centerGrad.addColorStop(0, "#fbbf24");
      centerGrad.addColorStop(0.3, "#d97706");
      centerGrad.addColorStop(0.7, "#78350f");
      centerGrad.addColorStop(1, "#18181b");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = centerGrad;
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Golden Trophy / Crown Icon in the middle
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.floor(radius * 0.12)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👑", centerX, centerY);
      ctx.restore();

      // 4. THE MARBLE / BALL (CANICA) ANIMATION
      if (isBallActive || winningIndex !== null) {
        const bx = centerX + Math.cos(ballAngle) * ballRadius;
        const by = centerY + Math.sin(ballAngle) * ballRadius;
        const ballSize = Math.max(6, Math.min(10, radius * 0.045));

        ctx.save();
        // Marble cast shadow
        ctx.beginPath();
        ctx.ellipse(bx + 2.5, by + 3.5, ballSize * 1.05, ballSize * 0.75, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fill();

        // 3D Shiny Pearl / Marble Sphere
        const ballGrad = ctx.createRadialGradient(
          bx - ballSize * 0.35,
          by - ballSize * 0.35,
          ballSize * 0.1,
          bx,
          by,
          ballSize
        );
        ballGrad.addColorStop(0, "#ffffff"); // Specular glint
        ballGrad.addColorStop(0.3, "#f8fafc");
        ballGrad.addColorStop(0.7, "#cbd5e1");
        ballGrad.addColorStop(1, "#64748b"); // Shaded rim

        ctx.beginPath();
        ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // 5. Stationary Pointer / Indicator at top
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 12, centerY - radius - 16);
      ctx.lineTo(centerX + 12, centerY - radius - 16);
      ctx.lineTo(centerX, centerY - radius + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
    [participants, spinning]
  );

  // Initial draw & redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2 - 16;

    if (ballRadiusRef.current === 0) {
      ballRadiusRef.current = radius * 0.85;
    }

    drawWheel(
      ctx,
      width,
      height,
      wheelAngleRef.current,
      ballAngleRef.current,
      ballRadiusRef.current,
      spinning,
      winner ? participants.findIndex((p) => p.id === winner.id) : null
    );
  }, [participants, drawWheel, spinning, winner]);

  // ----------------------------------------------------
  // SPIN LOGIC WITH BALL SIMULATION & DECELERATION
  // ----------------------------------------------------
  const handleSpin = () => {
    if (spinning || participants.length < 2) return;

    // Check bet if betting mode is active
    let hasBet = false;
    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "ruleta-nombres", "Ruleta de Competencia");
      if (!ok) return;
      hasBet = true;
    }

    setSpinning(true);
    setWinner(null);
    setShowWinnerModal(false);

    // Pick fair target winner index
    const targetIndex = Math.floor(Math.random() * participants.length);
    const targetParticipant = participants[targetIndex];

    // Durations depending on speed selector
    const duration = spinSpeed === "fast" ? 3200 : spinSpeed === "slow" ? 6000 : 4500;
    const startTime = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) / 2 - 16;
    const N = participants.length;
    const arc = (Math.PI * 2) / N;

    // Outer track radius and inner pocket radius for marble
    const outerBallR = radius * 0.9;
    const innerPocketR = radius * 0.65;

    // Extra spins
    const wheelStartAngle = wheelAngleRef.current;
    const wheelRotations = 4; // Wheel turns ~4 full laps
    const targetWheelFinalAngle = wheelStartAngle + wheelRotations * Math.PI * 2;

    // The winning slice angle in wheel local coords
    const winningLocalCenter = targetIndex * arc + arc / 2;

    // The ball spins in the OPPOSITE direction (counter-clockwise) or fast forward
    // In world coordinates, when the wheel finishes at targetWheelFinalAngle,
    // the winning slice center is at: targetBallFinalAngle = targetWheelFinalAngle + winningLocalCenter
    const ballLaps = 8; // Ball spins ~8 laps
    const ballStartAngle = ballAngleRef.current;
    const targetBallFinalAngle =
      targetWheelFinalAngle + winningLocalCenter - ballLaps * Math.PI * 2;

    // Easing helper
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

    // Animation Loop
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Audio ticks: ball passing pockets / deflectors
      const timeSinceLastTick = currentTime - lastTickTimeRef.current;
      const tickThreshold = 70 + progress * 240; // slows down as ball loses speed
      if (timeSinceLastTick > tickThreshold && progress < 0.95) {
        sounds.playSpinTick();
        lastTickTimeRef.current = currentTime;
      }

      // 1. Wheel Angle Easing
      const wheelProgress = easeOutQuad(progress);
      const currentWheelAngle =
        wheelStartAngle + (targetWheelFinalAngle - wheelStartAngle) * wheelProgress;
      wheelAngleRef.current = currentWheelAngle;

      // 2. Ball Radius & Angle Easing
      let currentBallR = outerBallR;
      if (progress < 0.55) {
        // High speed outer rim orbit with subtle wobble
        currentBallR = outerBallR + Math.sin(progress * 60) * 1.5;
      } else if (progress < 0.85) {
        // Drops inward into pockets with bounce flutter
        const dropP = (progress - 0.55) / 0.3;
        const bounce = Math.sin(dropP * Math.PI * 4) * (1 - dropP) * 8;
        currentBallR = outerBallR + (innerPocketR - outerBallR) * dropP + bounce;
      } else {
        // Settled in pocket with gentle damping vibration
        const restP = (progress - 0.85) / 0.15;
        const settleVibration = Math.sin(restP * Math.PI * 6) * (1 - restP) * 2;
        currentBallR = innerPocketR + settleVibration;
      }
      ballRadiusRef.current = currentBallR;

      // Ball Angle Easing
      const ballProgress = easeOutCubic(progress);
      const currentBallAngle =
        ballStartAngle + (targetBallFinalAngle - ballStartAngle) * ballProgress;
      ballAngleRef.current = currentBallAngle;

      // Draw frame
      drawWheel(
        ctx,
        width,
        height,
        currentWheelAngle,
        currentBallAngle,
        currentBallR,
        true,
        progress > 0.9 ? targetIndex : null
      );

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Finish Spin
        setSpinning(false);
        setWinner(targetParticipant);
        setShowWinnerModal(true);

        // Sound fanfare
        sounds.playBigWin();

        // Check Bet Win/Lose
        if (hasBet && betCandidateId) {
          if (betCandidateId === targetParticipant.id) {
            // Won the bet! Multiplier is equal to total candidates
            const multiplier = participants.length;
            const payout = betAmount * multiplier;
            awardWin(payout, "ruleta-nombres", "Ruleta de Competencia", multiplier);
          } else {
            sounds.playLose();
          }
        }

        // Elimination mode handling
        if (gameMode === "elimination") {
          setEliminatedList((prev) => [
            { name: targetParticipant.name, order: prev.length + 1 },
            ...prev,
          ]);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Handle elimination action from modal
  const handleRemoveWinnerAfterSpin = () => {
    if (!winner) return;
    handleRemoveParticipant(winner.id);
    setShowWinnerModal(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#121727] via-[#161c30] to-[#111422] border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl shadow-inner">
            🎯
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Ruleta de Competencia & Sorteos
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                CANICA 3D REAL
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Personaliza los nombres, observa la canica caer en la casilla ganadora y compite.
            </p>
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div className="flex items-center bg-[#0d101a] p-1.5 rounded-2xl border border-neutral-800 shrink-0">
          <button
            onClick={() => setGameMode("direct")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              gameMode === "direct"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>🏆</span>
            <span>Sorteo Directo</span>
          </button>
          <button
            onClick={() => setGameMode("elimination")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              gameMode === "elimination"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <span>⚔️</span>
            <span>Battle Royale (Eliminación)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Stage (Roulette Wheel) + Right Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* WHEEL STAGE (Left 7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#0d101a] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Ambient background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Wheel Status Bar */}
          <div className="w-full flex items-center justify-between text-xs font-bold text-neutral-400 mb-4 z-10">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              {participants.length} Participantes en la Ruleta
            </span>

            {/* Speed selection */}
            <div className="flex items-center gap-1 bg-[#151928] px-2.5 py-1 rounded-xl border border-neutral-800">
              <span className="text-[11px] text-neutral-500 mr-1">Velocidad:</span>
              {(["fast", "normal", "slow"] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpinSpeed(spd)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition ${
                    spinSpeed === spd
                      ? "bg-amber-500 text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {spd === "fast" ? "Rápida" : spd === "normal" ? "Media" : "Lenta"}
                </button>
              ))}
            </div>
          </div>

          {/* HTML5 Canvas Roulette with 3D Ball */}
          <div className="relative my-2 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={480}
              height={480}
              className="max-w-full h-auto drop-shadow-[0_0_35px_rgba(168,85,247,0.15)] rounded-full transition-transform"
            />
          </div>

          {/* Spin Action Button */}
          <div className="w-full max-w-sm mt-6 z-10 flex flex-col items-center gap-3">
            <button
              onClick={handleSpin}
              disabled={spinning || participants.length < 2}
              className={`w-full py-4 rounded-2xl font-black text-lg transition flex items-center justify-center gap-2.5 shadow-xl ${
                spinning || participants.length < 2
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                  : gameMode === "elimination"
                  ? "bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white shadow-rose-600/30 active:scale-95"
                  : "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black shadow-amber-500/25 active:scale-95"
              }`}
            >
              <span>{spinning ? "🌀" : "🎲"}</span>
              <span>
                {spinning
                  ? "¡GIRANDO LA CANICA..."
                  : participants.length < 2
                  ? "Agrega al menos 2 nombres"
                  : gameMode === "elimination"
                  ? "¡GIRAR PARA ELIMINAR!"
                  : "¡GIRAR RULETA AHORA!"}
              </span>
            </button>

            {/* Quick Helper Subtext */}
            <p className="text-[11px] text-neutral-400 text-center">
              {gameMode === "elimination"
                ? "El participante donde se detenga la canica será eliminado de la batalla."
                : "La canica recorrerá el borde con física y caerá en el ganador oficial."}
            </p>
          </div>
        </div>

        {/* RIGHT CONTROL PANEL: PARTICIPANTS & BETTING (Right 5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 1. Add Participants Box */}
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>👥</span>
                  <span>Participantes ({participants.length})</span>
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sincronizado con torneos
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span>📋</span>
                  <span>Pegar Lista</span>
                </button>
              </div>
            </div>

            {/* Single input form */}
            <form onSubmit={handleAddSingle} className="flex gap-2">
              <input
                type="text"
                placeholder="Escribe un nombre (ej. Juan)..."
                value={singleInput}
                onChange={(e) => setSingleInput(e.target.value)}
                disabled={spinning}
                className="flex-1 bg-[#141824] border border-neutral-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none transition"
              />
              <button
                type="submit"
                disabled={spinning || !singleInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition"
              >
                + Agregar
              </button>
            </form>

            {/* Quick Actions (Shuffle, Samples, Clear) */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
              <button
                onClick={handleShuffle}
                disabled={spinning || participants.length < 2}
                className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1f2538] border border-neutral-800 text-[11px] font-semibold text-neutral-300 transition flex items-center gap-1"
                title="Mezclar orden aleatorio"
              >
                <span>🔀</span>
                <span>Mezclar</span>
              </button>

              <button
                onClick={handleResetSample}
                disabled={spinning}
                className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1f2538] border border-neutral-800 text-[11px] font-semibold text-amber-300 transition flex items-center gap-1"
                title="Cargar 8 nombres de prueba"
              >
                <span>⚡</span>
                <span>Nombres de Prueba</span>
              </button>

              <button
                onClick={handleClearAll}
                disabled={spinning || participants.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-800 text-[11px] font-semibold text-rose-400 transition flex items-center gap-1"
                title="Eliminar todos los nombres"
              >
                <span>🗑️</span>
                <span>Limpiar</span>
              </button>
            </div>

            {/* List of active participants */}
            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1 no-scrollbar">
              {participants.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
                  No hay participantes aún. Escribe uno arriba o pega una lista.
                </div>
              ) : (
                participants.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#131722] border border-neutral-850 hover:border-neutral-700 transition group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs text-neutral-400 font-mono">#{idx + 1}</span>
                      <span className="text-xs font-bold text-white truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Bet multiplier badge if betting */}
                      {betAmount > 0 && (
                        <button
                          onClick={() => setBetCandidateId(p.id)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition ${
                            betCandidateId === p.id
                              ? "bg-amber-400 text-black"
                              : "bg-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {betCandidateId === p.id ? "⭐ Mi Favorito" : "Elegir"}
                        </button>
                      )}

                      <button
                        onClick={() => handleRemoveParticipant(p.id)}
                        disabled={spinning}
                        className="text-neutral-500 hover:text-rose-400 p-1 text-xs transition"
                        title="Eliminar participante"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Optional Virtual Chips Betting Panel */}
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>💰</span>
                <span>Apuesta Virtual Opcional</span>
              </h3>
              <span className="text-xs font-mono text-amber-400 font-bold">
                Cuota: {participants.length > 0 ? `${participants.length}.00x` : "0x"}
              </span>
            </div>

            <p className="text-[11px] text-neutral-400">
              Elige a tu participante favorito arriba y apuesta fichas virtuales. Si la canica cae en él,
              ¡multiplicas tu apuesta x{participants.length}!
            </p>

            <div className="flex items-center gap-2">
              {[0, 50, 100, 250, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBetAmount(amt)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                    betAmount === amt
                      ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20"
                      : "bg-[#141824] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {amt === 0 ? "Sin Apuesta" : `$${amt}`}
                </button>
              ))}
            </div>

            {betAmount > 0 && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                <span className="text-amber-200">
                  {betCandidateId
                    ? `Apostando a: ${participants.find((p) => p.id === betCandidateId)?.name}`
                    : "⚠️ Selecciona un favorito en la lista"}
                </span>
                <span className="font-mono font-bold text-amber-400">
                  Premio Potencial: ${formatFichas(betAmount * participants.length)}
                </span>
              </div>
            )}
          </div>

          {/* 3. Elimination Graveyard (Shown in Battle Royale mode) */}
          {gameMode === "elimination" && eliminatedList.length > 0 && (
            <div className="bg-[#0e121b] border border-rose-900/30 rounded-3xl p-6 shadow-xl flex flex-col gap-3">
              <h3 className="text-sm font-black text-rose-400 flex items-center gap-2">
                <span>💀</span>
                <span>Eliminados ({eliminatedList.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {eliminatedList.map((el, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono line-through flex items-center gap-1.5"
                  >
                    <span>#{el.order}</span>
                    <span>{el.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* BULK PARTICIPANTS IMPORT MODAL */}
      {/* ---------------------------------------------------- */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>📋</span>
                <span>Pegar Lista de Nombres</span>
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Pega una lista de participantes copiada de Excel, Word, Bloc de Notas o WhatsApp. Cada
              línea o coma será un participante en la ruleta:
            </p>

            <textarea
              rows={8}
              placeholder={`Ejemplo:\nCarlos Mendoza\nAna Sofía\nPedro Pascal\nMaría Elena\nJuan David\nCamila Gómez`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full bg-[#141824] border border-neutral-800 focus:border-purple-500 rounded-2xl p-4 text-xs font-mono text-white outline-none resize-none transition"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportBulk}
                disabled={!bulkText.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-lg shadow-purple-600/25"
              >
                Cargar en la Ruleta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* WINNER CELEBRATION MODAL */}
      {/* ---------------------------------------------------- */}
      {showWinnerModal && winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#191e30] to-[#0e121b] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90 duration-200">
            {/* Top gold bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            <div className="text-5xl mb-2 animate-bounce">
              {gameMode === "elimination" ? "⚔️" : "👑"}
            </div>

            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
              {gameMode === "elimination" ? "PARTICIPANTE ELIMINADO" : "¡TENEMOS UN GANADOR!"}
            </span>

            {/* Winner Card */}
            <div className="my-6 p-6 rounded-2xl bg-[#121624] border border-neutral-700 shadow-inner flex flex-col items-center">
              <span
                className="w-8 h-8 rounded-full mb-3 border-2 border-white shadow-lg"
                style={{ backgroundColor: winner.color }}
              />
              <h2 className="text-2xl sm:text-3xl font-black text-white">{winner.name}</h2>
              <p className="text-xs text-neutral-400 mt-1">
                La canica cayó con precisión en su casilla
              </p>
            </div>

            {/* Betting outcome feedback */}
            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  betCandidateId === winner.id
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {betCandidateId === winner.id
                  ? `🎉 ¡Acertaste tu apuesta! Ganaste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu participante no ganó en esta ronda.`}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setShowChallengeModal(true)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-black font-extrabold text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <span>📜</span>
                <span>Resolver Reto de Inglés</span>
              </button>

              {gameMode === "elimination" ? (
                <button
                  onClick={handleRemoveWinnerAfterSpin}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition shadow-lg shadow-rose-600/30"
                >
                  Continuar Batalla (Remover y seguir)
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowWinnerModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition"
                  >
                    Mantener en lista
                  </button>
                  <button
                    onClick={handleRemoveWinnerAfterSpin}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
                  >
                    Eliminar ganador
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowWinnerModal(false)}
                className="text-xs text-neutral-400 hover:text-white py-1 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* English Challenge Modal */}
      {winner && (
        <TournamentChallengeModal
          isOpen={showChallengeModal}
          participantName={winner.name}
          participantColor={winner.color}
          role={gameMode === "elimination" ? "loser" : "winner"}
          gameTitle="Ruleta de Nombres & Battle Royale"
          onClose={() => setShowChallengeModal(false)}
        />
      )}
    </div>
  );
}
