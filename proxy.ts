import { NextResponse, type NextRequest } from "next/server";
import { GAMES } from "@/lib/data";

/**
 * Con `cacheComponents`, un id fuera de `generateStaticParams` se renderiza en streaming y
 * `notFound()` llega cuando el status 200 ya se envió (`dynamicParams = false` no está
 * disponible en este modo). Validamos el id antes de renderizar y reescribimos a una ruta
 * sin coincidencia, que Next sirve con `app/not-found.tsx` y status 404.
 */
const GAME_IDS = new Set(GAMES.map((g) => g.id));

export function proxy(request: NextRequest) {
  const id = request.nextUrl.pathname.split("/")[2];
  if (id && GAME_IDS.has(decodeURIComponent(id))) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_juego-no-encontrado", request.url));
}

export const config = {
  matcher: ["/juegos/:id", "/juegos/:id/jugar"],
};
