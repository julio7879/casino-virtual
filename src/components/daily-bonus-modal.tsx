"use client";

import React, { useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { DAILY_STREAK } from "@/lib/constants";
import { formatFichas } from "@/lib/format";

type DailyBonusModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function DailyBonusModal({ isOpen, onClose }: DailyBonusModalProps) {
  const { dailyStreak, canClaimDaily, claimDailyBonus } = useWallet();
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClaim = async () => {
    setLoading(true);
    const res = await claimDailyBonus();
    setResultMsg(res.message);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#11151e] border border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl shadow-amber-500/10">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 mb-3 text-3xl animate-bounce">
            🎁
          </div>
          <h2 className="text-2xl font-black text-white">Bono de Racha Diaria</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Entra cada día para desbloquear recompensas cada vez mayores.
          </p>
        </div>

        {/* 7-day streak boxes */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const amount = DAILY_STREAK[day] ?? 1000;
            const isCurrent = day === dailyStreak;
            const isPast = day < dailyStreak;

            let borderStyle = "border-neutral-800 bg-neutral-900/60 text-neutral-400";
            if (isCurrent) {
              borderStyle = "border-amber-400 bg-amber-500/20 text-amber-300 ring-2 ring-amber-400/50 scale-105";
            } else if (isPast) {
              borderStyle = "border-emerald-600/60 bg-emerald-950/30 text-emerald-400";
            }

            return (
              <div
                key={day}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition ${borderStyle}`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Día {day}
                </span>
                <span className="text-lg my-1">
                  {isPast ? "✓" : day === 7 ? "👑" : "💰"}
                </span>
                <span className="text-xs font-mono font-black">
                  +{formatFichas(amount)}
                </span>
              </div>
            );
          })}
        </div>

        {resultMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm text-center font-medium">
            {resultMsg}
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleClaim}
            disabled={!canClaimDaily || loading}
            className={`w-full py-4 rounded-2xl font-black text-base transition flex items-center justify-center gap-2 shadow-lg ${
              canClaimDaily
                ? "bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black shadow-amber-500/25 active:scale-95"
                : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            }`}
          >
            {loading ? (
              "Reclamando..."
            ) : canClaimDaily ? (
              <>
                <span>✨ Reclamar Bono de Hoy</span>
                <span className="font-mono bg-black/20 px-2 py-0.5 rounded-lg text-sm">
                  +${formatFichas(DAILY_STREAK[dailyStreak] ?? 500)}
                </span>
              </>
            ) : (
              "Ya reclamado hoy (¡Vuelve mañana!)"
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-xs text-neutral-400 hover:text-neutral-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
