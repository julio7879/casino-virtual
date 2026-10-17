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

interface TileState {
  index: number;
  isBomb: boolean;
  revealed: boolean;
  revealedBy?: string; // Player name
}

export default function MinesRoyaleGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `mn-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
      score: 0,
      eliminated: false,
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  // 36 Tiles Grid (6x6)
  const [grid, setGrid] = useState<TileState[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>("Configura los jugadores y pulsa Iniciar.");
  const [champion, setChampion] = useState<PlayerParticipant | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
      score: 0,
      eliminated: false,
    }));
  };

  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        rebindParticipants(saved.map((name, i) => ({ id: `mn-${i}-${Date.now()}`, name })))
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    setParticipants(rebindParticipants([...participants, { id: `mn-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `mnb-${i}-${Date.now()}`, name })))
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
        DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `mns-${i}`, name }))
      )
    );
  };

  const handleClear = () => {
    setParticipants([]);
    setBetCandidateId(null);
  };

  // Setup 36 Tiles with ~10 hidden mines
  const initBoard = () => {
    const totalTiles = 36;
    const mineCount = 10;
    const bombIndices = new Set<number>();
    while (bombIndices.size < mineCount) {
      bombIndices.add(Math.floor(Math.random() * totalTiles));
    }

    const newGrid: TileState[] = [];
    for (let i = 0; i < totalTiles; i++) {
      newGrid.push({
        index: i,
        isBomb: bombIndices.has(i),
        revealed: false,
      });
    }
    setGrid(newGrid);
  };

  useEffect(() => {
    initBoard();
  }, []);

  // Start Battle
  const handleStartGame = () => {
    if (playing || participants.length < 2) return;

    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "minas-royale", "Mina Royale Supervivencia");
      if (!ok) return;
    }

    // Reset scores & status
    const reset = participants.map((p) => ({ ...p, score: 0, eliminated: false }));
    setParticipants(reset);
    initBoard();
    setActivePlayerIndex(0);
    setPlaying(true);
    setChampion(null);
    setShowResultModal(false);
    setLastEvent(`¡Comienza el juego! Turno de: ${reset[0].name}`);
    sounds.playDeal();
  };

  // Active players
  const alivePlayers = participants.filter((p) => !p.eliminated);

  // Handle Tile Click / Turn
  const handleTileClick = (tileIndex: number) => {
    if (!playing || grid[tileIndex].revealed) return;
    if (alivePlayers.length === 0) return;

    const currentPlayer = participants[activePlayerIndex];
    if (currentPlayer.eliminated) {
      nextTurn();
      return;
    }

    const tile = grid[tileIndex];
    const isBomb = tile.isBomb;

    // Reveal tile
    const updatedGrid = [...grid];
    updatedGrid[tileIndex] = {
      ...tile,
      revealed: true,
      revealedBy: currentPlayer.name,
    };
    setGrid(updatedGrid);

    if (isBomb) {
      // BOOM! Player Eliminated
      sounds.playCrash();
      setLastEvent(`💥 ¡BOOM! ${currentPlayer.name} pisó una mina y queda ELIMINADO.`);

      const updatedParticipants = participants.map((p) =>
        p.id === currentPlayer.id ? { ...p, eliminated: true } : p
      );
      setParticipants(updatedParticipants);

      const remainingAlive = updatedParticipants.filter((p) => !p.eliminated);

      if (remainingAlive.length <= 1) {
        // We have a winner!
        endGame(remainingAlive[0] ?? currentPlayer);
        return;
      }
    } else {
      // Gem Found! Score point
      sounds.playGem();
      setLastEvent(`💎 ¡Excelente! ${currentPlayer.name} encontró un diamante.`);

      const updatedParticipants = participants.map((p) =>
        p.id === currentPlayer.id ? { ...p, score: (p.score ?? 0) + 1 } : p
      );
      setParticipants(updatedParticipants);
    }

    // Advance to next alive player
    nextTurn();
  };

  const nextTurn = () => {
    let nextIdx = (activePlayerIndex + 1) % participants.length;
    // Find next non-eliminated
    let attempts = 0;
    while (participants[nextIdx].eliminated && attempts < participants.length) {
      nextIdx = (nextIdx + 1) % participants.length;
      attempts++;
    }
    setActivePlayerIndex(nextIdx);
  };

  const endGame = (winnerPlayer: PlayerParticipant) => {
    setPlaying(false);
    setChampion(winnerPlayer);
    setShowResultModal(true);
    sounds.playBigWin();

    if (betAmount > 0 && betCandidateId) {
      if (winnerPlayer.id === betCandidateId) {
        const mult = participants.length;
        const payout = betAmount * mult;
        awardWin(payout, "minas-royale", "Mina Royale Supervivencia", mult);
      } else {
        sounds.playLose();
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#20170a] via-[#32230e] to-[#140e06] border border-amber-900/40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
            💣
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Mina Royale Supervivencia
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                BATALLA DE TABLERO
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Los jugadores eligen casillas por turnos. Encuentra gemas o explota hasta que solo quede
              uno con vida.
            </p>
          </div>
        </div>

        <button
          onClick={handleStartGame}
          disabled={playing || participants.length < 2}
          className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm transition shadow-xl shadow-amber-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
        >
          <span>{playing ? "⚔️" : "🎮"}</span>
          <span>{playing ? "¡EN BATALLA...!" : "¡INICIAR PARTIDA!"}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Board Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            {/* Active Turn Banner */}
            {playing && (
              <div className="w-full mb-5 p-3 rounded-2xl bg-neutral-900/80 border border-neutral-700 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Turno Actual:</span>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full animate-pulse"
                    style={{ backgroundColor: participants[activePlayerIndex]?.color }}
                  />
                  <span className="text-sm font-black text-amber-400">
                    {participants[activePlayerIndex]?.name}
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  💎 {participants[activePlayerIndex]?.score} gemas
                </span>
              </div>
            )}

            {/* 6x6 Mystery Grid */}
            <div className="grid grid-cols-6 gap-2.5 sm:gap-3 w-full max-w-lg aspect-square">
              {grid.map((tile) => (
                <button
                  key={tile.index}
                  disabled={!playing || tile.revealed}
                  onClick={() => handleTileClick(tile.index)}
                  className={`rounded-2xl flex items-center justify-center font-bold text-xl sm:text-2xl transition duration-200 border ${
                    !tile.revealed
                      ? "bg-[#181e2e] hover:bg-[#252f48] border-neutral-750 hover:border-amber-500/50 hover:scale-105 shadow-md active:scale-95"
                      : tile.isBomb
                      ? "bg-rose-950/80 border-rose-600 text-rose-400 animate-in zoom-in-50"
                      : "bg-emerald-950/60 border-emerald-500/60 text-emerald-300 animate-in zoom-in-50"
                  }`}
                >
                  {!tile.revealed ? (
                    <span className="text-neutral-600 text-sm">❓</span>
                  ) : tile.isBomb ? (
                    "💣"
                  ) : (
                    "💎"
                  )}
                </button>
              ))}
            </div>

            {/* Event log feed */}
            <div className="w-full mt-5 p-3.5 rounded-2xl bg-[#121622] border border-neutral-800 text-center text-xs text-neutral-300 font-medium">
              {lastEvent}
            </div>
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
          <div className="w-full max-w-md bg-gradient-to-b from-[#291e0f] to-[#0d0904] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-90">
            <div className="text-5xl mb-2 animate-bounce">🏆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
              ¡SUPERVIVIENTE SUPREMO!
            </span>

            <div className="my-5 p-5 rounded-2xl bg-[#1a140b] border border-amber-500/40 shadow-inner flex flex-col items-center">
              <span
                className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow-lg"
                style={{ backgroundColor: champion.color }}
              />
              <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                Sobrevivió con {champion.score} Gemas
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
                  ? `🎉 ¡Tu jugador sobrevivió al campo minado! Cobraste $${formatFichas(
                      betAmount * participants.length
                    )} fichas`
                  : `❌ Tu jugador fue eliminado por las minas.`}
              </div>
            )}

            <button
              onClick={() => setShowResultModal(false)}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition shadow-lg shadow-amber-500/25"
            >
              Cerrar y Nueva Partida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
