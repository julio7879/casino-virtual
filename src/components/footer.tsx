import React from "react";
import Link from "next/link";
import { CASINO_GAMES } from "@/lib/games-data";
import { LEGAL_LINE } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="w-full bg-[#08090d] border-t border-neutral-800/80 mt-16 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-800/60">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-black font-black text-sm">
                👑
              </div>
              <span className="font-black text-lg tracking-wider text-white">
                NOGAL <span className="gold-gradient-text">ROYALE</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mb-4">
              Plataforma de entretenimiento con simuladores de juegos de casino virtual de alta fidelidad. Disfruta de la emoción del casino de forma responsable.
            </p>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono">
                +18 AÑOS
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                ✓ Juego Seguro
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                🛡️ Provably Fair
              </span>
            </div>
          </div>

          {/* Games list 1 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Juegos Populares
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              {CASINO_GAMES.slice(0, 5).map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/games/${game.slug}`}
                    className="hover:text-amber-400 transition flex items-center gap-1.5"
                  >
                    <span>{game.icon}</span>
                    <span>{game.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Games list 2 */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Mesas & Cartas
            </h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              {CASINO_GAMES.slice(5).map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/games/${game.slug}`}
                    className="hover:text-amber-400 transition flex items-center gap-1.5"
                  >
                    <span>{game.icon}</span>
                    <span>{game.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom disclaimer */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-neutral-400 text-center md:text-left">
          <p>
            {LEGAL_LINE} Este sitio es una simulación virtual exclusivamente para fines recreativos. Las fichas no tienen valor monetario real ni pueden canjearse por dinero en efectivo.
          </p>
          <p className="shrink-0">
            Listo para desplegar en <strong className="text-neutral-300">Vercel</strong> con backend <strong className="text-emerald-400">Supabase</strong>.
          </p>
        </div>
      </div>
    </footer>
  );
}
