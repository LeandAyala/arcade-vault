import type { RealGameDef } from "../types";
import { H, START_LENGTH, W } from "./constants";
import { createSerpentinaGame } from "./engine";

export const serpentinaDef: RealGameDef = {
  id: "serpentina",
  create: createSerpentinaGame,
  world: { width: W, height: H },
  initialSnapshot: {
    phase: "ready",
    paused: false,
    score: 0,
    lives: null,
    level: 1,
    extra: { length: START_LENGTH },
  },
  startTitle: "SERPENTINA",
  controls: [
    // Un solo control: GameScreen usa `label` como key de React.
    { keys: ["←", "↑", "→", "↓", "WASD"], label: "girar" },
    { keys: ["P"], label: "pausa" },
  ],
  pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR",
  hudExtras: [{ key: "length", label: "Longitud" }],
};
