// Constantes de BLOQUE BUSTER, portadas de started-games/04-arkanoid/game.js (SPEC 08).

import type { BlockColor } from "./levels";

/** Mundo lógico (4:3, igual que el CRT). */
export const W = 800;
export const H = 600;
/** dt máximo por frame en segundos. */
export const MAX_DT = 0.05;

// Pala
export const PADDLE_W = 81;
export const PADDLE_H = 14;
export const PADDLE_Y = 560;
export const PADDLE_SPEED = 400; // px/s
/** Tolerancia bajo la pala para detectar el rebote (literal del template). */
export const PADDLE_CATCH_MARGIN = 8;

// Pelota
export const BALL_SIZE = 16;
export const BASE_BALL_VX = 200; // px/s
export const BASE_BALL_VY = -300; // px/s
export const BASE_BALL_SPEED = Math.hypot(BASE_BALL_VX, BASE_BALL_VY);
/** Ángulo máximo de salida desde la vertical al rebotar en un borde de la pala. */
export const MAX_BOUNCE_ANGLE = Math.PI / 3;
/** La física avanza en subpasos de como mucho este recorrido de la pelota (anti-tunneling). */
export const MAX_STEP = 8;

// Rejilla de bloques
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;

// Reglas
export const POINTS_PER_BLOCK = 10;
export const START_LIVES = 3;
/** Espera con la pelota sobre la pala antes de cada saque (s). */
export const SERVE_DELAY = 1;
export const EXPLOSION_DURATION = 0.15; // s

/** Hex de `app/globals.css` + naranja de `cover-bricks` y violeta de `cover-tetro`. */
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

/** Colores del template → neones del Vault (uno distinto por color). */
export const BLOCK_COLORS: Record<BlockColor, string> = {
  gray: PALETTE.inkDim,
  red: PALETTE.orange,
  yellow: PALETTE.yellow,
  cyan: PALETTE.cyan,
  magenta: PALETTE.violet,
  hotpink: PALETTE.magenta,
  green: PALETTE.green,
};
