"use client";

import React from "react";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";

export default function RecentWinsTicker() {
  const { recentWins } = useWallet();

  return (
    <div className="w-full bg-[#0d1017] border-y border-neutral-800/80 py-2.5 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider shrink-0 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>En Vivo</span>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {recentWins.map((win) => (
            <div
              key={win.id}
              className="flex items-center gap-2 bg-[#141824] border border-neutral-800/90 hover:border-neutral-700 px-3 py-1 rounded-xl text-xs shrink-0 transition"
            >
              <span className="text-neutral-400 font-medium">{win.user}</span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-300 font-semibold">{win.gameTitle}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px]">
                {win.multiplier}x
              </span>
              <span className="text-amber-400 font-mono font-bold">
                +${formatFichas(win.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
