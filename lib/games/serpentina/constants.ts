// Constantes de SERPENTINA: snake en rejilla con frutas neón (SPEC 09).

/** Mundo lógico (4:3, igual que el CRT). */
export const W = 800;
export const H = 600;
/** dt máximo por frame en segundos. */
export const MAX_DT = 0.05;

// Rejilla: 32 × 22 celdas de 25 px bajo una franja de HUD de 50 px.
export const CELL = 25;
export const COLS = 32;
export const ROWS = 22;
export const BOARD_Y = 50; // el tablero va de y = 50 a y = 600

export type Dir = "up" | "down" | "left" | "right";

// Serpiente inicial
export const START_LENGTH = 3;
export const START_HEAD = { x: 16, y: 11 } as const;
export const START_DIR: Dir = "right";

// Velocidad: duración del tick = max(STEP_MIN, STEP_BASE − (nivel − 1) × STEP_DEC), en s.
export const STEP_BASE = 0.15;
export const STEP_DEC = 0.01;
export const STEP_MIN = 0.06;

// Reglas
export const FRUITS_PER_LEVEL = 5;
export const GRAPE_EVERY = 5;
export const GRAPE_TTL = 6; // s
export const GRAPE_BLINK = 2; // s finales en los que parpadea
export const TURN_QUEUE_MAX = 2;

// Serpiente demo de la fase `ready`
export const DEMO_LENGTH = 8;
export const DEMO_STEP = 0.15; // s

/** Duración del anillo que se expande al comer una fruta (s). */
export const BITE_DURATION = 0.2;

/** Hex de `app/globals.css` + naranja y violeta (los mismos que SPEC 08). */
export const PALETTE = {
  bg: "#000000",
  ink: "#e6e9ff",
  inkDim: "#8a8fb5",
  inkFaint: "#4a4f70",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
  orange: "#ffae00",
  violet: "#aa00ff",
} as const;

export type FruitKind = "apple" | "cherry" | "lemon" | "grape";

export const FRUITS: Record<FruitKind, { points: number; weight: number; color: string }> = {
  apple: { points: 10, weight: 60, color: PALETTE.magenta },
  cherry: { points: 20, weight: 25, color: PALETTE.orange },
  lemon: { points: 30, weight: 15, color: PALETTE.yellow },
  grape: { points: 50, weight: 0, color: PALETTE.violet }, // solo aparece por GRAPE_EVERY
};
