import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";

export type TxType =
  | "bono_bienvenida"
  | "bono_diario"
  | "bono_rescate"
  | "apuesta"
  | "premio"
  | "ajuste_admin";

export async function walletApply(
  userId: string,
  tipo: TxType,
  monto: number,
  betId?: number | null,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("wallet_apply", {
    p_user_id: userId,
    p_tipo: tipo,
    p_monto: monto,
    p_bet_id: betId ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.toLowerCase().includes("saldo insuficiente")) {
      throw new AppError("insufficient_balance", "Saldo insuficiente.", 409);
    }
    throw new AppError("wallet", msg || "No se pudo actualizar el saldo.", 500);
  }
  return Number(data);
}

export async function getWallet(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("id, saldo_actual")
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    throw new AppError("wallet_missing", "No encontramos tu billetera.", 404);
  }
  return data as { id: string; saldo_actual: number };
}
