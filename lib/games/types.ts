// Contrato común de los juegos reales del Vault. Cada motor en `lib/games/<id>/` lo implementa
// y se registra en `lib/games/registry.ts`; el reproductor (`components/game-player.tsx`) no
// conoce ningún juego concreto.

export type GamePhase = "ready" | "playing" | "dead" | "gameover";

/** Lo que el motor comunica al HUD React. */
export interface GameSnapshot {
  phase: GamePhase;
  paused: boolean;
  score: number;
  /** `null` si el juego no tiene vidas (el HUD muestra "—"). */
  lives: number | null;
  level: number; // >= 1
  /** Stats propias del juego para el HUD React, por clave de `RealGameDef.hudExtras` (p. ej. `{ lines: 23 }`). */
  extra?: Record<string, number>;
}

/** Casilla extra del HUD React: muestra `snapshot.extra[key]` con la etiqueta `label`. */
export interface GameHudExtra {
  key: string; // "lines"
  label: string; // "Líneas"
}

export interface EngineOptions {
  /** Se llama solo cuando cambia algún campo del snapshot (nunca 60 veces por segundo). */
  onChange: (snapshot: GameSnapshot) => void;
}

export interface GameEngine {
  start(): void; // ready → playing
  restart(): void; // cualquier fase → playing con el estado inicial
  pause(): void;
  resume(): void;
  togglePause(): void;
  /** Con `false` el motor ignora el teclado (p. ej. con el modal de FIN abierto). */
  setInputEnabled(enabled: boolean): void;
  getSnapshot(): GameSnapshot;
  destroy(): void; // cancela rAF y quita todos los listeners
}

export type CreateEngine = (canvas: HTMLCanvasElement, options: EngineOptions) => GameEngine;

export interface GameControl {
  keys: string[]; // etiquetas de tecla: "←", "ESPACIO"
  label: string; // acción: "rotar"
}

/** Definición de un juego real: todo lo que el reproductor necesita para montarlo. */
export interface RealGameDef {
  /** Igual a `public.games.id`. */
  id: string;
  create: CreateEngine;
  /** Mundo lógico del motor; el canvas se escala al CRT (4:3) con letterbox si la proporción difiere. */
  world: { width: number; height: number };
  initialSnapshot: GameSnapshot;
  /** Título de la pantalla de inicio. */
  startTitle: string;
  controls: GameControl[];
  /** Texto bajo `EN PAUSA`. */
  pauseHint: string;
  /** Casillas extra del HUD React tras `Nivel`, en este orden. */
  hudExtras?: GameHudExtra[];
}

/** Compara dos snapshots campo a campo (incluidos los valores de `extra`). */
export function sameSnapshot(a: GameSnapshot, b: GameSnapshot): boolean {
  if (
    a.phase !== b.phase ||
    a.paused !== b.paused ||
    a.score !== b.score ||
    a.lives !== b.lives ||
    a.level !== b.level
  ) {
    return false;
  }
  const ea = a.extra ?? {};
  const eb = b.extra ?? {};
  const keys = new Set([...Object.keys(ea), ...Object.keys(eb)]);
  for (const k of keys) if (ea[k] !== eb[k]) return false;
  return true;
}

/** Formato de puntuación compartido por el HUD del canvas y el HUD React. */
export const formatScore = (score: number) => score.toLocaleString("es-ES");
