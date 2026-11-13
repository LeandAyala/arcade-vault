import { NextResponse, type NextRequest } from "next/server";
import { GAMES } from "@/lib/data";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";

/**
 * Con `cacheComponents`, un id fuera de `generateStaticParams` se renderiza en streaming y
 * `notFound()` llega cuando el status 200 ya se envió (`dynamicParams = false` no está
 * disponible en este modo). Validamos el id antes de renderizar y reescribimos a una ruta
 * sin coincidencia, que Next sirve con `app/not-found.tsx` y status 404.
 */
const GAME_IDS = new Set(GAMES.map((g) => g.id));

/** `/juegos/:id` y `/juegos/:id/jugar`: devuelve el id, o `null` si la ruta no es de juego. */
function gameIdFor(pathname: string): string | null {
  const match = /^\/juegos\/([^/]+)(?:\/jugar)?\/?$/.exec(pathname);
  return match ? match[1] : null;
}

export async function proxy(request: NextRequest) {
  // 1. Refresca la sesión de Supabase (sin variables de entorno, deja pasar sin sesión).
  const { response, hasUser } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 2. Con sesión, /auth no tiene sentido: al vault. Solo la ruta exacta (nunca /auth/confirm).
  if (hasUser && (pathname === "/auth" || pathname === "/auth/")) {
    return withSessionCookies(response, NextResponse.redirect(new URL("/biblioteca", request.url)));
  }

  // 3. Validación de juegos, igual que antes, después de refrescar la sesión.
  const id = gameIdFor(pathname);
  if (id !== null && !GAME_IDS.has(decodeURIComponent(id))) {
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
