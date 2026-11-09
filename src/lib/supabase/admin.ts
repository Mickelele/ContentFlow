import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Klient z kluczem serwisowym — omija RLS. Tylko po stronie serwera i tylko do odczytu sekretów,
 * których użytkownik nie może pobrać sam (np. webhook Slacka). Zawsze najpierw sprawdź członkostwo.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Brak SUPABASE_SECRET_KEY w zmiennych środowiskowych serwera.");
  return createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
