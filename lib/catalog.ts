import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { Category, GameColor } from "@/lib/data";
import { createPublicClient } from "@/lib/supabase/public";

export interface Game {
  id: string; // slug usado en la URL: "bloque-buster"
  title: string; // "BLOQUE BUSTER"
  short: string; // descripción corta de la tarjeta
  long: string; // descripción larga del detalle
  cat: Category;
  cover: string; // clase CSS de portada: "cover-bricks"
  color: GameColor; // color del botón JUGAR
}

/** Tag de caché del catálogo (`public.games`). */
export const GAMES_TAG = "games";

/**
 * Id centinela para `generateStaticParams` cuando el catálogo está vacío (sin variables de
 * Supabase): Cache Components exige al menos un param. Nunca existe en `public.games`.
 */
export const NO_GAME_ID = "__none__";

/**
 * Catálogo completo en el orden de `sort_order`. Sin variables de Supabase devuelve `[]`.
 * Ante un error de Supabase lanza: así no se cachea un catálogo vacío por un fallo transitorio.
 */
export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheTag(GAMES_TAG);
  cacheLife("days");

  const supabase = createPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`[catalog] No se pudo leer public.games: ${error.message}`);
  return (data ?? []) as Game[];
}

export async function getGame(id: string): Promise<Game | undefined> {
  const games = await getGames();
  return games.find((g) => g.id === id);
}

/** Params para las rutas `/juegos/[id]`: los ids del catálogo, o el centinela si está vacío. */
export async function getGameParams(): Promise<{ id: string }[]> {
  const games = await getGames();
  return games.length > 0 ? games.map((g) => ({ id: g.id })) : [{ id: NO_GAME_ID }];
}
