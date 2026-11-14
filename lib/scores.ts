import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export interface LeaderboardRow {
  rank: number;
  name: string; // alias en mayúsculas
  score: number;
  date: string; // "dd/mm/yyyy" (UTC)
}

export interface GameStats {
  best: number | null; // null sin puntuaciones guardadas
  plays: number; // número de puntuaciones guardadas
}

export const LEADERBOARD_SIZE = { salon: 12, detail: 10 } as const;
export const SCORE_MAX = 9_999_999;

/** Tag de caché de todo lo que depende de `public.scores`. `saveScore` lo invalida con `updateTag`. */
export const SCORES_TAG = "scores";

export const EMPTY_STATS: GameStats = { best: null, plays: 0 };

interface LeaderboardDbRow {
  game_id: string;
  username: string;
  score: number;
  achieved_at: string;
  rank: number;
}

/** "dd/mm/yyyy" en UTC: el HTML es el mismo para todos (render en servidor y cacheado). */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function toRow(r: LeaderboardDbRow): LeaderboardRow {
  return { rank: r.rank, name: r.username.toUpperCase(), score: r.score, date: formatDate(r.achieved_at) };
}

const LEADERBOARD_COLUMNS = "game_id, username, score, achieved_at, rank";

/** Top `limit` de un juego (mejor marca por jugador). Sin env devuelve `[]`; ante error lanza. */
export async function getLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]> {
  "use cache";
  cacheTag(SCORES_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("game_leaderboard")
    .select(LEADERBOARD_COLUMNS)
    .eq("game_id", gameId)
    .lte("rank", limit)
    .order("rank", { ascending: true });

  if (error) throw new Error(`[scores] No se pudo leer el ranking de ${gameId}: ${error.message}`);
  return ((data ?? []) as LeaderboardDbRow[]).map(toRow);
}

/** Top `limit` de cada juego en una sola query, agrupado por `game_id`. */
export async function getAllLeaderboards(limit: number): Promise<Record<string, LeaderboardRow[]>> {
  "use cache";
  cacheTag(SCORES_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("game_leaderboard")
    .select(LEADERBOARD_COLUMNS)
    .lte("rank", limit)
    .order("game_id", { ascending: true })
    .order("rank", { ascending: true });

  if (error) throw new Error(`[scores] No se pudieron leer los rankings: ${error.message}`);

  const byGame: Record<string, LeaderboardRow[]> = {};
  for (const r of (data ?? []) as LeaderboardDbRow[]) {
    (byGame[r.game_id] ??= []).push(toRow(r));
  }
  return byGame;
}

/** `best` y `plays` de cada juego. Los juegos sin entrada usan `EMPTY_STATS`. */
export async function getGameStats(): Promise<Record<string, GameStats>> {
  "use cache";
  cacheTag(SCORES_TAG);
  cacheLife("hours");

  const supabase = createPublicClient();
  if (!supabase) return {};

  const { data, error } = await supabase.from("game_stats").select("game_id, best, plays");
  if (error) throw new Error(`[scores] No se pudieron leer las estadísticas: ${error.message}`);

  const stats: Record<string, GameStats> = {};
  for (const r of (data ?? []) as { game_id: string; best: number | null; plays: number }[]) {
    stats[r.game_id] = { best: r.best, plays: r.plays };
  }
  return stats;
}
