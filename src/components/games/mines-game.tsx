"use client";

import React, { useState } from "react";
import BetSelector from "@/components/bet-selector";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas, formatMult } from "@/lib/format";
import { sounds } from "@/lib/audio";
import { minesMultiplier, MINES_TILES } from "@/lib/engine/mines";

type TileState = "hidden" | "gem" | "bomb";

export default function MinesGame() {
  const { balance, placeBet, awardWin } = useWallet();
  const [bet, setBet] = useState<number>(50);
  const [mineCount, setMineCount] = useState<number>(3);
  const [inGame, setInGame] = useState<boolean>(false);
  const [tiles, setTiles] = useState<TileState[]>(Array(MINES_TILES).fill("hidden"));
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);

  const currentMult = minesMultiplier(0.02, mineCount, revealedCount);
  const nextMult = minesMultiplier(0.02, mineCount, revealedCount + 1);

  const startGame = () => {
    if (bet > balance || bet <= 0) {
      sounds.playLose();
      return;
    }

    const ok = placeBet(bet, "mines", "Minas del Faraón");
    if (!ok) return;

    // Pick random mine locations
    const positions = new Set<number>();
    while (positions.size < mineCount) {
      positions.add(Math.floor(Math.random() * MINES_TILES));
    }

    setMinePositions(positions);
    setTiles(Array(MINES_TILES).fill("hidden"));
    setRevealedCount(0);
    setGameOver(false);
    setWon(false);
    setInGame(true);
  };

  const handleTileClick = (index: number) => {
    if (!inGame || gameOver || tiles[index] !== "hidden") return;

    if (minePositions.has(index)) {
      // Hit a mine!
      sounds.playCrash();
      const newTiles = [...tiles];
      newTiles[index] = "bomb";
      // Reveal all other tiles
      minePositions.forEach((pos) => {
        newTiles[pos] = "bomb";
      });
      setTiles(newTiles);
      setGameOver(true);
      setInGame(false);
      setWon(false);
    } else {
      // Gem discovered!
      sounds.playGem();
      const newTiles = [...tiles];
      newTiles[index] = "gem";
      setTiles(newTiles);
      const nextCount = revealedCount + 1;
      setRevealedCount(nextCount);

      // Check if all safe tiles cleared
      if (nextCount === MINES_TILES - mineCount) {
        handleCashOut(nextCount);
      }
    }
  };

  const handleCashOut = (countOverride?: number) => {
    if (!inGame || gameOver) return;
    const count = countOverride ?? revealedCount;
    if (count <= 0) return;

    const mult = minesMultiplier(0.02, mineCount, count);
    const payout = Math.round(bet * mult);

    awardWin(payout, "mines", "Minas del Faraón", mult);

    // Reveal where remaining mines were
    const newTiles = [...tiles];
    minePositions.forEach((pos) => {
      if (newTiles[pos] === "hidden") {
        newTiles[pos] = "bomb";
      }
    });
    setTiles(newTiles);
    setWon(true);
    setGameOver(true);
    setInGame(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 5x5 Mines Grid */}
      <div className="lg:col-span-2 bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">💣</span>
            <span className="font-bold text-white text-sm">MINAS DEL FARAÓN (5x5)</span>
          </div>
          {inGame && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Próximo:</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
                {formatMult(nextMult)}
              </span>
            </div>
          )}
        </div>

        {/* The 25 Grid */}
        <div className="grid grid-cols-5 gap-2.5 sm:gap-3.5 max-w-md mx-auto w-full my-auto py-2">
          {tiles.map((state, idx) => {
            let bg = "bg-[#181e2c] hover:bg-[#232b3e] border-neutral-700/80";
            let content = null;

            if (state === "gem") {
              bg = "bg-amber-500/20 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/20 scale-95";
              content = <span className="text-2xl sm:text-3xl animate-bounce">💎</span>;
            } else if (state === "bomb") {
              bg = "bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/20 scale-95";
              content = <span className="text-2xl sm:text-3xl animate-ping">💣</span>;
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleTileClick(idx)}
                disabled={!inGame || state !== "hidden"}
                className={`aspect-square rounded-2xl border-2 flex items-center justify-center transition duration-150 active:scale-95 disabled:cursor-default ${bg}`}
              >
                {content}
              </button>
            );
          })}
        </div>

        {/* Bottom Status bar */}
        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
          <span>Diamantes: {revealedCount} / {MINES_TILES - mineCount}</span>
          <span>Minas Ocultas: {mineCount}</span>
        </div>
      </div>

      {/* Control Panel */}
      <div className="flex flex-col gap-4">
        <BetSelector
          bet={bet}
          setBet={setBet}
          minBet={10}
          maxBet={5000}
          disabled={inGame}
        />

        {/* Mines count selector */}
        <div className="bg-[#12161f] border border-neutral-800/80 rounded-2xl p-4">
          <label className="block text-xs font-semibold text-neutral-400 mb-2">
            Cantidad de Minas (1 - 24)
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {[1, 3, 5, 10, 24].map((count) => (
              <button
                key={count}
                type="button"
                disabled={inGame}
                onClick={() => setMineCount(count)}
                className={`py-1.5 rounded-lg text-xs font-bold font-mono transition border ${
                  mineCount === count
                    ? "bg-amber-500 text-black border-amber-400"
                    : "bg-[#181e2b] text-neutral-300 border-neutral-700/80 hover:bg-neutral-800"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="24"
            value={mineCount}
            disabled={inGame}
            onChange={(e) => setMineCount(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Main Action Buttons */}
        {inGame ? (
          <button
            onClick={() => handleCashOut()}
            disabled={revealedCount === 0}
            className={`w-full py-5 rounded-2xl font-black text-xl transition shadow-xl flex flex-col items-center justify-center ${
              revealedCount === 0
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-black shadow-emerald-500/30 active:scale-95 animate-pulse"
            }`}
          >
            <span>RETIRAR GANANCIAS</span>
            <span className="text-sm font-mono font-bold mt-0.5">
              ${formatFichas(Math.round(bet * currentMult))} ({formatMult(currentMult)})
            </span>
          </button>
        ) : (
          <button
            onClick={startGame}
            disabled={bet > balance || bet <= 0}
            className="w-full py-5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-black font-black text-xl rounded-2xl transition shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-50"
          >
            JUGAR MINAS
          </button>
        )}

        {gameOver && (
          <div
            className={`p-4 rounded-2xl border text-center font-bold text-sm animate-in fade-in ${
              won
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-red-500/15 border-red-500/40 text-red-300"
            }`}
          >
            {won ? (
              <div>
                ¡Felicidades! Has cobrado{" "}
                <span className="font-mono text-emerald-200">
                  ${formatFichas(Math.round(bet * currentMult))}
                </span>
              </div>
            ) : (
              <div>¡BOOM! Tocaste una mina y perdiste la apuesta.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
