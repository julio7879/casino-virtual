"use client";

import React, { useState } from "react";
import { sounds } from "@/lib/audio";
import { formatFichas } from "@/lib/format";

export const PARTICIPANT_COLORS = [
  "#dc2626", // Red
  "#2563eb", // Blue
  "#059669", // Emerald
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#db2777", // Pink
  "#0891b2", // Cyan
  "#ea580c", // Orange
  "#4f46e5", // Indigo
  "#16a34a", // Green
  "#c026d3", // Fuchsia
  "#0284c7", // Sky
  "#e11d48", // Rose
  "#65a30d", // Lime
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
];

export interface PlayerParticipant {
  id: string;
  name: string;
  color: string;
  score?: number;
  eliminated?: boolean;
}

export const DEFAULT_COMPETITORS = [
  "Carlos M.",
  "Valentina R.",
  "Mateo G.",
  "Camila S.",
  "Lucas B.",
  "Sofía T.",
  "Diego H.",
  "Isabella P.",
];

interface ParticipantInputProps {
  participants: PlayerParticipant[];
  onAddParticipant: (name: string) => void;
  onImportBulk: (names: string[]) => void;
  onRemoveParticipant: (id: string) => void;
  onShuffle: () => void;
  onResetSample: () => void;
  onClearAll: () => void;
  disabled?: boolean;
  // Optional betting
  betCandidateId?: string | null;
  onSelectCandidate?: (id: string) => void;
  betAmount?: number;
  onChangeBetAmount?: (amt: number) => void;
}

export default function ParticipantInput({
  participants,
  onAddParticipant,
  onImportBulk,
  onRemoveParticipant,
  onShuffle,
  onResetSample,
  onClearAll,
  disabled = false,
  betCandidateId,
  onSelectCandidate,
  betAmount = 0,
  onChangeBetAmount,
}: ParticipantInputProps) {
  const [singleInput, setSingleInput] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = singleInput.trim();
    if (!trimmed) return;
    if (participants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Ya existe un participante con este nombre.");
      return;
    }
    sounds.playChip();
    onAddParticipant(trimmed);
    setSingleInput("");
  };

  const handleBulkSubmit = () => {
    const rawLines = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawLines.length === 0) return;
    const unique = Array.from(new Set(rawLines));
    sounds.playDeal();
    onImportBulk(unique);
    setBulkText("");
    setShowBulkModal(false);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Participant List Manager Box */}
      <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <span>👥</span>
            <span>Participantes ({participants.length})</span>
          </h3>
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <span>📋</span>
            <span>Pegar Lista</span>
          </button>
        </div>

        {/* Single Input Form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="Escribe un nombre..."
            value={singleInput}
            onChange={(e) => setSingleInput(e.target.value)}
            disabled={disabled}
            className="flex-1 bg-[#141824] border border-neutral-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !singleInput.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition disabled:opacity-40"
          >
            + Agregar
          </button>
        </form>

        {/* Quick Actions (Shuffle, Sample, Clear) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
          <button
            onClick={() => {
              sounds.playDeal();
              onShuffle();
            }}
            disabled={disabled || participants.length < 2}
            className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1f2538] border border-neutral-800 text-[11px] font-semibold text-neutral-300 transition flex items-center gap-1 disabled:opacity-40"
            title="Mezclar orden aleatorio"
          >
            <span>🔀</span>
            <span>Mezclar</span>
          </button>

          <button
            onClick={() => {
              sounds.playDeal();
              onResetSample();
            }}
            disabled={disabled}
            className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1f2538] border border-neutral-800 text-[11px] font-semibold text-amber-300 transition flex items-center gap-1 disabled:opacity-40"
            title="Cargar participantes de prueba"
          >
            <span>⚡</span>
            <span>Cargar 8 Nombres</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              onClearAll();
            }}
            disabled={disabled || participants.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-800 text-[11px] font-semibold text-rose-400 transition flex items-center gap-1 disabled:opacity-40"
            title="Borrar todos los participantes"
          >
            <span>🗑️</span>
            <span>Limpiar</span>
          </button>
        </div>

        {/* Active list */}
        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1 no-scrollbar">
          {participants.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
              No hay participantes aún. Escribe uno o pega una lista.
            </div>
          ) : (
            participants.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border transition ${
                  p.eliminated
                    ? "bg-rose-950/20 border-rose-900/30 opacity-60"
                    : "bg-[#131722] border-neutral-850 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs text-neutral-400 font-mono">#{idx + 1}</span>
                  <span
                    className={`text-xs font-bold truncate ${
                      p.eliminated ? "line-through text-rose-400" : "text-white"
                    }`}
                  >
                    {p.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onSelectCandidate && onChangeBetAmount && (
                    <button
                      onClick={() => onSelectCandidate(p.id)}
                      disabled={disabled || p.eliminated}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition ${
                        betCandidateId === p.id
                          ? "bg-amber-400 text-black shadow-sm"
                          : "bg-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {betCandidateId === p.id ? "⭐ Mi Favorito" : "Elegir"}
                    </button>
                  )}

                  <button
                    onClick={() => onRemoveParticipant(p.id)}
                    disabled={disabled}
                    className="text-neutral-500 hover:text-rose-400 p-1 text-xs transition"
                    title="Eliminar participante"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Optional Betting Widget */}
      {onChangeBetAmount && (
        <div className="bg-[#0e121b] border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>💰</span>
              <span>Apuesta Opcional</span>
            </h3>
            <span className="text-xs font-mono text-amber-400 font-bold">
              Cuota: {participants.length > 0 ? `${participants.length}.00x` : "0x"}
            </span>
          </div>

          <p className="text-[11px] text-neutral-400">
            Elige a tu participante favorito arriba y apuesta fichas virtuales. Si gana la competencia,
            ¡multiplicas tu saldo x{participants.length}!
          </p>

          <div className="flex items-center gap-2">
            {[0, 50, 100, 250, 500].map((amt) => (
              <button
                key={amt}
                disabled={disabled}
                onClick={() => onChangeBetAmount(amt)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                  betAmount === amt
                    ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20"
                    : "bg-[#141824] text-neutral-300 border-neutral-800 hover:border-neutral-700"
                } disabled:opacity-40`}
              >
                {amt === 0 ? "Sin Apuesta" : `$${amt}`}
              </button>
            ))}
          </div>

          {betAmount > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
              <span className="text-amber-200">
                {betCandidateId
                  ? `Apostando a: ${participants.find((p) => p.id === betCandidateId)?.name}`
                  : "⚠️ Selecciona un favorito en la lista"}
              </span>
              <span className="font-mono font-bold text-amber-400">
                Premio: ${formatFichas(betAmount * participants.length)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#0e121b] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>📋</span>
                <span>Pegar Lista de Participantes</span>
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Pega cualquier lista de nombres copiada de Excel, Word o WhatsApp (separados por líneas,
              comas o punto y coma):
            </p>

            <textarea
              rows={8}
              placeholder={`Ejemplo:\nCarlos Mendoza\nAna María\nMateo Silva\nValentina Cruz\nLucas Gómez\nSofía Restrepo`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full bg-[#141824] border border-neutral-800 focus:border-purple-500 rounded-2xl p-4 text-xs font-mono text-white outline-none resize-none transition"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkSubmit}
                disabled={!bulkText.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-lg shadow-purple-600/25"
              >
                Cargar en el Juego
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
