import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AppError("unauthenticated", "Inicia sesión para continuar.", 401);
  }
  return user;
}
