"use client";

import React, { useState, useEffect } from "react";
import ParticipantInput, {
  PlayerParticipant,
  PARTICIPANT_COLORS,
  DEFAULT_COMPETITORS,
} from "./shared/participant-input";
import { sounds } from "@/lib/audio";
import { formatFichas } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { getSavedTournamentNames } from "@/lib/tournament-roster";

interface GlassStep {
  stepIndex: number;
  safeSide: "left" | "right";
  leftBroken: boolean;
  rightBroken: boolean;
  leftRevealed: boolean;
  rightRevealed: boolean;
}

export default function GlassBridgeGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `gb-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
      eliminated: false,
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const totalSteps = 8;
  const [bridge, setBridge] = useState<GlassStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [survivors, setSurvivors] = useState<PlayerParticipant[]>([]);
  const [fallen, setFallen] = useState<string[]>([]);
  const [lastEventText, setLastEventText] = useState<string>("Configura la fila de jugadores e inicia el desafío.");
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [champion, setChampion] = useState<PlayerParticipant | null>(null);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
      eliminated: false,
    }));
  };

  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        rebindParticipants(saved.map((name, i) => ({ id: `gb-${i}-${Date.now()}`, name })))
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    setParticipants(rebindParticipants([...participants, { id: `gb-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `gbb-${i}-${Date.now()}`, name })))
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
      rebindParticipants(DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `gbs-${i}`, name })))
    );
    setFallen([]);
    setSurvivors([]);
    setChampion(null);
  };

  const handleClear = () => {
    setParticipants([]);
    setFallen([]);
    setSurvivors([]);
    setChampion(null);
    setBetCandidateId(null);
  };

  // Generate bridge steps
  const initBridge = () => {
    const steps: GlassStep[] = [];
    for (let i = 0; i < totalSteps; i++) {
      steps.push({
        stepIndex: i,
        safeSide: Math.random() < 0.5 ? "left" : "right",
        leftBroken: false,
        rightBroken: false,
        leftRevealed: false,
        rightRevealed: false,
      });
    }
    setBridge(steps);
  };

  useEffect(() => {
    initBridge();
  }, []);

  const handleStartGame = () => {
    if (playing || participants.length < 2) return;

    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "puente-cristal", "El Puente de Cristal Royale");
      if (!ok) return;
    }

    const resetParticipants = participants.map((p) => ({ ...p, eliminated: false }));
    setParticipants(resetParticipants);
    initBridge();
    setCurrentStep(0);
    setCurrentParticipantIndex(0);
    setSurvivors([]);
    setFallen([]);
    setChampion(null);
    setShowResultModal(false);
    setPlaying(true);
    setLastEventText(`¡Comienza el reto! En la punta del puente: ${resetParticipants[0].name}`);
    sounds.playDeal();
  };

  // Step onto Left or Right Glass Tile
  const handleStepChoice = (side: "left" | "right") => {
    if (!playing || currentParticipantIndex >= participants.length || currentStep >= totalSteps) return;

    const currentFighter = participants[currentParticipantIndex];
    const step = bridge[currentStep];
    const isSafe = step.safeSide === side;

    const updatedBridge = [...bridge];

    if (isSafe) {
      // Safe! Glass holds!
      sounds.playGem();
      if (side === "left") updatedBridge[currentStep].leftRevealed = true;
      else updatedBridge[currentStep].rightRevealed = true;
      setBridge(updatedBridge);

      setLastEventText(`✨ ¡CRISTAL TEMPLADO! ${currentFighter.name} avanza con éxito.`);

      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);

      // Check if crossed the entire bridge!
      if (nextStep >= totalSteps) {
        // Crossed the finish line!
        sounds.playWin();
        const updatedSurvivors = [...survivors, currentFighter];
        setSurvivors(updatedSurvivors);
        setLastEventText(`🎉 ¡${currentFighter.name} CRUZÓ EL PUENTE CON VIDA!`);

        // Next in line gets to cross easily!
        const nextParticipant = currentParticipantIndex + 1;
        if (nextParticipant < participants.length) {
          setCurrentParticipantIndex(nextParticipant);
        } else {
          // Finished all
          finishGame(updatedSurvivors);
        }
      }
    } else {
      // Shattered! Glass Breaks!
      sounds.playCrash();
      if (side === "left") {
        updatedBridge[currentStep].leftBroken = true;
        updatedBridge[currentStep].leftRevealed = true;
      } else {
        updatedBridge[currentStep].rightBroken = true;
        updatedBridge[currentStep].rightRevealed = true;
      }
      setBridge(updatedBridge);

      setLastEventText(`💥 ¡CRACK! El cristal se rompió y ${currentFighter.name} cayó al vacío.`);
      setFallen((prev) => [currentFighter.name, ...prev]);

      const updatedParticipants = participants.map((p, idx) =>
        idx === currentParticipantIndex ? { ...p, eliminated: true } : p
      );
      setParticipants(updatedParticipants);

      // Next player in line steps up
      const nextParticipant = currentParticipantIndex + 1;
      if (nextParticipant < participants.length) {
        setCurrentParticipantIndex(nextParticipant);
      } else {
        // No more players in line!
        finishGame(survivors);
      }
    }
  };

  const finishGame = (survivorList: PlayerParticipant[]) => {
    setPlaying(false);
    const win = survivorList.length > 0 ? survivorList[0] : null;
    setChampion(win);
    setShowResultModal(true);

    if (win) {
      sounds.playBigWin();
    } else {
      sounds.playLose();
    }

    if (betAmount > 0 && betCandidateId) {
      if (win && win.id === betCandidateId) {
        const mult = participants.length;
        const payout = betAmount * mult;
        awardWin(payout, "puente-cristal", "El Puente de Cristal Royale", mult);
      } else {
        sounds.playLose();
      }
    }
  };

  const currentFighter = participants[currentParticipantIndex];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#2b172a] via-[#3d1a3b] to-[#1a0c1a] border border-pink-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-2xl">
            🌉
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              El Puente de Cristal Royale
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                DESAFÍO AL VACÍO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Un puente de 8 parejas de cristales sobre el abismo. Pisa el cristal templado para cruzar o cae al vacío.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartGame}
          disabled={playing || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-400 hover:to-rose-300 text-black font-black text-sm transition shadow-xl shadow-pink-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{playing ? "⚠️" : "🏃‍♂️"}</span>
          <span>{playing ? "CRUZANDO EL PUENTE..." : "¡INICIAR DESAFÍO DEL PUENTE!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Bridge Canvas / Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            {/* Active Turn Banner */}
            {playing && currentFighter && (
              <div className="w-full mb-4 p-3 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-between text-xs">
                <span className="text-neutral-400">En la fila: #{currentParticipantIndex + 1} de {participants.length}</span>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: currentFighter.color }} />
                  <span className="font-black text-pink-300 text-sm">{currentFighter.name}</span>
                </div>
                <span className="font-mono text-amber-400 font-bold">Paso {currentStep + 1} / {totalSteps}</span>
              </div>
            )}

            {/* The Glass Bridge Structure */}
            <div className="w-full max-w-md flex flex-col gap-2.5 my-2">
              {/* Finish Platform */}
              <div className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-center font-bold text-xs text-amber-300">
                👑 PLATAFORMA DE META (A SALVO)
              </div>

              {/* Steps (from top: step 7 down to step 0) */}
              {[...bridge].reverse().map((step) => {
                const isCurrent = step.stepIndex === currentStep && playing;
                return (
                  <div key={step.stepIndex} className={`grid grid-cols-2 gap-3 p-2 rounded-2xl border transition ${isCurrent ? "bg-pink-950/20 border-pink-500/50 shadow-md" : "border-neutral-800/80 bg-[#121622]"}`}>
                    {/* Left Glass Tile */}
                    <button
                      disabled={!isCurrent}
                      onClick={() => handleStepChoice("left")}
                      className={`h-12 rounded-xl flex items-center justify-center font-bold text-xs transition border ${
                        step.leftBroken
                          ? "bg-rose-950/80 border-rose-600 text-rose-400 opacity-80"
                          : step.leftRevealed
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm"
                          : isCurrent
                          ? "bg-sky-500/20 hover:bg-sky-500/40 border-sky-450 text-white cursor-pointer hover:scale-[1.02] active:scale-95"
                          : "bg-sky-950/20 border-sky-900/30 text-neutral-500"
                      }`}
                    >
                      {step.leftBroken ? "💥 ROTO" : step.leftRevealed ? "✨ TEMPLADO" : isCurrent ? "Pisar Izquierda" : "Cristal #1"}
                    </button>

                    {/* Right Glass Tile */}
                    <button
                      disabled={!isCurrent}
                      onClick={() => handleStepChoice("right")}
                      className={`h-12 rounded-xl flex items-center justify-center font-bold text-xs transition border ${
                        step.rightBroken
                          ? "bg-rose-950/80 border-rose-600 text-rose-400 opacity-80"
                          : step.rightRevealed
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm"
                          : isCurrent
                          ? "bg-sky-500/20 hover:bg-sky-500/40 border-sky-450 text-white cursor-pointer hover:scale-[1.02] active:scale-95"
                          : "bg-sky-950/20 border-sky-900/30 text-neutral-500"
                      }`}
                    >
                      {step.rightBroken ? "💥 ROTO" : step.rightRevealed ? "✨ TEMPLADO" : isCurrent ? "Pisar Derecha" : "Cristal #2"}
                    </button>
                  </div>
                );
              })}

              {/* Start Platform */}
              <div className="w-full py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-center font-bold text-xs text-neutral-300">
                🚀 PLATAFORMA DE SALIDA
              </div>
            </div>

            {/* Event log */}
            <div className="w-full mt-4 p-3 rounded-2xl bg-[#121622] border border-neutral-800 text-center text-xs text-neutral-300 font-medium">
              {lastEventText}
            </div>
          </div>

          {/* Fallen Graveyard */}
          {fallen.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#0e121b] border border-rose-900/30 flex flex-col gap-2">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>💀</span>
                <span>Caídos al Vacío ({fallen.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {fallen.map((name, i) => (
                  <span key={i} className="px-2.5 py-0.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono line-through">
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
            disabled={playing}
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
          <div className="w-full max-w-md bg-gradient-to-b from-[#351934] to-[#0f070f] border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">{champion ? "👑" : "💀"}</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-pink-400">
              {champion ? "¡CRUZÓ EL PUENTE DE CRISTAL!" : "¡TODOS LOS JUGADORES CAYERON!"}
            </span>

            {champion ? (
              <div className="my-5 p-5 rounded-2xl bg-[#1e0e1e] border border-pink-500/40 shadow-inner flex flex-col items-center">
                <span className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg" style={{ backgroundColor: champion.color }} />
                <span className="text-xs text-pink-300 font-bold uppercase tracking-wider">Superviviente Supremo</span>
                <h2 className="text-2xl font-black text-white mt-1">{champion.name}</h2>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 my-4">
                Ningún jugador logró descifrar el camino de cristales templados hasta el final.
              </p>
            )}

            {betAmount > 0 && betCandidateId && (
              <div
                className={`p-3 rounded-2xl border text-xs font-bold mb-4 ${
                  champion && champion.id === betCandidateId
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-400"
                }`}
              >
                {champion && champion.id === betCandidateId
                  ? `🎉 ¡Tu jugador cruzó con vida! Cobraste $${formatFichas(betAmount * participants.length)} fichas`
                  : `❌ Tu jugador cayó al vacío.`}
              </div>
            )}

            <button
              onClick={() => setShowResultModal(false)}
              className="w-full py-3.5 rounded-2xl bg-pink-500 hover:bg-pink-400 text-black font-bold text-sm transition shadow-lg shadow-pink-500/25"
            >
              Cerrar y Nuevo Desafío
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
