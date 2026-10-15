"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";
import DailyBonusModal from "./daily-bonus-modal";
import AuthModal from "./auth-modal";

export default function Navbar() {
  const {
    balance,
    user,
    isGuest,
    soundEnabled,
    toggleSound,
    reloadChips,
    canClaimDaily,
    signOut,
  } = useWallet();

  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#0c0e14]/90 backdrop-blur-md border-b border-neutral-800/80">
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group transition hover:opacity-95 shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 flex items-center justify-center text-black font-black text-xl shadow-lg shadow-amber-500/20 group-hover:scale-105 transition">
              👑
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-wider text-white flex items-center gap-1.5">
                NOGAL <span className="gold-gradient-text">ROYALE</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold -mt-1">
                Virtual Casino
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (desktop) */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-semibold text-neutral-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>🏛️</span>
              <span>Lobby</span>
            </Link>
            <Link
              href="/games/crash"
              className="text-sm font-semibold text-neutral-300 hover:text-white transition"
            >
              Crash
            </Link>
            <Link
              href="/games/mines"
              className="text-sm font-semibold text-neutral-300 hover:text-white transition"
            >
              Minas
            </Link>
            <Link
              href="/games/roulette"
              className="text-sm font-semibold text-neutral-300 hover:text-white transition"
            >
              Ruleta
            </Link>
            <Link
              href="/games/blackjack"
              className="text-sm font-semibold text-neutral-300 hover:text-white transition"
            >
              Blackjack
            </Link>
            <Link
              href="/games/slots"
              className="text-sm font-semibold text-neutral-300 hover:text-white transition"
            >
              Slots
            </Link>
          </nav>

          {/* Right Controls: Balance, Bono, Sound, Profile */}
          <div className="flex items-center gap-2.5">
            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? "Desactivar Sonido" : "Activar Sonido"}
              className="w-9 h-9 rounded-xl bg-[#161a25] hover:bg-[#1f2434] border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center text-base transition"
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>

            {/* Daily Bonus Button */}
            <button
              onClick={() => setShowDailyModal(true)}
              className="relative hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-yellow-500/15 hover:from-amber-500/25 hover:to-yellow-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition"
            >
              <span>🎁</span>
              <span>Bono Diario</span>
              {canClaimDaily && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>

            {/* Balance Card */}
            <div className="flex items-center gap-2 bg-[#141824] border border-neutral-700/80 rounded-2xl py-1.5 px-3 shadow-inner">
              <div className="flex flex-col text-right">
                <span className="text-[9px] uppercase font-bold text-neutral-400 tracking-wider">
                  Saldo
                </span>
                <span className="font-mono font-black text-sm text-amber-400">
                  ${formatFichas(balance)}
                </span>
              </div>
              <button
                onClick={() => reloadChips(5000)}
                title="Recargar fichas de cortesía gratis"
                className="w-7 h-7 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-black font-black text-sm flex items-center justify-center transition border border-amber-500/40"
              >
                +
              </button>
            </div>

            {/* Auth / Profile */}
            {isGuest ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#191f2d] hover:bg-[#232b3e] border border-neutral-700 text-xs font-bold text-neutral-200 hover:text-white transition flex items-center gap-1.5"
              >
                <span>👤</span>
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-bold text-emerald-300 hover:bg-emerald-900/40 transition flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="max-w-[100px] truncate">{user?.email?.split("@")[0]}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#141824] border border-neutral-800 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in">
                    <div className="px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">
                      Conectado como:
                      <div className="font-bold text-white truncate">{user?.email}</div>
                    </div>
                    <button
                      onClick={() => {
                        signOut();
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition mt-1"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modals */}
      <DailyBonusModal
        isOpen={showDailyModal}
        onClose={() => setShowDailyModal(false)}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
