// Motor de SERPENTINA: snake en rejilla con estado encapsulado, input propio, loop con rAF y
// ciclo de vida (`destroy()` deja el `window` limpio). SPEC 09.

import {
  BITE_DURATION,
  BOARD_Y,
  CELL,
  COLS,
  DEMO_LENGTH,
  DEMO_STEP,
  FRUITS,
  FRUITS_PER_LEVEL,
  GRAPE_BLINK,
  GRAPE_EVERY,
  GRAPE_TTL,
  H,
  MAX_DT,
  PALETTE,
  ROWS,
  START_DIR,
  START_HEAD,
  START_LENGTH,
  STEP_BASE,
  STEP_DEC,
  STEP_MIN,
  TURN_QUEUE_MAX,
  W,
  type Dir,
  type FruitKind,
} from "./constants";
import { drawFruit, withAlpha } from "./fruits";
import {
  formatScore,
  sameSnapshot,
  type EngineOptions,
  type GameEngine,
  type GamePhase,
  type GameSnapshot,
} from "../types";

interface Cell {
  x: number; // columna 0..COLS-1
  y: number; // fila 0..ROWS-1
}

type NormalFruit = Exclude<FruitKind, "grape">;

interface Bite {
  cell: Cell;
  color: string;
  elapsed: number; // s
}

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

/** Teclas cuyo comportamiento por defecto (scroll) se anula mientras se juega. */
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

/** Pesos del sorteo de la fruta normal. */
const NORMAL_FRUITS: NormalFruit[] = ["apple", "cherry", "lemon"];

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

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const cellKey = (c: Cell) => c.y * COLS + c.x;

/** Circuito rectangular fijo de la serpiente demo (sentido horario). */
function buildDemoPath(): Cell[] {
  const x0 = 5;
  const y0 = 4;
  const x1 = COLS - 6;
  const y1 = ROWS - 5;
  const path: Cell[] = [];
  for (let x = x0; x < x1; x++) path.push({ x, y: y0 });
  for (let y = y0; y < y1; y++) path.push({ x: x1, y });
  for (let x = x1; x > x0; x--) path.push({ x, y: y1 });
  for (let y = y1; y > y0; y--) path.push({ x: x0, y });
  return path;
}

