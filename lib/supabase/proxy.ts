import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export interface UpdateSessionResult {
  /** Respuesta que lleva las cookies de sesión refrescadas. */
  response: NextResponse;
  /** `true` si hay un usuario con un JWT válido. */
  hasUser: boolean;
}

/**
 * Refresca la sesión de Supabase en cada petición (los Server Components no pueden escribir
 * cookies). Sin variables de entorno, o ante cualquier error, deja pasar la petición sin sesión.
 *
 * Si quien llama construye otra respuesta (rewrite, redirect), debe copiarle las cookies con
 * `withSessionCookies`, o el token refrescado se pierde.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const env = getSupabaseEnv();
  if (!env) return { response: NextResponse.next(), hasUser: false };

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // No meter código entre createServerClient y getClaims(): getClaims() valida el JWT y,
  // si caducó, lo refresca (y dispara setAll).
  try {
    const { data, error } = await supabase.auth.getClaims();
    return { response, hasUser: !error && Boolean(data?.claims?.sub) };
  } catch (err) {
    console.error("[auth] No se pudo refrescar la sesión en el proxy:", err);
    return { response, hasUser: false };
  }
}

/** Cabeceras que `@supabase/ssr` añade al escribir cookies de auth para que no se cacheen. */
const CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

/** Copia las cookies (y cabeceras de caché) de la sesión refrescada a otra respuesta. */
export function withSessionCookies(session: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of session.cookies.getAll()) target.cookies.set(cookie);
  for (const name of CACHE_HEADERS) {
    const value = session.headers.get(name);
    if (value) target.headers.set(name, value);
  }
  return target;
}
