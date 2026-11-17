import type { RealGameDef } from "../types";
import { H, START_LIVES, W } from "./constants";
import { createAsteroidsGame } from "./engine";

export const asteroidsDef: RealGameDef = {
  id: "asteroides",
  create: createAsteroidsGame,
  world: { width: W, height: H },
  initialSnapshot: { phase: "ready", paused: false, score: 0, lives: START_LIVES, level: 1 },
  startTitle: "ASTEROIDES",
  controls: [
    { keys: ["←", "→"], label: "rotar" },
    { keys: ["↑"], label: "propulsar" },
    { keys: ["ESPACIO"], label: "disparar" },
    { keys: ["P"], label: "pausa" },
  ],
  pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR",
};
