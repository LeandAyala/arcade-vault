// Motor de CAÍDA: estado encapsulado, input propio, loop con rAF y ciclo de vida
// (`destroy()` deja el `window` limpio). Portado de started-games/03-tetris/game.js.

import {
  BLOCK,
  BOARD_X,
  BOARD_Y,
  COLS,
  GHOST_ALPHA,
  H,
  HARD_DROP_POINTS,
  KICKS,
  LINE_SCORES,
  MAX_DT,
  PALETTE,
  PIECES,
  PIECE_COLORS,
  PIECE_COUNT,
  ROWS,
  SCORE_CAP,
  SOFT_DROP_POINTS,
  W,
  dropIntervalFor,
  levelForLines,
} from "./constants";
import {
  formatScore,
  sameSnapshot,
  type EngineOptions,
  type GameEngine,
  type GamePhase,
  type GameSnapshot,
} from "../types";

type Shape = number[][];
type Board = number[][];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

/** Teclas cuyo comportamiento por defecto (scroll) se anula mientras se juega. */
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

/** Con el foco en un campo o botón, el teclado es de ese elemento, no del juego. */
function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}

/** Lee una pila de fuentes CSS del sitio (`--pixel`, `--mono`) ya resuelta. */
function cssFont(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

const createBoard = (): Board => Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_COUNT) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

/** Rotación horaria: transponer + invertir filas. */
function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

