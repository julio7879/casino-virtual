import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { jsonError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getWallet } from "@/lib/wallet";

export async function GET() {
  try {
    const user = await requireUser();
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("users")
      .select("id, nombre, email, estado, zona_horaria, limite_perdida_sesion")
      .eq("id", user.id)
      .single();
    if (error || !profile) {
      throw new AppError("profile", "No encontramos tu perfil.", 404);
    }
    const wallet = await getWallet(user.id);
    return Response.json({
      ...profile,
      saldo: wallet.saldo_actual,
    });
  } catch (e) {
    return jsonError(e);
  }
}

export const MePatchSchema = z.object({
  limite_perdida_sesion: z.number().int().positive().nullable(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = MePatchSchema.parse(await request.json());
    const admin = createAdminClient();
    const { error } = await admin
      .from("users")
      .update({ limite_perdida_sesion: body.limite_perdida_sesion })
      .eq("id", user.id);
    if (error) throw new AppError("profile", error.message, 500);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
