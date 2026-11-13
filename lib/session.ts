import "server-only";

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionProfile {
  id: string;
  username: string;
}

/**
 * Jugador con sesión iniciada, o `null` (sin sesión, sin variables de entorno o ante cualquier
 * error). No lanza errores propios; solo deja pasar los internos de Next (`unstable_rethrow`).
 *
 * `getClaims()` valida el JWT (a diferencia de `getSession()`). Lee cookies: quien lo llame desde
 * un Server Component debe estar dentro de `<Suspense>`. `cache()` lo deduplica por petición
 * (el nav lo usa en desktop y en el panel móvil).
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const id = claimsData?.claims?.sub;
    if (claimsError || !id) return null;

    const { data, error } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle();
    if (error) {
      console.error("[auth] No se pudo leer el perfil:", error);
      return null;
    }
    if (!data || typeof data.username !== "string") return null;

    return { id, username: data.username };
  } catch (err) {
    // Los errores internos de Next (p. ej. el rechazo de `cookies()` al terminar el prerender)
    // deben llegar a Next: no son fallos de la sesión.
    unstable_rethrow(err);
    console.error("[auth] Error inesperado al leer la sesión:", err);
    return null;
  }
});
