"use server";

import { updateTag } from "next/cache";
import { SCORES_TAG, SCORE_MAX } from "@/lib/scores";
import { createClient } from "@/lib/supabase/server";

export type SaveScoreErrorCode = "VALIDATION" | "CONFIG" | "UNAUTHENTICATED" | "GAME_NOT_FOUND" | "DB";

export type SaveScoreState =
  | { status: "idle" }
  | { status: "saved"; rank: number; id: number }
  | { status: "error"; code: SaveScoreErrorCode; message: string; id: number };

const MESSAGES: Record<SaveScoreErrorCode, string> = {
  VALIDATION: "Puntuación inválida.",
  CONFIG: "Servicio de puntuaciones no configurado.",
  UNAUTHENTICATED: "Tu sesión expiró. Inicia sesión para guardar.",
  GAME_NOT_FOUND: "Ese juego no existe.",
  DB: "No se pudo guardar. Inténtalo de nuevo.",
};

function fail(code: SaveScoreErrorCode): SaveScoreState {
  return { status: "error", code, message: MESSAGES[code], id: Date.now() };
}

/** Entero en 1..SCORE_MAX escrito en base 10 (rechaza "1e3", "12.5", "-4", "", etc.). */
function parseScore(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || !/^\d{1,7}$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 && n <= SCORE_MAX ? n : null;
}

/**
 * Guarda una puntuación del jugador con sesión. La RLS de `public.scores` exige
 * `user_id = auth.uid()` y el `CHECK` limita el rango; aquí se valida antes para dar un error claro.
 */
export async function saveScore(_prev: SaveScoreState, formData: FormData): Promise<SaveScoreState> {
  const gameId = formData.get("gameId");
  const score = parseScore(formData.get("score"));
  if (typeof gameId !== "string" || !/^[a-z0-9-]{1,32}$/.test(gameId) || score === null) {
    return fail("VALIDATION");
  }

  const supabase = await createClient();
  if (!supabase) return fail("CONFIG");

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return fail("UNAUTHENTICATED");

  const { error: insertError } = await supabase.from("scores").insert({ user_id: userId, game_id: gameId, score });
  if (insertError) {
    console.error("[scores] No se pudo guardar la puntuación:", insertError);
    if (insertError.code === "23503") return fail("GAME_NOT_FOUND");
    if (insertError.code === "42501") return fail("UNAUTHENTICATED");
    return fail("DB");
  }

  // Read-your-own-writes: Salón, detalle, tarjetas y stats se recalculan en la siguiente petición.
  updateTag(SCORES_TAG);

  const { data: rankRow, error: rankError } = await supabase
    .from("game_leaderboard")
    .select("rank")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();

  if (rankError || !rankRow) {
    // La puntuación ya está guardada: no lo reportamos como fallo, pero sin puesto no hay toast fiable.
    console.error("[scores] Puntuación guardada, pero no se pudo leer el puesto:", rankError);
    return { status: "saved", rank: 0, id: Date.now() };
  }

  return { status: "saved", rank: rankRow.rank as number, id: Date.now() };
}