/** `#rrggbb` → `rgba(r, g, b, a)`. */
function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function createCaidaGame(canvas: HTMLCanvasElement, options: EngineOptions): GameEngine {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const pixelFont = cssFont("--pixel", "monospace");
  const monoFont = cssFont("--mono", "monospace");

  // ── Estado ─────────────────────────────────────────────────────────────────
  let board: Board = createBoard();
  let current: Piece | null = null;
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropAccum = 0; // ms
  let phase: GamePhase = "ready";
  let paused = false;
  let inputEnabled = true;

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  // ── Snapshot ───────────────────────────────────────────────────────────────
  let lastSnapshot: GameSnapshot | null = null;
  const getSnapshot = (): GameSnapshot => ({ phase, paused, score, lives: null, level, extra: { lines } });

  function emit() {
    const s = getSnapshot();
    if (lastSnapshot && sameSnapshot(lastSnapshot, s)) return;
    lastSnapshot = s;
    options.onChange(s);
  }

  // ── Reglas del juego ───────────────────────────────────────────────────────
  const addScore = (points: number) => {
    score = Math.min(SCORE_CAP, score + points);
  };

  function collide(shape: Shape, ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate(p: Piece) {
    const rotated = rotateCW(p.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, p.x + kick, p.y)) {
        p.shape = rotated;
        p.x += kick;
        return;
      }
    }
  }

  function merge(p: Piece) {
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c] && p.y + r >= 0) board[p.y + r][p.x + c] = p.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      // El multiplicador es el nivel antes de sumar las líneas nuevas (como el template).
      addScore((LINE_SCORES[cleared] ?? 0) * level);
      level = levelForLines(lines);
    }
  }

  function ghostY(p: Piece) {
    let gy = p.y;
    while (!collide(p.shape, p.x, gy + 1)) gy++;
    return gy;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) phase = "gameover";
  }

  function lockPiece(p: Piece) {
    merge(p);
    clearLines();
    spawn();
  }

  function hardDrop(p: Piece) {
    const gy = ghostY(p);
    addScore((gy - p.y) * HARD_DROP_POINTS);
    p.y = gy;
    lockPiece(p);
  }

  function softDrop(p: Piece) {
    if (!collide(p.shape, p.x, p.y + 1)) {
      p.y++;
      addScore(SOFT_DROP_POINTS);
    } else {
      lockPiece(p);
    }
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropAccum = 0;
    next = randomPiece();
    spawn();
  }

  function update(dt: number) {
    if (phase !== "playing" || !current) return;
    dropAccum += dt * 1000;
    if (dropAccum >= dropIntervalFor(level)) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece(current);
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  /** Bloque de neón: relleno oscuro teñido, borde del color y brillo superior. */
  function drawBlock(px: number, py: number, size: number, type: number, glow: boolean) {
    const color = PIECE_COLORS[type];
    const x = px + 1.5;
    const y = py + 1.5;
    const s = size - 3;
    ctx.fillStyle = withAlpha(color, 0.22);
    ctx.fillRect(x, y, s, s);
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = withAlpha(color, 0.55);
    ctx.fillRect(x + 4, y + 4, s - 8, 2);
  }

  function drawShape(p: Piece, y: number, glow: boolean) {
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++) {
        const t = p.shape[r][c];
        if (t && y + r >= 0) drawBlock(BOARD_X + (p.x + c) * BLOCK, BOARD_Y + (y + r) * BLOCK, BLOCK, t, glow);
      }
  }

  function drawWell() {
    // Puntos en las intersecciones en lugar de una grilla de líneas.
    ctx.fillStyle = PALETTE.inkFaint;
    for (let r = 1; r < ROWS; r++)
      for (let c = 1; c < COLS; c++) ctx.fillRect(BOARD_X + c * BLOCK - 1, BOARD_Y + r * BLOCK - 1, 2, 2);

    ctx.save();
    ctx.strokeStyle = PALETTE.magenta;
    ctx.shadowColor = PALETTE.magenta;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X - 1, BOARD_Y - 1, COLS * BLOCK + 2, ROWS * BLOCK + 2);
    ctx.restore();
  }

  const LEFT_X = BOARD_X - 28; // texto alineado a la derecha, pegado al pozo
  const RIGHT_X = BOARD_X + COLS * BLOCK + 28; // texto alineado a la izquierda
  const NEXT_CELL = 24;
  const NEXT_BOX = { x: RIGHT_X, y: 78, size: NEXT_CELL * 4 + 12 };

  function drawLabel(text: string, x: number, y: number, align: CanvasTextAlign) {
    ctx.textAlign = align;
    ctx.font = `9px ${pixelFont}`;
    ctx.fillStyle = PALETTE.inkDim;
    ctx.fillText(text, x, y);
  }

  function drawValue(text: string, x: number, y: number, color: string) {
    ctx.textAlign = "right";
    ctx.font = `18px ${pixelFont}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  /** HUD del canvas: mismos colores que el HUD React (puntos cyan, nivel amarillo, líneas verde). */
  function drawPanels(withValues: boolean) {
    ctx.save();
    ctx.textBaseline = "alphabetic";

    const stats: [string, string, string][] = [
      ["PUNTOS", formatScore(score), PALETTE.cyan],
      ["LÍNEAS", formatScore(lines), PALETTE.green],
      ["NIVEL", String(level).padStart(2, "0"), PALETTE.yellow],
    ];
    stats.forEach(([label, value, color], i) => {
      const y = 64 + i * 92;
      drawLabel(label, LEFT_X, y, "right");
      if (withValues) drawValue(value, LEFT_X, y + 32, color);
    });

    drawLabel("SIGUIENTE", RIGHT_X, 64, "left");
    ctx.strokeStyle = PALETTE.inkFaint;
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_BOX.x + 0.5, NEXT_BOX.y + 0.5, NEXT_BOX.size, NEXT_BOX.size);
    if (withValues) {
      const shape = next.shape;
      const offX = NEXT_BOX.x + 6 + ((4 - shape[0].length) * NEXT_CELL) / 2;
      const offY = NEXT_BOX.y + 6 + ((4 - shape.length) * NEXT_CELL) / 2;
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          if (shape[r][c]) drawBlock(offX + c * NEXT_CELL, offY + r * NEXT_CELL, NEXT_CELL, shape[r][c], false);
    }

    const controls: [string, string][] = [
      ["← →", "mover"],
      ["↑ X", "rotar"],
      ["↓", "bajar"],
      ["ESPACIO", "caída"],
      ["P", "pausa"],
    ];
    drawLabel("CONTROLES", RIGHT_X, 272, "left");
    ctx.font = `12px ${monoFont}`;
    controls.forEach(([keys, action], i) => {
      const y = 300 + i * 24;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(keys, RIGHT_X, y);
      ctx.fillStyle = PALETTE.inkDim;
      ctx.fillText(action, RIGHT_X + 76, y);
    });
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `40px ${pixelFont}`;
    ctx.fillStyle = PALETTE.magenta;
    ctx.shadowColor = PALETTE.magenta;
    ctx.shadowBlur = 18;
    ctx.fillText("GAME OVER", W / 2, H / 2 - 22);
    ctx.shadowBlur = 0;
    ctx.font = `15px ${monoFont}`;
    ctx.fillStyle = PALETTE.ink;
    // El reproductor abre el modal FIN DEL JUEGO encima; el reinicio va por JUGAR DE NUEVO.
    ctx.fillText(`PUNTAJE: ${formatScore(score)}`, W / 2, H / 2 + 32);
    ctx.restore();
  }

  function draw() {
    // GameScreen fija canvas.width = W × devicePixelRatio; el mundo siempre es 800×600.
    const scale = canvas.width / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    drawWell();
    if (phase === "ready") {
      drawPanels(false);
      return;
    }

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c]) drawBlock(BOARD_X + c * BLOCK, BOARD_Y + r * BLOCK, BLOCK, board[r][c], false);

    if (current) {
      if (phase === "playing") {
        ctx.globalAlpha = GHOST_ALPHA;
        drawShape(current, ghostY(current), false);
        ctx.globalAlpha = 1;
      }
      drawShape(current, current.y, phase === "playing");
    }

    drawPanels(true);
    if (phase === "gameover") drawGameOver();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
    emit();
    rafId = requestAnimationFrame(loop);
  }

  // ── Controles ──────────────────────────────────────────────────────────────
  const canPause = () => phase === "playing";

  function start() {
    if (phase !== "ready") return;
    initGame();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function restart() {
    paused = false;
    phase = "playing";
    initGame();
    lastTime = null;
    emit();
  }

  function pause() {
    if (paused || !canPause()) return;
    paused = true;
    emit();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    // Primer dt = 0 tras reanudar: la pieza no cae varias filas de golpe.
    lastTime = null;
    emit();
  }

  const togglePause = () => (paused ? resume() : pause());

  // ── Listeners ──────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (!inputEnabled || isInteractiveTarget(e.target)) return;

    if (GAME_KEYS.has(e.code)) e.preventDefault();

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) togglePause();
      return;
    }

    if (phase === "ready") {
      // Espacio solo inicia: esa pulsación no hace hard drop.
      if (e.code === "Space" && !e.repeat) start();
      return;
    }

    if (paused || phase !== "playing" || !current) return;
    const p = current;

    switch (e.code) {
      case "ArrowLeft":
        if (!collide(p.shape, p.x - 1, p.y)) p.x--;
        break;
      case "ArrowRight":
        if (!collide(p.shape, p.x + 1, p.y)) p.x++;
        break;
      case "ArrowDown":
        softDrop(p);
        break;
      case "ArrowUp":
      case "KeyX":
        if (!e.repeat) tryRotate(p);
        break;
      case "Space":
        if (!e.repeat) hardDrop(p);
        break;
    }
    emit();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") pause();
  }

  const onBlur = () => pause();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);

  emit();
  rafId = requestAnimationFrame(loop);

  return {
    start,
    restart,
    pause,
    resume,
    togglePause,
    setInputEnabled(enabled: boolean) {
      inputEnabled = enabled;
    },
    getSnapshot,
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
