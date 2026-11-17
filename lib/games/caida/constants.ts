// Constantes de CAÍDA — mismos valores que references/resources/templates/started-games/03-tetris/game.js

/** Mundo lógico 4:3. El tablero (300×600) va centrado y los paneles se dibujan en el canvas. */
export const W = 800;
export const H = 600;

/** Tope de `dt` (s) para evitar saltos tras perder el foco. */
export const MAX_DT = 0.05;

// ── Tablero ──────────────────────────────────────────────────────────────────
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const BOARD_X = (W - COLS * BLOCK) / 2; // 250
export const BOARD_Y = 0;

// ── Piezas (índice 1–8; 0 = celda vacía) ─────────────────────────────────────
export const PIECE_COUNT = 8;
export const PIECES: readonly (readonly (readonly number[])[])[] = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
  [[8, 8, 8], [8, 0, 8], [8, 8, 8]], // N (tuerca)
];

/** Wall kicks: desplazamientos de columna probados al rotar. */
export const KICKS = [0, -1, 1, -2, 2] as const;
export const GHOST_ALPHA = 0.2;

// ── Puntuación ───────────────────────────────────────────────────────────────
/** Puntos por 0, 1, 2, 3 o 4 líneas limpiadas a la vez, multiplicados por el nivel. */
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
export const SOFT_DROP_POINTS = 1; // por fila
export const HARD_DROP_POINTS = 2; // por celda
/** Igual que `SCORE_MAX` de `lib/scores.ts` (server-only): por encima, `saveScore` rechaza la partida. */
export const SCORE_CAP = 9_999_999;

// ── Nivel y velocidad ────────────────────────────────────────────────────────
export const LINES_PER_LEVEL = 10;
export const levelForLines = (lines: number) => Math.floor(lines / LINES_PER_LEVEL) + 1;
/** Milisegundos por fila de caída automática. */
export const dropIntervalFor = (level: number) => Math.max(100, 1000 - (level - 1) * 90);

// ── Estilo ───────────────────────────────────────────────────────────────────
/** Tokens de app/globals.css más el naranja y el violeta de `.cover-tetro`. */
export const PALETTE = {
  bg: "#000000",
  ink: "#e6e9ff",
  inkDim: "#8a8fb5",
  inkFaint: "#4a4f70",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
  orange: "#ff7700",
  violet: "#aa00ff",
} as const;

/** Color por índice de pieza (1–8). */
export const PIECE_COLORS: readonly string[] = [
  "",
  PALETTE.cyan, // I
  PALETTE.yellow, // O
  PALETTE.violet, // T
  PALETTE.green, // S
  PALETTE.magenta, // Z
  PALETTE.ink, // J
  PALETTE.orange, // L
  PALETTE.inkDim, // N (tuerca, gris metálico)
];
