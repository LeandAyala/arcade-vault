import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Se crea dentro de cada llamada (nunca a nivel de módulo): cada petición tiene sus propias cookies.
 * Devuelve `null` si faltan las variables de entorno.
 *
 * Leer `cookies()` es dato de petición: quien lo llame desde un Server Component debe estar
 * dentro de `<Suspense>`.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component, que no puede escribir cookies.
          // Se ignora: proxy.ts ya refresca la sesión en cada petición.
        }
      },
    },
  });
}