export function createSerpentinaGame(canvas: HTMLCanvasElement, options: EngineOptions): GameEngine {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const pixelFont = cssFont("--pixel", "monospace");
  const monoFont = cssFont("--mono", "monospace");
  const demoPath = buildDemoPath();

  // ── Estado ─────────────────────────────────────────────────────────────────
  let snake: Cell[] = [];
  let dir: Dir = START_DIR;
  let turnQueue: Dir[] = [];
  let growth = 0;
  let food: { cell: Cell; kind: NormalFruit } = { cell: { x: 0, y: 0 }, kind: "apple" };
  let grape: { cell: Cell; ttl: number } | null = null;
  let eaten = 0;
  let score = 0;
  let level = 1;
  let stepAcc = 0;
  let result: "lose" | "win" | null = null;
  let bites: Bite[] = [];
  const demo = { pathIndex: DEMO_LENGTH - 1, acc: 0 };
  let phase: GamePhase = "ready";
  let paused = false;
  let inputEnabled = true;

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  // ── Snapshot ───────────────────────────────────────────────────────────────
  /** La longitud incluye el crecimiento pendiente: sube en el mismo tick en que se come. */
  const length = () => (snake.length || START_LENGTH) + growth;
  let lastSnapshot: GameSnapshot | null = null;
  const getSnapshot = (): GameSnapshot => ({
    phase,
    paused,
    score,
    lives: null,
    level,
    extra: { length: length() },
  });

  function emit() {
    const s = getSnapshot();
    if (lastSnapshot && sameSnapshot(lastSnapshot, s)) return;
    lastSnapshot = s;
    options.onChange(s);
  }

  // ── Reglas del juego ───────────────────────────────────────────────────────
  const stepDuration = () => Math.max(STEP_MIN, STEP_BASE - (level - 1) * STEP_DEC);

  /** Celdas sin serpiente ni fruta, para elegir al azar entre ellas (sin reintentos). */
  function freeCells(): Cell[] {
    const taken = new Set(snake.map(cellKey));
    taken.add(cellKey(food.cell));
    if (grape) taken.add(cellKey(grape.cell));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (!taken.has(y * COLS + x)) free.push({ x, y });
    }
    return free;
  }

  function pickNormalFruit(): NormalFruit {
    const total = NORMAL_FRUITS.reduce((sum, k) => sum + FRUITS[k].weight, 0);
    let r = Math.random() * total;
    for (const k of NORMAL_FRUITS) {
      r -= FRUITS[k].weight;
      if (r < 0) return k;
    }
    return "apple";
  }

  /** Coloca la fruta normal. Devuelve `false` si no queda ninguna celda libre. */
  function spawnFood(): boolean {
    const free = freeCells();
    if (free.length === 0) return false;
    food = { cell: free[Math.floor(Math.random() * free.length)], kind: pickNormalFruit() };
    return true;
  }

  function spawnGrape() {
    const free = freeCells();
    if (free.length === 0) return;
    grape = { cell: free[Math.floor(Math.random() * free.length)], ttl: GRAPE_TTL };
  }

  function resetGame() {
    snake = [];
    for (let i = 0; i < START_LENGTH; i++) snake.push({ x: START_HEAD.x - i, y: START_HEAD.y });
    dir = START_DIR;
    turnQueue = [];
    growth = 0;
    grape = null;
    eaten = 0;
    score = 0;
    level = 1;
    stepAcc = 0;
    result = null;
    bites = [];
    food = { cell: { x: -1, y: -1 }, kind: "apple" };
    spawnFood();
  }

  /** Suma los puntos con el nivel previo y después recalcula el nivel. */
  function eat(kind: FruitKind, cell: Cell) {
    score += FRUITS[kind].points * level;
    eaten++;
    level = Math.floor(eaten / FRUITS_PER_LEVEL) + 1;
    growth++;
    bites.push({ cell, color: FRUITS[kind].color, elapsed: 0 });
  }

  function endGame(r: "lose" | "win") {
    result = r;
    phase = "gameover";
    turnQueue = [];
  }

  function tick() {
    const next = turnQueue.shift();
    if (next) dir = next;

    const head = snake[0];
    const d = DELTA[dir];
    const cell = { x: head.x + d.x, y: head.y + d.y };

    if (cell.x < 0 || cell.x >= COLS || cell.y < 0 || cell.y >= ROWS) {
      endGame("lose");
      return;
    }
    // La celda que deja la cola en este tick no cuenta, salvo que la serpiente esté creciendo.
    const body = growth > 0 ? snake : snake.slice(0, -1);
    if (body.some((c) => sameCell(c, cell))) {
      endGame("lose");
      return;
    }

    snake.unshift(cell);
    if (growth > 0) growth--;
    else snake.pop();

    if (sameCell(cell, food.cell)) {
      eat(food.kind, cell);
      if (!spawnFood()) {
        endGame("win");
        return;
      }
      if (eaten % GRAPE_EVERY === 0 && !grape) spawnGrape();
    } else if (grape && sameCell(cell, grape.cell)) {
      grape = null;
      eat("grape", cell);
      if (eaten % GRAPE_EVERY === 0) spawnGrape();
    }
  }

  function updateDemo(dt: number) {
    demo.acc += dt;
    while (demo.acc >= DEMO_STEP) {
      demo.acc -= DEMO_STEP;
      demo.pathIndex = (demo.pathIndex + 1) % demoPath.length;
    }
  }

  function demoSnake(): Cell[] {
    const n = demoPath.length;
    const cells: Cell[] = [];
    for (let k = 0; k < DEMO_LENGTH; k++) cells.push(demoPath[(demo.pathIndex - k + n) % n]);
    return cells;
  }

  function update(dt: number) {
    for (const b of bites) b.elapsed += dt;
    bites = bites.filter((b) => b.elapsed < BITE_DURATION);

    if (phase === "ready") {
      updateDemo(dt);
      return;
    }
    if (phase !== "playing") return;

    if (grape) {
      grape.ttl -= dt;
      if (grape.ttl <= 0) grape = null;
    }

    stepAcc += dt;
    while (phase === "playing" && stepAcc >= stepDuration()) {
      stepAcc -= stepDuration();
      tick();
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  const cx = (c: Cell) => c.x * CELL + CELL / 2;
  const cy = (c: Cell) => BOARD_Y + c.y * CELL + CELL / 2;

  /** Rejilla de puntos en las intersecciones: marca las celdas sin competir con la serpiente. */
  function drawBoard() {
    ctx.fillStyle = withAlpha(PALETTE.inkFaint, 0.55);
    for (let y = 1; y < ROWS; y++) {
      for (let x = 1; x < COLS; x++) ctx.fillRect(x * CELL - 1, BOARD_Y + y * CELL - 1, 2, 2);
    }
    ctx.strokeStyle = withAlpha(PALETTE.inkFaint, 0.8);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, BOARD_Y + 0.5, W - 1, H - BOARD_Y - 1);
  }

  /** Verde de la serpiente mezclado con negro: opaco, así las uniones no se oscurecen. */
  const bodyColor = (t: number) => `rgb(0, ${Math.round(255 * t)}, ${Math.round(136 * t)})`;

  /** La serpiente es un tubo de luz continuo: brillante en la cabeza, tenue en la cola. */
  function drawSnake(cells: Cell[], heading: Dir, alpha: number) {
    if (cells.length === 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Cuerpo: de la cola a la cabeza, cada tramo con su tono.
    ctx.lineWidth = CELL * 0.62;
    const n = cells.length;
    for (let i = n - 1; i > 0; i--) {
      ctx.strokeStyle = bodyColor(1 - (0.6 * i) / Math.max(1, n - 1));
      ctx.beginPath();
      ctx.moveTo(cx(cells[i]), cy(cells[i]));
      ctx.lineTo(cx(cells[i - 1]), cy(cells[i - 1]));
      ctx.stroke();
    }

    // Núcleo de luz: un solo camino, sin solapes de alfa.
    ctx.lineWidth = CELL * 0.16;
    ctx.strokeStyle = withAlpha(PALETTE.ink, 0.35);
    ctx.beginPath();
    ctx.moveTo(cx(cells[n - 1]), cy(cells[n - 1]));
    for (let i = n - 2; i >= 0; i--) ctx.lineTo(cx(cells[i]), cy(cells[i]));
    ctx.stroke();

    // Cabeza con glow y ojos mirando hacia donde avanza.
    const head = cells[0];
    const hx = cx(head);
    const hy = cy(head);
    ctx.fillStyle = PALETTE.green;
    ctx.shadowColor = PALETTE.green;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(hx, hy, CELL * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const d = DELTA[heading];
    const side = { x: -d.y, y: d.x };
    for (const s of [1, -1]) {
      const ex = hx + d.x * CELL * 0.14 + side.x * s * CELL * 0.18;
      const ey = hy + d.y * CELL * 0.14 + side.y * s * CELL * 0.18;
      ctx.fillStyle = PALETTE.bg;
      ctx.beginPath();
      ctx.arc(ex, ey, CELL * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(ex + d.x * 1.2, ey + d.y * 1.2, CELL * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBite(b: Bite) {
    const p = b.elapsed / BITE_DURATION;
    ctx.save();
    ctx.strokeStyle = withAlpha(b.color, 1 - p);
    ctx.lineWidth = 2;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx(b.cell), cy(b.cell), CELL * (0.5 + 0.7 * p), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFruits() {
    drawFruit(ctx, food.kind, cx(food.cell), cy(food.cell), CELL);
    if (grape) {
      // Parpadeo en los últimos GRAPE_BLINK s: avisa de que va a caducar.
      const blinkOff = grape.ttl < GRAPE_BLINK && Math.floor(grape.ttl * 8) % 2 === 1;
      drawFruit(ctx, "grape", cx(grape.cell), cy(grape.cell), CELL, blinkOff ? 0.2 : 1);
    }
  }

  function drawLabel(text: string, x: number, y: number, align: CanvasTextAlign) {
    ctx.textAlign = align;
    ctx.font = `9px ${pixelFont}`;
    ctx.fillStyle = PALETTE.inkDim;
    ctx.fillText(text, x, y);
  }

  function drawValue(text: string, x: number, y: number, align: CanvasTextAlign, color: string) {
    ctx.textAlign = align;
    ctx.font = `14px ${pixelFont}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  /** HUD del canvas en la franja superior (y 0–50), con los colores del HUD React. */
  function drawHud() {
    ctx.save();
    ctx.textBaseline = "alphabetic";
    drawLabel("PUNTOS", 20, 18, "left");
    drawValue(formatScore(score), 20, 40, "left", PALETTE.cyan);
    drawLabel("NIVEL", W / 2, 18, "center");
    drawValue(String(level).padStart(2, "0"), W / 2, 40, "center", PALETTE.yellow);
    drawLabel("LONGITUD", W - 20, 18, "right");
    drawValue(String(length()), W - 20, 40, "right", PALETTE.green);
    ctx.restore();
  }

  function drawEnd() {
    const won = result === "win";
    const title = won ? "¡VICTORIA!" : "GAME OVER";
    const color = won ? PALETTE.green : PALETTE.magenta;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, BOARD_Y, W, H - BOARD_Y);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `40px ${pixelFont}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillText(title, W / 2, H / 2 - 22);
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
    drawBoard();

    if (phase === "ready") {
      const cells = demoSnake();
      const a = cells[0];
      const b = cells[1];
      const heading: Dir = a.x > b.x ? "right" : a.x < b.x ? "left" : a.y > b.y ? "down" : "up";
      drawSnake(cells, heading, 0.85);
      return;
    }

    drawFruits();
    drawSnake(snake, dir, phase === "gameover" ? 0.35 : 1);
    for (const b of bites) drawBite(b);
    drawHud();
    if (phase === "gameover") drawEnd();
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
  function start() {
    if (phase !== "ready") return;
    resetGame();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function restart() {
    paused = false;
    resetGame();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (paused || phase !== "playing") return;
    paused = true;
    emit();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    // Primer dt = 0 tras reanudar: la serpiente no avanza varias celdas de golpe.
    lastTime = null;
    emit();
  }

  const togglePause = () => (paused ? resume() : pause());

  /** Encola un giro: descarta el opuesto o igual a la última dirección encolada y la cola llena. */
  function queueTurn(d: Dir) {
    const last = turnQueue.length ? turnQueue[turnQueue.length - 1] : dir;
    if (d === last || d === OPPOSITE[last] || turnQueue.length >= TURN_QUEUE_MAX) return;
    turnQueue.push(d);
  }

  // ── Listeners ──────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (!inputEnabled || isInteractiveTarget(e.target)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) togglePause();
      return;
    }
    if (phase === "ready") {
      if (e.code === "Space" && !e.repeat) start();
      return;
    }
    if (phase !== "playing" || paused) return;
    const d = KEY_DIR[e.code];
    if (d) queueTurn(d);
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") pause();
  }

  function onBlur() {
    turnQueue = [];
    pause();
  }

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
      if (!enabled) turnQueue = [];
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
