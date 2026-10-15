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

interface Striker {
  id: string;
  name: string;
  color: string;
  goals: number;
  misses: number;
  shotsHistory: ("goal" | "miss")[];
  eliminated?: boolean;
}

export default function PenaltiesGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 6).map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [strikers, setStrikers] = useState<Striker[]>([]);
  const [currentStrikerIndex, setCurrentStrikerIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [lastShotText, setLastShotText] = useState("Configura los tiradores y pulsa Iniciar Tanda.");
  const [champion, setChampion] = useState<Striker | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Animation states for the canvas
  const [shooting, setShooting] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.slice(0, 8).map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  const handleAdd = (name: string) => {
    setParticipants(rebindParticipants([...participants, { id: `p-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `pb-${i}-${Date.now()}`, name })))
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
        DEFAULT_COMPETITORS.slice(0, 6).map((name, i) => ({ id: `ps-${i}`, name }))
      )
    );
  };

  const handleClear = () => {
    setParticipants([]);
    setBetCandidateId(null);
  };

  // Draw Goal Net & Goalkeeper
  const drawStadium = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      ballX: number,
      ballY: number,
      ballScale: number,
      keeperX: number,
      keeperY: number,
      keeperDiving: boolean
    ) => {
      ctx.clearRect(0, 0, width, height);

      // Stadium turf
      const turfGrad = ctx.createLinearGradient(0, height * 0.4, 0, height);
      turfGrad.addColorStop(0, "#065f46");
      turfGrad.addColorStop(1, "#047857");
      ctx.fillStyle = turfGrad;
      ctx.fillRect(0, 0, width, height);

      // Penalty box lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(width * 0.1, height * 0.35, width * 0.8, height * 0.6);

      // Goal Frame (Posts & Crossbar)
      const goalLeft = width * 0.2;
      const goalRight = width * 0.8;
      const goalTop = height * 0.18;
      const goalBottom = height * 0.65;

      // Net pattern
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(goalLeft, goalTop, goalRight - goalLeft, goalBottom - goalTop);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      for (let x = goalLeft; x <= goalRight; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, goalTop);
        ctx.lineTo(x, goalBottom);
        ctx.stroke();
      }
      for (let y = goalTop; y <= goalBottom; y += 16) {
        ctx.beginPath();
        ctx.moveTo(goalLeft, y);
        ctx.lineTo(goalRight, y);
        ctx.stroke();
      }

      // Goal Posts (White 3D pipes)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(goalLeft, goalBottom);
      ctx.lineTo(goalLeft, goalTop);
      ctx.lineTo(goalRight, goalTop);
      ctx.lineTo(goalRight, goalBottom);
      ctx.stroke();

      // Goalkeeper
      ctx.save();
      ctx.font = "40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (keeperDiving) {
        ctx.fillText("🧤", keeperX, keeperY);
      } else {
        ctx.fillText("🧍‍♂️", keeperX, keeperY);
      }
      ctx.restore();

      // Penalty spot
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.82, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ball ⚽
      ctx.save();
      ctx.font = `${Math.floor(28 * ballScale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚽", ballX, ballY);
      ctx.restore();
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawStadium(
      ctx,
      canvas.width,
      canvas.height,
      canvas.width / 2,
      canvas.height * 0.82,
      1.0,
      canvas.width / 2,
      canvas.height * 0.48,
      false
    );
  }, [drawStadium]);

  // Start Tournament
  const handleStartTournament = () => {
    if (playing || participants.length < 2) return;

    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "penaltis-royale", "Tanda de Penaltis Royale");
      if (!ok) return;
    }

    const initStrikers: Striker[] = participants.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      goals: 0,
      misses: 0,
      shotsHistory: [],
    }));

    setStrikers(initStrikers);
    setCurrentStrikerIndex(0);
    setRoundNumber(1);
    setPlaying(true);
    setChampion(null);
    setShowResultModal(false);
    setLastShotText(`¡Empieza la tanda! Turno de disparo para: ${initStrikers[0].name}`);
  };

  // Execute Shoot
  const handleShoot = () => {
    if (!playing || shooting || strikers.length === 0) return;

    setShooting(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Shot targets
    const corners = [
      { x: width * 0.28, y: height * 0.26 }, // Top left
      { x: width * 0.72, y: height * 0.26 }, // Top right
      { x: width * 0.28, y: height * 0.52 }, // Bottom left
      { x: width * 0.72, y: height * 0.52 }, // Bottom right
      { x: width * 0.5, y: height * 0.42 }, // Center
    ];
    const target = corners[Math.floor(Math.random() * corners.length)];

    // Goalkeeper dive direction
    const keeperDiveTargets = [
      { x: width * 0.32, y: height * 0.35 },
      { x: width * 0.68, y: height * 0.35 },
      { x: width * 0.32, y: height * 0.52 },
      { x: width * 0.68, y: height * 0.52 },
      { x: width * 0.5, y: height * 0.46 },
    ];
    const keeperTarget = keeperDiveTargets[Math.floor(Math.random() * keeperDiveTargets.length)];

    // Is it a goal? (~65% goal probability unless keeper matches target closely)
    const distToKeeper = Math.hypot(target.x - keeperTarget.x, target.y - keeperTarget.y);
    const isGoal = distToKeeper > 65;

    sounds.playDeal();

    const startX = width / 2;
    const startY = height * 0.82;
    const keeperStartX = width / 2;
    const keeperStartY = height * 0.48;

    const startTime = performance.now();
    const duration = 900; // ms

    const animateShot = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);

      // Ball trajectory with perspective shrink
      const bx = startX + (target.x - startX) * p;
      const by = startY + (target.y - startY) * p;
      const bScale = 1.0 - p * 0.45;

      // Goalkeeper dive
      const kx = keeperStartX + (keeperTarget.x - keeperStartX) * p;
      const ky = keeperStartY + (keeperTarget.y - keeperStartY) * p;

      drawStadium(ctx, width, height, bx, by, bScale, kx, ky, p > 0.2);

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(animateShot);
      } else {
        // Shot resolved!
        setShooting(false);
        const striker = strikers[currentStrikerIndex];

        if (isGoal) {
          sounds.playWin();
          setLastShotText(`⚽ ¡GOOOOOOL! ${striker.name} fusiló el arco.`);
        } else {
          sounds.playCrash();
          setLastShotText(`🧤 ¡PARADÓN DEL ARQUERO! ${striker.name} falló su penalti.`);
        }

        const updatedStrikers = strikers.map((s, idx) => {
          if (idx !== currentStrikerIndex) return s;
          return {
            ...s,
            goals: s.goals + (isGoal ? 1 : 0),
            misses: s.misses + (isGoal ? 0 : 1),
            shotsHistory: [...s.shotsHistory, isGoal ? ("goal" as const) : ("miss" as const)],
          };
        });

        setStrikers(updatedStrikers);

        // Next shooter or next round
        const nextIdx = currentStrikerIndex + 1;
        if (nextIdx < updatedStrikers.length) {
          setCurrentStrikerIndex(nextIdx);
        } else {
          // Completed a round for all players
          const newRound = roundNumber + 1;
          setRoundNumber(newRound);
          setCurrentStrikerIndex(0);

          // Check if tournament finishes (e.g. after 3 rounds, or tiebreaker)
          if (newRound > 3) {
            // Find leader
            const sorted = [...updatedStrikers].sort((a, b) => b.goals - a.goals);
            if (sorted[0].goals > sorted[1].goals) {
              // Clear Champion!
              endTournament(sorted[0]);
              return;
            } else {
              setLastShotText("🔥 ¡EMPATE! ¡MUERTE SÚBITA EN LA SIGUIENTE RONDA!");
            }
          }
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animateShot);
  };

  const endTournament = (winnerStriker: Striker) => {
    setPlaying(false);
    setChampion(winnerStriker);
    setShowResultModal(true);
    sounds.playBigWin();

    if (betAmount > 0 && betCandidateId) {
      if (winnerStriker.id === betCandidateId) {
        const mult = participants.length;
        const payout = betAmount * mult;
        awardWin(payout, "penaltis-royale", "Tanda de Penaltis Royale", mult);
      } else {
        sounds.playLose();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#0d281e] via-[#133d2e] to-[#091b14] border border-emerald-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl">
            ⚽
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Tanda de Penaltis Royale
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                DISPAROS EN VIVO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Tiros desde los doce pasos por turnos. El que marque más goles se lleva la Bota de Oro.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartTournament}
          disabled={playing || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-sm transition shadow-xl shadow-emerald-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{playing ? "🏟️" : "⚽"}</span>
          <span>{playing ? "¡TANDA EN JUEGO!" : "¡INICIAR TANDA!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Stadium Goal Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
            {/* Round info */}
            {playing && (
              <div className="w-full mb-3 flex items-center justify-between text-xs font-bold text-neutral-300">
                <span>Ronda #{roundNumber} (Mejor de 3)</span>
                <span className="text-amber-400">
                  Tirador: {strikers[currentStrikerIndex]?.name}
                </span>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={540}
              height={380}
              className="max-w-full h-auto rounded-2xl border border-neutral-800 shadow-2xl"
            />

            {/* Shoot Action Button */}
            <div className="w-full max-w-sm mt-5 flex flex-col items-center gap-2">
              <button
                onClick={handleShoot}
                disabled={!playing || shooting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-black font-black text-sm transition shadow-lg shadow-emerald-500/25 disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{shooting ? "⏳" : "👟"}</span>
                <span>
                  {shooting
                    ? "DISPARANDO AL ARCO..."
                    : playing
                    ? `¡PATEAR PENALTI (${strikers[currentStrikerIndex]?.name})!`
                    : "Inicia la tanda arriba"}
                </span>
              </button>
              <p className="text-[11px] text-neutral-400 text-center">{lastShotText}</p>
            </div>
          </div>

          {/* Strikers Leaderboard & History */}
          {strikers.length > 0 && (
            <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 shadow-xl">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Marcador de Penaltis
              </h4>
              <div className="flex flex-col gap-2">
                {strikers.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
                      idx === currentStrikerIndex && playing
                        ? "bg-emerald-950/40 border-emerald-500/60"
                        : "bg-[#141824] border-neutral-850"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="font-bold text-white">{s.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Shot history dots */}
                      <div className="flex items-center gap-1">
                        {s.shotsHistory.map((res, i) => (
                          <span
                            key={i}
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              res === "goal"
                                ? "bg-emerald-500 text-black font-bold"
                                : "bg-rose-600 text-white"
                            }`}
                          >
                            {res === "goal" ? "✓" : "✗"}
                          </span>
                        ))}
                      </div>

                      <span className="font-mono font-black text-amber-400">
                        {s.goals} {s.goals === 1 ? "Gol" : "Goles"}
                      </span>
                    </div>
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
            disabled={playing}
            betCandidateId={betCandidateId}
            onSelectCandidate={setBetCandidateId}
            betAmount={betAmount}
            onChangeBetAmount={setBetAmount}
          />
        </div>
      </div>

      {/* Champion Modal */}
      {showResultModal && champion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#113123] to-[#071610] border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">🏆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
              ¡BOTA DE ORO DEL TORNEO!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#0d2218] border border-emerald-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: champion.color }}
              />
              <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider">
                Campeón con {champion.goals} Goles Anotados
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
                  ? `🎉 ¡Tu jugador ganó la tanda de penaltis! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu jugador no se consagró campeón.`}
              </div>
            )}

            <button
              onClick={() => setShowResultModal(false)}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition shadow-lg shadow-emerald-500/25"
            >
              Cerrar y Nueva Tanda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
