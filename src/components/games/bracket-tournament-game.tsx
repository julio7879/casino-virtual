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

interface Match {
  id: string;
  round: "quarters" | "semis" | "final";
  p1: PlayerParticipant | null;
  p2: PlayerParticipant | null;
  score1: number;
  score2: number;
  winner: PlayerParticipant | null;
  status: "pending" | "fighting" | "finished";
}

export default function BracketTournamentGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `b-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  // Tournament tree state
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [tournamentStarted, setTournamentStarted] = useState<boolean>(false);
  const [activeDuel, setActiveDuel] = useState<{
    hp1: number;
    hp2: number;
    log: string;
    fighting: boolean;
  }>({ hp1: 100, hp2: 100, log: "Elige participantes e inicia el torneo.", fighting: false });

  const [champion, setChampion] = useState<PlayerParticipant | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.slice(0, 8).map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  // Load saved tournament roster across games
  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        rebindParticipants(
          saved.slice(0, 8).map((name, i) => ({ id: `b-${i}-${Date.now()}`, name }))
        )
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    if (participants.length >= 8) {
      alert("El torneo de llaves clásico es para exactamente 8 participantes (Cuartos, Semifinal y Final).");
      return;
    }
    setParticipants(rebindParticipants([...participants, { id: `b-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.slice(0, 8).map((name, i) => ({ id: `bb-${i}-${Date.now()}`, name })))
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
      rebindParticipants(DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `bs-${i}`, name })))
    );
    setTournamentStarted(false);
    setChampion(null);
  };

  const handleClear = () => {
    setParticipants([]);
    setTournamentStarted(false);
    setChampion(null);
    setBetCandidateId(null);
  };

  // Generate Bracket
  const handleStartTournament = () => {
    if (tournamentStarted || participants.length < 8) {
      if (participants.length < 8) {
        alert("Agrega 8 participantes para completar el cuadro de llaves (o usa el botón 'Cargar 8 Nombres').");
      }
      return;
    }

    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "torneo-bracket", "Torneo de Llaves 1v1");
      if (!ok) return;
    }

    // 4 Quarterfinals (matches 0, 1, 2, 3)
    const quarters: Match[] = [
      { id: "q1", round: "quarters", p1: participants[0], p2: participants[1], score1: 0, score2: 0, winner: null, status: "pending" },
      { id: "q2", round: "quarters", p1: participants[2], p2: participants[3], score1: 0, score2: 0, winner: null, status: "pending" },
      { id: "q3", round: "quarters", p1: participants[4], p2: participants[5], score1: 0, score2: 0, winner: null, status: "pending" },
      { id: "q4", round: "quarters", p1: participants[6], p2: participants[7], score1: 0, score2: 0, winner: null, status: "pending" },
      // 2 Semifinals (matches 4, 5)
      { id: "s1", round: "semis", p1: null, p2: null, score1: 0, score2: 0, winner: null, status: "pending" },
      { id: "s2", round: "semis", p1: null, p2: null, score1: 0, score2: 0, winner: null, status: "pending" },
      // 1 Final (match 6)
      { id: "f1", round: "final", p1: null, p2: null, score1: 0, score2: 0, winner: null, status: "pending" },
    ];

    setMatches(quarters);
    setCurrentMatchIndex(0);
    setTournamentStarted(true);
    setChampion(null);
    setShowWinnerModal(false);
    setActiveDuel({
      hp1: 100,
      hp2: 100,
      log: `Duelo 1: ${participants[0].name} vs ${participants[1].name}`,
      fighting: false,
    });
    sounds.playDeal();
  };

  // Run animated match duel
  const handlePlayCurrentMatch = () => {
    if (activeDuel.fighting || currentMatchIndex >= matches.length) return;
    const match = matches[currentMatchIndex];
    if (!match.p1 || !match.p2) return;

    setActiveDuel((prev) => ({ ...prev, fighting: true, hp1: 100, hp2: 100, log: "¡Combate en curso!" }));

    let hp1 = 100;
    let hp2 = 100;
    let roundStep = 0;

    const interval = setInterval(() => {
      roundStep++;
      const dmg1 = Math.floor(Math.random() * 26 + 15);
      const dmg2 = Math.floor(Math.random() * 26 + 15);

      hp1 = Math.max(0, hp1 - dmg2);
      hp2 = Math.max(0, hp2 - dmg1);

      sounds.playChip();
      setActiveDuel({
        hp1,
        hp2,
        log: `Intercambio de golpes: ${match.p1!.name} (${hp1} HP) vs ${match.p2!.name} (${hp2} HP)`,
        fighting: true,
      });

      if (hp1 <= 0 || hp2 <= 0 || roundStep >= 6) {
        clearInterval(interval);
        // Winner is the one with higher remaining HP
        const winner = hp1 > hp2 ? match.p1 : match.p2;
        sounds.playWin();

        const updated = [...matches];
        updated[currentMatchIndex] = {
          ...match,
          winner,
          score1: hp1,
          score2: hp2,
          status: "finished",
        };

        // Advance to next bracket slot
        if (currentMatchIndex === 0) updated[4].p1 = winner;
        if (currentMatchIndex === 1) updated[4].p2 = winner;
        if (currentMatchIndex === 2) updated[5].p1 = winner;
        if (currentMatchIndex === 3) updated[5].p2 = winner;
        if (currentMatchIndex === 4) updated[6].p1 = winner;
        if (currentMatchIndex === 5) updated[6].p2 = winner;

        setMatches(updated);

        if (currentMatchIndex === 6) {
          // Final Finished! Grand Champion!
          setChampion(winner);
          setShowWinnerModal(true);
          sounds.playBigWin();
          setActiveDuel({ hp1, hp2, log: `🏆 ¡CAMPEÓN ABSOLUTO: ${winner?.name}!`, fighting: false });

          if (betAmount > 0 && betCandidateId && winner) {
            if (winner.id === betCandidateId) {
              const mult = 8;
              awardWin(betAmount * mult, "torneo-bracket", "Torneo de Llaves 1v1", mult);
            } else {
              sounds.playLose();
            }
          }
        } else {
          const nextIdx = currentMatchIndex + 1;
          setCurrentMatchIndex(nextIdx);
          const nextMatch = updated[nextIdx];
          setActiveDuel({
            hp1: 100,
            hp2: 100,
            log: nextMatch.p1 && nextMatch.p2
              ? `Victoria para ${winner?.name}. Siguiente: ${nextMatch.p1.name} vs ${nextMatch.p2.name}`
              : `Victoria para ${winner?.name}. Esperando rival...`,
            fighting: false,
          });
        }
      }
    }, 450);
  };

  const curMatch = matches[currentMatchIndex];

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#171c35] via-[#21294d] to-[#111425] border border-indigo-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-2xl">
            🏆
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Torneo de Llaves 1v1
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                CUADRO BRACKET VISUAL
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              8 participantes se enfrentan en eliminatorias directas. Cuartos, Semifinal y Gran Final con barras de vida.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartTournament}
          disabled={tournamentStarted || participants.length < 8}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-400 hover:from-indigo-400 hover:to-blue-300 text-black font-black text-sm transition shadow-xl shadow-indigo-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{tournamentStarted ? "⚔️" : "🎮"}</span>
          <span>{tournamentStarted ? "TORNEO EN MARCHA" : "¡GENERAR CUADRO (8 JUGADORES)!"}</span>
        </button>
      </div>

      {/* Main Grid: Left Stage (Visual Bracket + Clash Stage) + Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* 1. Clash Arena Stage */}
          {tournamentStarted && curMatch && curMatch.p1 && curMatch.p2 && (
            <div className="bg-[#0e121b] border border-indigo-900/50 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-400">
                <span className="uppercase tracking-wider text-indigo-400">
                  {curMatch.round === "quarters" ? "Cuartos de Final" : curMatch.round === "semis" ? "Semifinal" : "👑 GRAN FINAL"}
                </span>
                <span>Duelo #{currentMatchIndex + 1} de 7</span>
              </div>

              {/* Fighters Faceoff */}
              <div className="grid grid-cols-2 gap-4 my-2">
                {/* Fighter 1 */}
                <div className="flex flex-col items-center p-4 rounded-2xl bg-[#141824] border border-neutral-850">
                  <span className="w-10 h-10 rounded-full border-2 border-white mb-2 shadow-lg" style={{ backgroundColor: curMatch.p1.color }} />
                  <span className="font-bold text-sm text-white truncate max-w-full">{curMatch.p1.name}</span>
                  {/* Health Bar */}
                  <div className="w-full bg-neutral-800 h-2.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${activeDuel.hp1}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 mt-1">{activeDuel.hp1} HP</span>
                </div>

                {/* Fighter 2 */}
                <div className="flex flex-col items-center p-4 rounded-2xl bg-[#141824] border border-neutral-850">
                  <span className="w-10 h-10 rounded-full border-2 border-white mb-2 shadow-lg" style={{ backgroundColor: curMatch.p2.color }} />
                  <span className="font-bold text-sm text-white truncate max-w-full">{curMatch.p2.name}</span>
                  {/* Health Bar */}
                  <div className="w-full bg-neutral-800 h-2.5 rounded-full mt-3 overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${activeDuel.hp2}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 mt-1">{activeDuel.hp2} HP</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121622] text-center text-xs text-neutral-300 font-medium">
                {activeDuel.log}
              </div>

              <button
                onClick={handlePlayCurrentMatch}
                disabled={activeDuel.fighting || champion !== null}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-400 hover:from-indigo-400 hover:to-blue-300 text-black font-black text-sm transition shadow-lg shadow-indigo-500/25 disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>{activeDuel.fighting ? "⚔️" : "🥊"}</span>
                <span>{activeDuel.fighting ? "PELEANDO EN VIVO..." : "¡LUCHAR ESTE DUELO!"}</span>
              </button>
            </div>
          )}

          {/* 2. Visual Tournament Bracket Tree */}
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>🌳</span>
              <span>Árbol de Llaves del Torneo</span>
            </h3>

            {matches.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
                Carga 8 participantes y pulsa &quot;Generar Cuadro&quot; para armar las llaves.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 items-center">
                {/* Cuartos (4 matches) */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold uppercase text-neutral-500 text-center">Cuartos</span>
                  {matches.slice(0, 4).map((m, idx) => (
                    <div key={m.id} className={`p-2 rounded-xl border text-[11px] flex flex-col gap-1 transition ${m.status === "finished" ? "border-indigo-500/60 bg-indigo-950/20" : "border-neutral-800 bg-[#131622]"}`}>
                      <div className={`flex items-center gap-1.5 truncate ${m.winner?.id === m.p1?.id ? "font-bold text-amber-400" : "text-neutral-300"}`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.p1?.color }} />
                        <span className="truncate">{m.p1?.name ?? "—"}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 truncate ${m.winner?.id === m.p2?.id ? "font-bold text-amber-400" : "text-neutral-300"}`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.p2?.color }} />
                        <span className="truncate">{m.p2?.name ?? "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Semis (2 matches) */}
                <div className="flex flex-col gap-8 justify-around">
                  <span className="text-[10px] font-bold uppercase text-indigo-400 text-center">Semifinal</span>
                  {matches.slice(4, 6).map((m) => (
                    <div key={m.id} className={`p-2.5 rounded-xl border text-[11px] flex flex-col gap-1.5 transition ${m.status === "finished" ? "border-indigo-500 bg-indigo-950/30" : "border-neutral-800 bg-[#131622]"}`}>
                      <div className={`flex items-center gap-1.5 truncate ${m.winner?.id === m.p1?.id ? "font-bold text-amber-400" : "text-neutral-300"}`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.p1?.color }} />
                        <span className="truncate">{m.p1?.name ?? "Esperando..."}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 truncate ${m.winner?.id === m.p2?.id ? "font-bold text-amber-400" : "text-neutral-300"}`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.p2?.color }} />
                        <span className="truncate">{m.p2?.name ?? "Esperando..."}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final (1 match) */}
                <div className="flex flex-col gap-4 justify-center">
                  <span className="text-[10px] font-bold uppercase text-amber-400 text-center">👑 Gran Final</span>
                  {matches[6] && (
                    <div className={`p-3 rounded-2xl border text-xs flex flex-col gap-2 transition ${matches[6].status === "finished" ? "border-amber-400 bg-amber-950/20 shadow-lg shadow-amber-500/10" : "border-indigo-900 bg-[#141824]"}`}>
                      <div className={`flex items-center gap-2 truncate ${matches[6].winner?.id === matches[6].p1?.id ? "font-black text-amber-300" : "text-white"}`}>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: matches[6].p1?.color }} />
                        <span className="truncate">{matches[6].p1?.name ?? "Finalista 1"}</span>
                      </div>
                      <div className={`flex items-center gap-2 truncate ${matches[6].winner?.id === matches[6].p2?.id ? "font-black text-amber-300" : "text-white"}`}>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: matches[6].p2?.color }} />
                        <span className="truncate">{matches[6].p2?.name ?? "Finalista 2"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
            disabled={tournamentStarted}
            betCandidateId={betCandidateId}
            onSelectCandidate={setBetCandidateId}
            betAmount={betAmount}
            onChangeBetAmount={setBetAmount}
          />
        </div>
      </div>

      {/* Champion Modal */}
      {showWinnerModal && champion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-gradient-to-b from-[#192244] to-[#0a0d1a] border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">🏆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400">
              ¡CAMPEÓN DEL TORNEO DE LLAVES!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#12162b] border border-indigo-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: champion.color }}
              />
              <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">
                Ganador de Cuartos, Semis y Final
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
                  ? `🎉 ¡Acertaste al campeón del cuadro! Cobraste $${formatFichas(betAmount * 8)} fichas`
                  : `❌ Tu elegido no ganó la gran final.`}
              </div>
            )}

            <button
              onClick={() => {
                setShowWinnerModal(false);
                setTournamentStarted(false);
              }}
              className="w-full py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-black font-bold text-sm transition shadow-lg shadow-indigo-500/25"
            >
              Cerrar y Nuevo Cuadro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
