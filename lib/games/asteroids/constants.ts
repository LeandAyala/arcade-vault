// Constantes de ASTEROIDES — mismos valores que references/resources/templates/started-games/02-asteroids/game.js

/** Mundo lógico. El canvas se escala por CSS; la física siempre trabaja en 800×600. */
export const W = 800;
export const H = 600;

/** Tope de `dt` (s) para evitar saltos tras perder el foco. */
export const MAX_DT = 0.05;

// ── Asteroides (índice = tamaño: 1 pequeño, 2 mediano, 3 grande) ─────────────
export const RADII = [0, 16, 30, 50] as const;
export const SPEEDS = [0, 85, 55, 32] as const;
/** Sistema de puntos: pequeño 100, mediano 50, grande 20. */
export const POINTS = [0, 100, 50, 20] as const;
export type AsteroidSize = 1 | 2 | 3;

export const INITIAL_ASTEROIDS = 4;
/** Asteroides grandes al empezar un nivel > 1: `3 + nivel`. */
export const asteroidsForLevel = (level: number) => 3 + level;
export const SPAWN_SAFE_DIST = 130;

// ── Power-up de triple disparo ───────────────────────────────────────────────
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const POWERUP_GUARANTEED_AFTER = 5;
export const TRIPLE_SPREAD = 0.18;

// ── Nave ─────────────────────────────────────────────────────────────────────
export const SHIP_RADIUS = 12;
export const SHIP_ROT = 3.5; // rad/s
export const SHIP_THRUST = 260; // px/s²
export const SHIP_DRAG = 0.987;
export const SHIP_NOSE = 21;
export const SHIP_INVINCIBLE = 3; // s tras reaparecer
export const SHOOT_COOLDOWN = 0.2;
/** Factor de colisión nave-asteroide (sensación del template). */
export const SHIP_HIT_FUDGE = 0.82;

// ── Balas ────────────────────────────────────────────────────────────────────
export const BULLET_SPEED = 520;
export const BULLET_TTL = 1.1;
export const BULLET_RADIUS = 2;

// ── Partidas ─────────────────────────────────────────────────────────────────
export const START_LIVES = 3;
export const RESPAWN_DELAY = 2; // s tras perder una vida

/**
 * Paleta neón del Vault (valores de los tokens de app/globals.css). Cada color repite el
 * significado del HUD React: cyan = puntuación y jugador, magenta = vidas y amenaza,
 * amarillo = nivel y disparo, verde = ayuda (power-up).
 */
export const PALETTE = {
  bg: "#000000",
  ink: "#e6e9ff",
  inkDim: "#8a8fb5",
  inkFaint: "#4a4f70",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
} as const;
