"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CASINO_GAMES, GameCategory } from "@/lib/games-data";
import RecentWinsTicker from "@/components/recent-wins-ticker";
import { formatFichas } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import DailyBonusModal from "@/components/daily-bonus-modal";

export default function Home() {
  const { balance, canClaimDaily } = useWallet();
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [jackpot, setJackpot] = useState(1284590);
  const [showDailyModal, setShowDailyModal] = useState(false);

  // Progressive jackpot tick animation
  useEffect(() => {
    const timer = setInterval(() => {
      setJackpot((prev) => prev + Math.floor(Math.random() * 25 + 5));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const filteredGames = CASINO_GAMES.filter((game) => {
    const matchesCategory =
      selectedCategory === "all" || game.category === selectedCategory;
    const matchesSearch =
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* Live Wins Ticker */}
      <RecentWinsTicker />

      {/* Hero Banner Section */}
      <section className="relative w-full py-12 md:py-20 px-4 overflow-hidden border-b border-neutral-800/80 bg-gradient-to-b from-[#111624] via-[#0d101a] to-[#0a0c10]">
        {/* Glow ambient background orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10 relative z-10">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-4">
              <span>✨</span>
              <span>{CASINO_GAMES.length} JUEGOS VIRTUALES EXCLUSIVOS</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Vive la emoción de un{" "}
              <span className="gold-gradient-text drop-shadow-lg">
                Casino Real
              </span>{" "}
              en tu pantalla.
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base mt-4 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Ruleta de Nombres con Canica 3D, Crash Rocket, Blackjack 21, Minas, Ruleta Europea, Slots 777 y más. Juega gratis con tus 10,000 fichas de bienvenida y recompensas diarias.
            </p>


            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-8">
              <Link
                href="/games/crash"
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-base transition shadow-xl shadow-amber-500/25 active:scale-95 flex items-center gap-2"
              >
                <span>🚀</span>
                <span>Jugar Crash Ahora</span>
              </Link>

              <button
                onClick={() => setShowDailyModal(true)}
                className="px-6 py-4 rounded-2xl bg-[#181e2e] hover:bg-[#232b40] border border-neutral-700 text-white font-bold text-sm transition flex items-center gap-2"
              >
                <span>🎁</span>
                <span>Bono Diario</span>
                {canClaimDaily && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Progressive Jackpot Box */}
          <div className="w-full max-w-md bg-gradient-to-b from-[#181d2c] to-[#0f121d] border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400/90 block mb-1">
              ★ MEGA JACKPOT PROGRESIVO ★
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-black text-white tracking-tight drop-shadow-[0_0_25px_rgba(245,158,11,0.4)] my-2">
              ${formatFichas(jackpot)}
            </div>
            <p className="text-xs text-neutral-400">
              Acumulado en tiempo real entre todos los jugadores
            </p>

            <div className="mt-6 pt-5 border-t border-neutral-800 flex items-center justify-around text-xs">
              <div>
                <span className="text-neutral-400 block">Tu Saldo</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  ${formatFichas(balance)}
                </span>
              </div>
              <div className="h-8 w-px bg-neutral-800" />
              <div>
                <span className="text-neutral-400 block">Juegos Disponibles</span>
                <span className="font-bold text-emerald-400 text-sm">10 Activos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Games Catalog Section */}
      <section className="max-w-7xl mx-auto px-4 py-12 w-full flex-1">
        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 no-scrollbar">
            {[
              { id: "all" as GameCategory, label: `Todos (${CASINO_GAMES.length})`, icon: "✨" },
              { id: "competition" as GameCategory, label: `Torneos & Nombres (${CASINO_GAMES.filter((g) => g.category === "competition").length})`, icon: "🏆" },
              { id: "arcade" as GameCategory, label: "Arcade & Crash", icon: "🚀" },
              { id: "table" as GameCategory, label: "Ruleta & Mesa", icon: "🎡" },
              { id: "cards" as GameCategory, label: "Cartas & Blackjack", icon: "🃏" },
              { id: "slots" as GameCategory, label: "Tragamonedas", icon: "🎰" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 border ${
                  selectedCategory === cat.id
                    ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20"
                    : "bg-[#121622] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar juego..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121622] border border-neutral-800 focus:border-amber-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none transition"
            />
          </div>
        </div>

        {/* 10 Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {filteredGames.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="group relative bg-[#0f131d] border border-neutral-800/90 hover:border-neutral-700 rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/60 overflow-hidden"
            >
              {/* Gradient card background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-50 group-hover:opacity-80 transition duration-300`}
              />

              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  {/* Badge & Category */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      {game.categoryName}
                    </span>
                    {game.badge && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-black/50 border border-neutral-700 text-amber-300">
                        {game.badge}
                      </span>
                    )}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-black/40 border border-neutral-700/60 flex items-center justify-center text-3xl shadow-lg mb-4 group-hover:scale-110 transition duration-200">
                    {game.icon}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition">
                    {game.title}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {game.subtitle}
                  </p>
                </div>

                {/* Card Footer: RTP & Play Button */}
                <div className="mt-6 pt-4 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-3 font-mono">
                    <span>RTP: <strong className="text-emerald-400">{game.rtp}%</strong></span>
                    <span>Min: ${game.minBet}</span>
                  </div>

                  <div className="w-full py-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500 border border-amber-500/30 group-hover:border-amber-400 text-amber-400 group-hover:text-black font-black text-xs text-center uppercase tracking-wider transition">
                    Jugar Ahora →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="text-center py-16 text-neutral-400">
            No se encontraron juegos con ese nombre.
          </div>
        )}
      </section>

      {/* Features & Safe Gaming Section */}
      <section className="max-w-7xl mx-auto px-4 py-12 w-full border-t border-neutral-800/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0e121a] border border-neutral-800 rounded-3xl p-6">
            <span className="text-3xl mb-3 block">🛡️</span>
            <h4 className="text-base font-bold text-white mb-1">
              Simulación Segura & Gratuita
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Juego puramente virtual sin apuestas de dinero real. Recarga tus fichas de cortesía en cualquier momento con 1 clic.
            </p>
          </div>

          <div className="bg-[#0e121a] border border-neutral-800 rounded-3xl p-6">
            <span className="text-3xl mb-3 block">⚡</span>
            <h4 className="text-base font-bold text-white mb-1">
              Despliegue Rápido en Vercel
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Construido con Next.js 16 y optimizado para funcionar al 100% en Vercel con persistencia en Supabase.
            </p>
          </div>

          <div className="bg-[#0e121a] border border-neutral-800 rounded-3xl p-6">
            <span className="text-3xl mb-3 block">🎁</span>
            <h4 className="text-base font-bold text-white mb-1">
              Rachas & Bono Diario
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Reclama fichas adicionales cada 24 horas y aumenta tu multiplicador de racha hasta el día 7.
            </p>
          </div>
        </div>
      </section>

      {/* Daily Bonus Modal */}
      <DailyBonusModal
        isOpen={showDailyModal}
        onClose={() => setShowDailyModal(false)}
      />
    </div>
  );
}
