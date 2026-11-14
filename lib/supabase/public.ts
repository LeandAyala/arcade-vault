import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Cliente de Supabase sin cookies ni sesión, para lecturas públicas (catálogo y rankings).
 * Es el único apto para funciones con `"use cache"`: no depende de la petición y todos los
 * visitantes ven los mismos datos (RLS de `anon`). Devuelve `null` sin variables de entorno.
 */
export function createPublicClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;

  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
