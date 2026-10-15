import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    await requireUser();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("games")
      .select(
        "id, nombre_juego, tipo, slug, categoria, descripcion, estado_activo, apuesta_minima, apuesta_maxima, ventaja_casa, config",
      )
      .order("id");
    if (error) throw error;
    const games = (data ?? []).map((g) => ({
      ...g,
      rtp: Number((1 - Number(g.ventaja_casa)).toFixed(4)),
    }));
    return Response.json({ games });
  } catch (e) {
    return jsonError(e);
  }
}
