import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";

/**
 * Con `cacheComponents`, un id fuera de `generateStaticParams` se renderiza en streaming y
 * `notFound()` llega cuando el status 200 ya se envió (`dynamicParams = false` no está
 * disponible en este modo). Validamos el id contra `public.games` antes de renderizar y
 * reescribimos a una ruta sin coincidencia, que Next sirve con `app/not-found.tsx` y status 404.
 */

/** `/juegos/:id` y `/juegos/:id/jugar`: devuelve el id, o `null` si la ruta no es de juego. */
function gameIdFor(pathname: string): string | null {
  const match = /^\/juegos\/([^/]+)(?:\/jugar)?\/?$/.exec(pathname);
  return match ? match[1] : null;
}

/** Ids válidos: los mismos que acepta el `CHECK` de `public.games`. */
const GAME_ID_RE = /^[a-z0-9-]{1,32}$/;

/**
 * `false` solo si estamos seguros de que el juego no existe: id con formato inválido, o sin
 * variables de Supabase (el catálogo está vacío). Si la consulta falla devuelve `null`: el proxy
 * deja pasar y la página decide con `notFound()`.
 */
async function gameExists(supabase: SupabaseClient | null, id: string): Promise<boolean | null> {
  if (!GAME_ID_RE.test(id)) return false;
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from("games").select("id").eq("id", id).maybeSingle();
    if (error) {
      console.error("[proxy] No se pudo validar el juego:", error);
      return null;
    }
    return data !== null;
  } catch (err) {
    console.error("[proxy] Error inesperado al validar el juego:", err);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  // 1. Refresca la sesión de Supabase (sin variables de entorno, deja pasar sin sesión).
  const { response, hasUser, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 2. Con sesión, /auth no tiene sentido: al vault. Solo la ruta exacta (nunca /auth/confirm).
  if (hasUser && (pathname === "/auth" || pathname === "/auth/")) {
    return withSessionCookies(response, NextResponse.redirect(new URL("/biblioteca", request.url)));
  }

  // 3. Validación de juegos contra public.games, solo en /juegos/:id(/jugar).
  const id = gameIdFor(pathname);
  if (id !== null && (await gameExists(supabase, decodeURIComponent(id))) === false) {
    return withSessionCookies(response, NextResponse.rewrite(new URL("/_juego-no-encontrado", request.url)));
  }

  return response;
}

export const config = {
  matcher: [
    // Todas las rutas salvo _next/static, _next/image, favicon.ico y archivos estáticos.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
