"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { sounds } from "@/lib/audio";
import { createClient } from "@/lib/supabase/client";
import { dailyAmountForStreak, WELCOME_BONUS } from "@/lib/constants";
import type { User } from "@supabase/supabase-js";

export type WalletTx = {
  id: string;
  type: "bet" | "win" | "bonus" | "reload";
  amount: number;
  gameSlug?: string;
  gameTitle?: string;
  timestamp: number;
  description: string;
};

export type RecentWinNotification = {
  id: string;
  user: string;
  gameTitle: string;
  amount: number;
  multiplier: number;
  timeAgo: string;
};

type WalletContextType = {
  balance: number;
  user: User | null;
  isGuest: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
  transactions: WalletTx[];
  recentWins: RecentWinNotification[];
  placeBet: (amount: number, gameSlug: string, gameTitle: string) => boolean;
  awardWin: (amount: number, gameSlug: string, gameTitle: string, multiplier?: number) => void;
  reloadChips: (amount?: number) => void;
  resetBalance: () => void;
  claimDailyBonus: () => Promise<{ success: boolean; amount: number; message: string }>;
  dailyStreak: number;
  canClaimDaily: boolean;
  signOut: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType | null>(null);

const INITIAL_GUEST_BALANCE = WELCOME_BONUS || 10_000;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(INITIAL_GUEST_BALANCE);
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [dailyStreak, setDailyStreak] = useState<number>(1);
  const [canClaimDaily, setCanClaimDaily] = useState<boolean>(true);
  const [recentWins, setRecentWins] = useState<RecentWinNotification[]>([
    { id: "1", user: "Mateo_R", gameTitle: "Crash Rocket", amount: 14500, multiplier: 14.5, timeAgo: "hace 1m" },
    { id: "2", user: "Valeria.K", gameTitle: "Ruleta Royale", amount: 7200, multiplier: 36, timeAgo: "hace 2m" },
    { id: "3", user: "Carlos99", gameTitle: "Minas del Faraón", amount: 9800, multiplier: 8.2, timeAgo: "hace 4m" },
    { id: "4", user: "Lucia_V", gameTitle: "Neon Fruits 777", amount: 25000, multiplier: 50, timeAgo: "hace 6m" },
  ]);

  // Load from Supabase session or localStorage on mount
  useEffect(() => {
    // Sound setting
    setSoundEnabled(sounds.enabled);

    // Local storage guest balance
    const savedBal = localStorage.getItem("casino_guest_balance");
    if (savedBal !== null) {
      const parsed = Number(savedBal);
      if (!isNaN(parsed) && parsed >= 0) {
        setBalance(parsed);
      }
    }

    // Local storage transactions
    const savedTx = localStorage.getItem("casino_transactions");
    if (savedTx) {
      try {
        setTransactions(JSON.parse(savedTx));
      } catch {}
    }

    // Daily claim check
    const lastDailyStr = localStorage.getItem("casino_last_daily");
    const streakStr = localStorage.getItem("casino_daily_streak");
    if (streakStr) {
      setDailyStreak(Math.max(1, Number(streakStr)));
    }
    const today = new Date().toISOString().slice(0, 10);
    if (lastDailyStr === today) {
      setCanClaimDaily(false);
    } else {
      setCanClaimDaily(true);
    }

    // Check Supabase session
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setUser(user);
          setIsGuest(false);
          // Fetch Supabase wallet
          supabase
            .from("wallets")
            .select("saldo_actual")
            .eq("user_id", user.id)
            .single()
            .then(({ data }) => {
              if (data && typeof data.saldo_actual === "number") {
                setBalance(data.saldo_actual);
              }
            });
        }
      }).catch(() => {
        // Fallback to guest mode
      });
    } catch {}

    // Simulated live wins ticker interval to give casino a vibrant social feel
    const mockUsers = ["Sofia_G", "David_M", "Elena_P", "Lucas_T", "Camila_B", "Andres_Z", "Mariana_S"];
    const mockGames = ["Crash Rocket", "Ruleta Royale", "Neon Fruits 777", "Minas del Faraón", "Blackjack 21 Pro", "Plinko Pachinko"];

    const interval = setInterval(() => {
      const u = mockUsers[Math.floor(Math.random() * mockUsers.length)];
      const g = mockGames[Math.floor(Math.random() * mockGames.length)];
      const mult = Number((Math.random() * 8 + 1.8).toFixed(1));
      const amt = Math.floor(Math.random() * 12000 + 800);

      const newWin: RecentWinNotification = {
        id: Math.random().toString(36).substring(2, 9),
        user: u,
        gameTitle: g,
        amount: amt,
        multiplier: mult,
        timeAgo: "hace unos seg",
      };

      setRecentWins((prev) => [newWin, ...prev.slice(0, 7)]);
    }, 18000);

    return () => clearInterval(interval);
  }, []);

  const saveBalance = (newBal: number) => {
    setBalance(newBal);
    if (isGuest) {
      localStorage.setItem("casino_guest_balance", String(newBal));
    } else if (user) {
      try {
        const supabase = createClient();
        supabase.from("wallets").update({ saldo_actual: newBal }).eq("user_id", user.id).then(() => {});
      } catch {}
    }
  };

  const addTx = (tx: Omit<WalletTx, "id" | "timestamp">) => {
    const fullTx: WalletTx = {
      ...tx,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setTransactions((prev) => {
      const updated = [fullTx, ...prev.slice(0, 49)];
      localStorage.setItem("casino_transactions", JSON.stringify(updated));
      return updated;
    });
  };

  const toggleSound = useCallback(() => {
    const next = sounds.toggleSound();
    setSoundEnabled(next);
  }, []);

  const placeBet = useCallback((amount: number, gameSlug: string, gameTitle: string): boolean => {
    if (amount <= 0 || balance < amount) {
      sounds.playLose();
      return false;
    }
    const newBal = balance - amount;
    saveBalance(newBal);
    sounds.playChip();
    addTx({
      type: "bet",
      amount: -amount,
      gameSlug,
      gameTitle,
      description: `Apuesta en ${gameTitle}`,
    });
    return true;
  }, [balance, isGuest, user]);

  const awardWin = useCallback((amount: number, gameSlug: string, gameTitle: string, multiplier: number = 1) => {
    if (amount <= 0) return;
    const newBal = balance + amount;
    saveBalance(newBal);

    if (multiplier >= 10) {
      sounds.playBigWin();
    } else {
      sounds.playWin();
    }

    addTx({
      type: "win",
      amount: amount,
      gameSlug,
      gameTitle,
      description: `Premio en ${gameTitle} (${multiplier.toFixed(2)}x)`,
    });
  }, [balance, isGuest, user]);

  const reloadChips = useCallback((amount: number = 5000) => {
    const newBal = balance + amount;
    saveBalance(newBal);
    sounds.playWin();
    addTx({
      type: "reload",
      amount: amount,
      description: `Recarga de cortesía +$${amount.toLocaleString()}`,
    });
  }, [balance, isGuest, user]);

  const resetBalance = useCallback(() => {
    saveBalance(INITIAL_GUEST_BALANCE);
    sounds.playChip();
  }, [isGuest, user]);

  const claimDailyBonus = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const lastDailyStr = localStorage.getItem("casino_last_daily");

    if (lastDailyStr === today) {
      return { success: false, amount: 0, message: "Ya reclamaste tu bono diario de hoy. ¡Vuelve mañana!" };
    }

    const bonusAmount = dailyAmountForStreak(dailyStreak);
    const newBal = balance + bonusAmount;
    saveBalance(newBal);

    const nextStreak = dailyStreak >= 7 ? 1 : dailyStreak + 1;
    setDailyStreak(nextStreak);
    setCanClaimDaily(false);
    localStorage.setItem("casino_last_daily", today);
    localStorage.setItem("casino_daily_streak", String(nextStreak));

    sounds.playBigWin();
    addTx({
      type: "bonus",
      amount: bonusAmount,
      description: `Bono Diario Día ${dailyStreak} (+$${bonusAmount.toLocaleString()})`,
    });

    return {
      success: true,
      amount: bonusAmount,
      message: `¡Felicidades! Has reclamado tu bono de +$${bonusAmount.toLocaleString()} fichas.`,
    };
  }, [balance, dailyStreak, isGuest, user]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setIsGuest(true);
    const guestBal = Number(localStorage.getItem("casino_guest_balance")) || INITIAL_GUEST_BALANCE;
    setBalance(guestBal);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        balance,
        user,
        isGuest,
        soundEnabled,
        toggleSound,
        transactions,
        recentWins,
        placeBet,
        awardWin,
        reloadChips,
        resetBalance,
        claimDailyBonus,
        dailyStreak,
        canClaimDaily,
        signOut,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
