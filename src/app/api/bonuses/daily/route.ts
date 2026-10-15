import { dailyAmountForStreak } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, jsonError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { walletApply } from "@/lib/wallet";

function todayInZone(tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function yesterdayInZone(tz: string) {
  const now = new Date();
  const as = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  as.setDate(as.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(as);
}

async function dailyState(userId: string) {
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("zona_horaria")
    .eq("id", userId)
    .single();
  const tz = user?.zona_horaria ?? "America/Bogota";
  const today = todayInZone(tz);
  const yesterday = yesterdayInZone(tz);

  const { data: claims } = await admin
    .from("daily_claims")
    .select("fecha_reclamo, racha, monto")
    .eq("user_id", userId)
    .in("fecha_reclamo", [today, yesterday])
    .order("fecha_reclamo", { ascending: false });

  const todayClaim = claims?.find((c) => c.fecha_reclamo === today);
  const yClaim = claims?.find((c) => c.fecha_reclamo === yesterday);
  const claimed = Boolean(todayClaim);
  const nextStreak = claimed
    ? todayClaim!.racha
    : yClaim
      ? yClaim.racha + 1
      : 1;
  const amount = dailyAmountForStreak(nextStreak);
  return { disponible: !claimed, racha: nextStreak, monto: amount, tz, today };
}

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await dailyState(user.id));
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const state = await dailyState(user.id);
    if (!state.disponible) {
      throw new AppError("already_claimed", "Ya reclamaste tu reserva de hoy.", 409);
    }
    const admin = createAdminClient();
    const { error } = await admin.from("daily_claims").insert({
      user_id: user.id,
      fecha_reclamo: state.today,
      racha: state.racha,
      monto: state.monto,
    });
    if (error) {
      if (error.code === "23505") {
        throw new AppError("already_claimed", "Ya reclamaste tu reserva de hoy.", 409);
      }
      throw error;
    }
    const saldo = await walletApply(user.id, "bono_diario", state.monto);
    return Response.json({
      ok: true,
      racha: state.racha,
      monto: state.monto,
      saldo,
    });
  } catch (e) {
    return jsonError(e);
  }
}
