// Juegos reales del Vault, por id de `public.games`. Un id que no está aquí usa la simulación
// de SPEC 01 en el reproductor. Para añadir un juego: `/nuevo-juego` genera su spec.

import { asteroidsDef } from "./asteroids";
import { caidaDef } from "./caida";
import type { RealGameDef } from "./types";

export const REAL_GAMES: Readonly<Record<string, RealGameDef>> = {
  [asteroidsDef.id]: asteroidsDef,
  [caidaDef.id]: caidaDef,
};
