import type { RealGameDef } from "../types";
import { H, START_LIVES, W } from "./constants";
import { createBloqueBusterGame } from "./engine";

export const bloqueBusterDef: RealGameDef = {
  id: "bloque-buster",
  create: createBloqueBusterGame,
  world: { width: W, height: H },
  initialSnapshot: { phase: "ready", paused: false, score: 0, lives: START_LIVES, level: 1 },
  startTitle: "BLOQUE BUSTER",
  controls: [
    // Un solo control: GameScreen usa `label` como key de React.
    { keys: ["←", "→", "RATÓN"], label: "mover" },
    { keys: ["P"], label: "pausa" },
  ],
  pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR",
};
