"use client";

import React, { useState, useEffect } from "react";
import {
  TournamentChallenge,
  TOURNAMENT_CHALLENGES,
  getRandomChallenge,
} from "@/lib/tournament-challenges";
import { sounds } from "@/lib/audio";

interface TournamentChallengeModalProps {
  isOpen: boolean;
  participantName: string;
  participantColor?: string;
  role?: "winner" | "loser" | "selected";
  gameTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TournamentChallengeModal({
  isOpen,
  participantName,
  participantColor = "#f59e0b",
  role = "winner",
  gameTitle = "Torneo",
  onClose,
  onSuccess,
}: TournamentChallengeModalProps) {
  const [challenge, setChallenge] = useState<TournamentChallenge>(() => getRandomChallenge());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "incorrect" | "speaking_done">("idle");
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setChallenge(getRandomChallenge());
      setSelectedOption(null);
      setTextAnswer("");
      setStatus("idle");
      setShowHint(false);
      setShowExplanation(false);
      setAttempts(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNextChallenge = () => {
    sounds.playClick();
    setChallenge(getRandomChallenge(challenge.id));
    setSelectedOption(null);
    setTextAnswer("");
    setStatus("idle");
    setShowHint(false);
    setShowExplanation(false);
    setAttempts(0);
  };

  const handleOptionClick = (index: number) => {
    if (status === "correct") return;
    setSelectedOption(index);
    if (challenge.correctOptionIndex === index) {
      setStatus("correct");
      setShowExplanation(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
    } else {
      setStatus("incorrect");
      sounds.playLose();
      setAttempts((prev) => prev + 1);
    }
  };

  const normalizeStr = (str: string) =>
    str
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'“”—]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const handleTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textAnswer.trim() || status === "correct") return;

    const normalizedInput = normalizeStr(textAnswer);
    const isMatch = challenge.acceptableAnswers.some((ans) => {
      const normAns = normalizeStr(ans);
      return (
        normalizedInput === normAns ||
        normalizedInput.includes(normAns) ||
        normAns.includes(normalizedInput)
      );
    });

    if (isMatch) {
      setStatus("correct");
      setShowExplanation(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
    } else {
      setStatus("incorrect");
      sounds.playLose();
      setAttempts((prev) => prev + 1);
    }
  };

  const handleSpeakingConfirm = () => {
    if (!textAnswer.trim()) {
      setStatus("speaking_done");
      setShowExplanation(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
      return;
    }
    const normalizedInput = normalizeStr(textAnswer);
    const hasKeyword = challenge.acceptableAnswers.some((kw) =>
      normalizedInput.includes(normalizeStr(kw))
    );
    if (hasKeyword || normalizedInput.length > 8) {
      setStatus("correct");
      setShowExplanation(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
    } else {
      setStatus("incorrect");
      sounds.playLose();
      setAttempts((prev) => prev + 1);
    }
  };

  const isGreenDoc = challenge.themeColor === "green";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0e1320] border-2 border-neutral-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative text-white max-h-[92vh]">
        {/* Header Ribbon */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
            isGreenDoc
              ? "bg-gradient-to-r from-emerald-950/80 via-[#0d231a] to-[#0e1320] border-emerald-500/30"
              : "bg-gradient-to-r from-rose-950/80 via-[#27101c] to-[#0e1320] border-rose-500/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg border border-white/20"
              style={{ backgroundColor: `${participantColor}33`, borderColor: participantColor }}
            >
              {role === "winner" ? "👑" : role === "loser" ? "⚡" : "🎯"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                    role === "winner"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {role === "winner"
                    ? "RETO DEL GANADOR"
                    : role === "loser"
                    ? "PENITENCIA / RETO"
                    : "DESAFÍO SELECCIONADO"}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium">
                  {gameTitle} • Doc {challenge.sourceDoc} (Pág {challenge.page})
                </span>
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <span style={{ color: participantColor }}>{participantName}</span>
                <span className="text-neutral-400 text-sm font-normal">debe resolver:</span>
              </h3>
            </div>
          </div>

          <button
            onClick={handleNextChallenge}
            title="Cambiar pregunta aleatoria"
            className="px-3 py-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-xs font-bold border border-neutral-700 flex items-center gap-1.5 transition active:scale-95"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">Otra pregunta</span>
          </button>
        </div>

        {/* Challenge Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Slide Style Card representing the exact document look */}
          <div
            className={`rounded-2xl p-6 border text-center relative overflow-hidden transition-all shadow-inner ${
              isGreenDoc
                ? "bg-gradient-to-b from-[#13281f] to-[#0a1812] border-emerald-600/40 shadow-emerald-950/40"
                : "bg-gradient-to-b from-[#2b1420] to-[#160912] border-rose-600/40 shadow-rose-950/40"
            }`}
          >
            {/* Slide Category Header */}
            <div className="mb-2">
              <span
                className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                  isGreenDoc
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                }`}
              >
                {challenge.badge}
              </span>
            </div>

            <h2
              className={`text-2xl sm:text-3xl font-serif font-black tracking-wide my-3 ${
                isGreenDoc ? "text-emerald-100" : "text-rose-100"
              }`}
            >
              {challenge.categoryTitle}
            </h2>

            {/* Main Sentence or Instruction */}
            {challenge.sentence && (
              <div
                className={`my-4 p-4 rounded-xl border text-base sm:text-xl font-medium tracking-wide ${
                  isGreenDoc
                    ? "bg-[#0b1c15]/90 border-emerald-500/20 text-emerald-50"
                    : "bg-[#1f0d18]/90 border-rose-500/20 text-rose-50"
                }`}
              >
                {challenge.sentence}
              </div>
            )}

            <p className="text-xs text-neutral-300 italic">{challenge.prompt}</p>
          </div>

          {/* Interactive Answer Area */}
          <div className="space-y-4">
            {/* Multiple Choice Type */}
            {challenge.type === "choice" && challenge.options && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {challenge.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = challenge.correctOptionIndex === idx;
                  let btnStyle =
                    "bg-[#151c2e] hover:bg-[#1e2740] border-neutral-700 text-neutral-200";

                  if (status === "correct" && isCorrect) {
                    btnStyle =
                      "bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500";
                  } else if (status === "incorrect" && isSelected) {
                    btnStyle =
                      "bg-rose-600/30 border-rose-500 text-rose-200 font-bold ring-2 ring-rose-500";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(idx)}
                      disabled={status === "correct"}
                      className={`p-4 rounded-2xl border text-center font-bold text-sm sm:text-base transition-all duration-150 transform active:scale-95 flex items-center justify-center gap-2 ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {status === "correct" && isCorrect && <span>✅</span>}
                      {status === "incorrect" && isSelected && <span>❌</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Text Fill / Correction / Spelling Type */}
            {(challenge.type === "text_fill" ||
              challenge.type === "correction" ||
              challenge.type === "spelling") && (
              <form onSubmit={handleTextSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => {
                    setTextAnswer(e.target.value);
                    if (status === "incorrect") setStatus("idle");
                  }}
                  disabled={status === "correct"}
                  placeholder={
                    challenge.type === "spelling"
                      ? "Escribe la palabra con ortografía correcta..."
                      : challenge.type === "correction"
                      ? "Escribe la corrección aquí..."
                      : "Escribe la palabra o frase que completa..."
                  }
                  className="flex-1 px-4 py-3.5 rounded-2xl bg-[#141b2c] border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 text-sm sm:text-base font-medium"
                />
                <button
                  type="submit"
                  disabled={!textAnswer.trim() || status === "correct"}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-40 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>{status === "correct" ? "¡Correcto! 🎉" : "Comprobar"}</span>
                </button>
              </form>
            )}

            {/* Speaking Challenge Type */}
            {challenge.type === "speaking" && (
              <div className="p-4 rounded-2xl bg-[#141b2c] border border-neutral-700 space-y-3">
                <p className="text-xs text-neutral-300">
                  🎯 <strong>Dinámica oral:</strong> {participantName} puede decir su oración en voz
                  alta ante el grupo, o escribirla aquí abajo para registrarla:
                </p>
                <input
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Escribe la frase dicha (ej: I think Python is great...)"
                  className="w-full px-4 py-3 rounded-xl bg-[#0b101c] border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-400 text-sm"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSpeakingConfirm}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                  >
                    <span>🎙️</span>
                    <span>¡Frase dicha en voz alta / Validar!</span>
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Banners */}
            {status === "correct" && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <h4 className="font-extrabold text-white text-base">¡Respuesta Excelente!</h4>
                  <p className="mt-0.5 text-xs text-emerald-200/90">{challenge.explanation}</p>
                </div>
              </div>
            )}

            {status === "speaking_done" && (
              <div className="p-4 rounded-2xl bg-teal-500/15 border border-teal-500/40 text-teal-200 text-sm flex items-start gap-3 animate-in fade-in">
                <span className="text-2xl">🗣️</span>
                <div>
                  <h4 className="font-extrabold text-white text-base">¡Reto Oral Completado!</h4>
                  <p className="mt-0.5 text-xs text-teal-200/90">{challenge.explanation}</p>
                </div>
              </div>
            )}

            {status === "incorrect" && (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm flex items-start gap-3 animate-in shake">
                <span className="text-2xl">💡</span>
                <div className="flex-1">
                  <h4 className="font-extrabold text-white text-base">No es del todo correcto</h4>
                  <p className="mt-0.5 text-xs text-rose-200/90">
                    Inténtalo de nuevo o solicita una pista abajo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold border border-rose-500/30"
                >
                  Ver Pista
                </button>
              </div>
            )}

            {/* Hint Dropdown */}
            {showHint && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                <span>🔎</span>
                <span>
                  <strong>Pista:</strong> {challenge.hint}
                </span>
              </div>
            )}

            {/* Example Answers if available */}
            {challenge.exampleAnswers && challenge.exampleAnswers.length > 0 && (
              <div className="p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-xs text-neutral-300">
                <span className="font-bold text-neutral-200 block mb-1">
                  💡 Ejemplos de respuestas válidas:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-400">
                  {challenge.exampleAnswers.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-[#0a0e18] flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setShowExplanation(!showExplanation);
              setShowHint(true);
            }}
            className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-4 font-medium transition"
          >
            {showExplanation ? "Ocultar explicación" : "Ver explicación gramatical"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-1.5"
            >
              <span>{status === "correct" || status === "speaking_done" ? "¡Listo! Continuar" : "Omitir y Cerrar"}</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
