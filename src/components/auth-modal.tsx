"use client";

import React, { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useWallet } from "@/lib/wallet-context";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { isGuest } = useWallet();
  const configured = isSupabaseConfigured();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!configured) {
      setErrorMsg(
        "Supabase aún no está configurado en las variables de entorno. Puedes seguir jugando en Modo Invitado gratis."
      );
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre: name || "Jugador",
            },
          },
        });
        if (error) throw error;
        setSuccessMsg(
          "¡Cuenta creada con éxito! Si tu proyecto tiene confirmación de email activada, revisa tu correo. Si no, ya puedes iniciar sesión."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg("¡Sesión iniciada con éxito! Recargando...");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string }).message || "Ocurrió un error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#121622] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 mb-3 text-2xl">
            🎰
          </div>
          <h2 className="text-2xl font-black text-white">
            {mode === "login" ? "Acceso de Jugador" : "Crear Cuenta Casino"}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Guarda tus fichas y estadísticas en la nube con Supabase.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-[#191f2d] p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mode === "login"
                ? "bg-amber-500 text-black shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mode === "signup"
                ? "bg-amber-500 text-black shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Supabase status warning if not configured */}
        {!configured && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            💡 <strong>Modo Demo / Invitado Activo:</strong> Puedes jugar sin iniciar sesión. Para activar registro real en línea con Supabase, añade tus claves en Vercel o en <code className="text-white bg-black/30 px-1 py-0.5 rounded">.env.local</code>.
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
                Nombre de Jugador / Nickname
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. LuckyStrike"
                className="w-full bg-[#181e2b] border border-neutral-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-[#181e2b] border border-neutral-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-[#181e2b] border border-neutral-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white text-sm outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? "Procesando..." : mode === "login" ? "Entrar al Casino" : "Crear Cuenta"}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-neutral-800 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-neutral-400 hover:text-amber-400 font-medium transition"
          >
            Continuar jugando como Invitado (Fichas Demo) →
          </button>
        </div>
      </div>
    </div>
  );
}
