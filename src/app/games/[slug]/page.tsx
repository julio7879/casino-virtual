"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { CASINO_GAMES } from "@/lib/games-data";
import CrashGame from "@/components/games/crash-game";
import MinesGame from "@/components/games/mines-game";
import RouletteGame from "@/components/games/roulette-game";
import BlackjackGame from "@/components/games/blackjack-game";
import SlotsGame from "@/components/games/slots-game";
import PlinkoGame from "@/components/games/plinko-game";
import VideoPokerGame from "@/components/games/videopoker-game";
import DiceGame from "@/components/games/dice-game";
import BaccaratGame from "@/components/games/baccarat-game";
import WheelGame from "@/components/games/wheel-game";
import CustomRouletteGame from "@/components/games/custom-roulette-game";
import MarbleRaceGame from "@/components/games/marble-race-game";
import HorseRaceGame from "@/components/games/horse-race-game";
import CrashRoyaleGame from "@/components/games/crash-royale-game";
import MinesRoyaleGame from "@/components/games/mines-royale-game";
import PenaltiesGame from "@/components/games/penalties-game";
import SumoArenaGame from "@/components/games/sumo-arena-game";
import BracketTournamentGame from "@/components/games/bracket-tournament-game";
import DuckRaceGame from "@/components/games/duck-race-game";
import GlassBridgeGame from "@/components/games/glass-bridge-game";
import PachinkoGame from "@/components/games/pachinko-game";
import Coliseum3DGame from "@/components/games/coliseum-3d-game";

export default function GamePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const game = CASINO_GAMES.find((g) => g.slug === slug);
  const [showRules, setShowRules] = useState(false);

  if (!game) {
    notFound();
  }

  const renderGameComponent = () => {
    switch (game.id) {
      case "crash":
        return <CrashGame />;
      case "mines":
        return <MinesGame />;
      case "roulette":
        return <RouletteGame />;
      case "blackjack":
        return <BlackjackGame />;
      case "slots":
        return <SlotsGame />;
      case "plinko":
        return <PlinkoGame />;
      case "videopoker":
        return <VideoPokerGame />;
      case "dice":
        return <DiceGame />;
      case "baccarat":
        return <BaccaratGame />;
      case "wheel":
        return <WheelGame />;
      case "ruleta-nombres":
        return <CustomRouletteGame />;
      case "carrera-canicas":
        return <MarbleRaceGame />;
      case "carrera-caballos":
        return <HorseRaceGame />;
      case "crash-royale":
        return <CrashRoyaleGame />;
      case "minas-royale":
        return <MinesRoyaleGame />;
      case "penaltis-royale":
        return <PenaltiesGame />;
      case "ring-sumo":
        return <SumoArenaGame />;
      case "torneo-bracket":
        return <BracketTournamentGame />;
      case "carrera-patos":
        return <DuckRaceGame />;
      case "puente-cristal":
        return <GlassBridgeGame />;
      case "pachinko-royale":
        return <PachinkoGame />;
      case "coliseo-3d":
        return <Coliseum3DGame />;
      default:
        return <div>Juego no disponible</div>;
    }
  };




  return (
    <div className="w-full flex-1 flex flex-col px-4 py-6 max-w-7xl mx-auto">
      {/* Game Header Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-[#141824] hover:bg-[#1f2436] border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition"
          >
            ←
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">{game.icon}</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                {game.title}
                {game.badge && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    {game.badge}
                  </span>
                )}
              </h1>
              <p className="text-xs text-neutral-400">{game.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRules(true)}
            className="px-3 py-1.5 rounded-xl bg-[#141824] hover:bg-[#1d2334] border border-neutral-700 text-xs font-semibold text-neutral-300 hover:text-white transition flex items-center gap-1.5"
          >
            <span>📜</span>
            <span className="hidden sm:inline">Reglas & RTP</span>
          </button>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="flex-1 flex flex-col justify-center">
        {renderGameComponent()}
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#121622] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">{game.icon}</span>
              <h3 className="text-lg font-black text-white">Reglas: {game.title}</h3>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs">
              <div>
                <span className="text-neutral-400">RTP Teórico:</span>{" "}
                <strong className="text-emerald-400 font-mono font-bold">{game.rtp}%</strong>
              </div>
              <div className="text-neutral-600">•</div>
              <div>
                <span className="text-neutral-400">Categoría:</span>{" "}
                <strong className="text-neutral-200">{game.categoryName}</strong>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed mb-4">
              {game.description}
            </p>

            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Cómo jugar:
            </h4>
            <ul className="space-y-2 mb-6">
              {game.rules.map((rule, i) => (
                <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setShowRules(false)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              Entendido, volver a jugar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
