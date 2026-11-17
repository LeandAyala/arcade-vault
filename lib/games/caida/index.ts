import type { RealGameDef } from "../types";
import { H, W } from "./constants";
import { createCaidaGame } from "./engine";

export const caidaDef: RealGameDef = {
  id: "caida",
  create: createCaidaGame,
  world: { width: W, height: H },
  initialSnapshot: { phase: "ready", paused: false, score: 0, lives: null, level: 1, extra: { lines: 0 } },
  startTitle: "CAÍDA",
  controls: [
    { keys: ["←", "→"], label: "mover" },
    { keys: ["↑", "X"], label: "rotar" },
    { keys: ["↓"], label: "bajar" },
    { keys: ["ESPACIO"], label: "caída" },
    { keys: ["P"], label: "pausa" },
  ],
  pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR",
  hudExtras: [{ key: "lines", label: "Líneas" }],
};
