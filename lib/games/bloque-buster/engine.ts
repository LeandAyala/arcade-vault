// Motor de BLOQUE BUSTER: estado encapsulado, input propio, loop con rAF y ciclo de vida
// (`destroy()` deja el `window` limpio). Portado de started-games/04-arkanoid/game.js (SPEC 08).

import {
  BALL_SIZE,
  BASE_BALL_SPEED,
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  BLOCK_COLORS,
  BLOCK_H,
  BLOCK_W,
  EXPLOSION_DURATION,
  H,
  MAX_BOUNCE_ANGLE,
  MAX_DT,
  MAX_STEP,
  PADDLE_CATCH_MARGIN,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  PALETTE,
  POINTS_PER_BLOCK,
  SERVE_DELAY,
  START_LIVES,
  W,
} from "./constants";
import { LEVELS, type BlockColor } from "./levels";
import {
  formatScore,
  sameSnapshot,
  type EngineOptions,
  type GameEngine,
  type GamePhase,
  type GameSnapshot,
} from "../types";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball extends Rect {
  vx: number;
  vy: number;
}

interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
}

interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number; // s
}

/** Teclas cuyo comportamiento por defecto (scroll) se anula mientras se juega. */
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

/** Posiciones guardadas para la estela de la pelota. */
const TRAIL_LENGTH = 6;

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

/** `#rrggbb` → `rgba(r, g, b, a)`. */
function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function buildBlocks(levelNumber: number): Block[] {
  return LEVELS[levelNumber - 1].blocks.map((b) => ({
    x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: b.color,
    alive: true,
  }));
}

export function createBloqueBusterGame(canvas: HTMLCanvasElement, options: EngineOptions): GameEngine {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const pixelFont = cssFont("--pixel", "monospace");
  const monoFont = cssFont("--mono", "monospace");

  // ── Estado ─────────────────────────────────────────────────────────────────
  const paddle: Rect = { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  const ball: Ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  let blocks: Block[] = buildBlocks(1);
  let explosions: Explosion[] = [];
  let trail: { x: number; y: number }[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let serveTimer = 0; // s con la pelota sobre la pala; 0 = en juego
  let won = false;
  let clock = 0; // s, solo para animaciones
  let phase: GamePhase = "ready";
  let paused = false;
  let inputEnabled = true;
  const keys = { left: false, right: false };

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  // ── Snapshot ───────────────────────────────────────────────────────────────
  let lastSnapshot: GameSnapshot | null = null;
  const getSnapshot = (): GameSnapshot => ({ phase, paused, score, lives, level });

  function emit() {
    const s = getSnapshot();
    if (lastSnapshot && sameSnapshot(lastSnapshot, s)) return;
    lastSnapshot = s;
    options.onChange(s);
  }

  // ── Reglas del juego ───────────────────────────────────────────────────────
  const levelSpeed = () => LEVELS[level - 1].speed;

  /** Pelota quieta sobre el centro de la pala. */
  function stickBall() {
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = 0;
    ball.vy = 0;
  }

  function serve() {
    serveTimer = SERVE_DELAY;
    trail = [];
    stickBall();
  }

  function launch() {
    const speed = levelSpeed();
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    blocks = buildBlocks(n);
    serve();
  }

  function initGame() {
    score = 0;
    lives = START_LIVES;
    won = false;
    explosions = [];
    paddle.x = (W - PADDLE_W) / 2;
    keys.left = keys.right = false;
    loadLevel(1);
  }

  function movePaddleTo(x: number) {
    paddle.x = Math.max(0, Math.min(W - paddle.w, x));
  }

  /** Rebote en la pala: el ángulo depende del punto de impacto, la rapidez es la del nivel. */
  function bounceOnPaddle() {
    const half = paddle.w / 2;
    const t = Math.max(-1, Math.min(1, (ball.x + ball.w / 2 - (paddle.x + half)) / half));
    const angle = t * MAX_BOUNCE_ANGLE;
    const speed = BASE_BALL_SPEED * levelSpeed();
    ball.vx = speed * Math.sin(angle);
    ball.vy = -speed * Math.cos(angle);
    ball.y = paddle.y - ball.h;
  }

  /** Rompe como mucho un bloque y rebota por el eje de menor penetración. */
  function hitBlock() {
    const block = blocks.find((b) => b.alive && overlaps(ball, b));
    if (!block) return;
    block.alive = false;
    score += POINTS_PER_BLOCK;
    explosions.push({ x: block.x, y: block.y, w: block.w, h: block.h, color: block.color, elapsed: 0 });

    const overlapX = Math.min(ball.x + ball.w - block.x, block.x + block.w - ball.x);
    const overlapY = Math.min(ball.y + ball.h - block.y, block.y + block.h - ball.y);
    const ballCx = ball.x + ball.w / 2;
    const ballCy = ball.y + ball.h / 2;
    if (overlapX < overlapY) {
      // Golpe lateral: se recoloca fuera del bloque por el eje resuelto.
      if (ballCx < block.x + block.w / 2) {
        ball.x -= overlapX;
        ball.vx = -Math.abs(ball.vx);
      } else {
        ball.x += overlapX;
        ball.vx = Math.abs(ball.vx);
      }
    } else if (ballCy < block.y + block.h / 2) {
      ball.y -= overlapY;
      ball.vy = -Math.abs(ball.vy);
    } else {
      ball.y += overlapY;
      ball.vy = Math.abs(ball.vy);
    }
  }

  function loseBall() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      phase = "gameover";
    } else {
      phase = "dead";
      serve();
    }
  }

  function levelCleared() {
    if (level < LEVELS.length) {
      loadLevel(level + 1);
    } else {
      won = true;
      phase = "gameover";
    }
  }

  /** Un subpaso de física. Devuelve `false` si la pelota dejó de moverse (vida perdida o nivel nuevo). */
  function physicsStep(dt: number): boolean {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    const bottom = ball.y + ball.h;
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      bottom >= paddle.y &&
      bottom <= paddle.y + paddle.h + PADDLE_CATCH_MARGIN
    ) {
      bounceOnPaddle();
    }

    hitBlock();
    if (blocks.every((b) => !b.alive)) {
      levelCleared();
      return false;
    }

    if (ball.y > H) {
      loseBall();
      return false;
    }
    return true;
  }

  function update(dt: number) {
    clock += dt;
    for (const e of explosions) e.elapsed += dt;
    explosions = explosions.filter((e) => e.elapsed < EXPLOSION_DURATION);

    if (phase !== "playing" && phase !== "dead") return;

    if (keys.left) movePaddleTo(paddle.x - PADDLE_SPEED * dt);
    if (keys.right) movePaddleTo(paddle.x + PADDLE_SPEED * dt);

    if (serveTimer > 0) {
      serveTimer -= dt;
      stickBall();
      if (serveTimer <= 0) {
        serveTimer = 0;
        phase = "playing";
        launch();
      }
      return;
    }

    // Subpasos de como mucho MAX_STEP px: la pelota no atraviesa bloques ni la pala.
    const distance = Math.hypot(ball.vx, ball.vy) * dt;
    const steps = Math.max(1, Math.ceil(distance / MAX_STEP));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i++) if (!physicsStep(stepDt)) break;

    if (serveTimer === 0 && phase === "playing") {
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > TRAIL_LENGTH) trail.shift();
    }
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  /** Bloque de neón (mismo lenguaje que CAÍDA): relleno teñido, borde del color y brillo superior. */
  function drawBlock(b: Block) {
    const color = BLOCK_COLORS[b.color];
    const x = b.x + 2;
    const y = b.y + 2;
    const w = b.w - 4;
    const h = b.h - 4;
    ctx.fillStyle = withAlpha(color, 0.22);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = withAlpha(color, 0.55);
    ctx.fillRect(x + 5, y + 4, w - 10, 2);
  }

  function drawExplosion(e: Explosion) {
    const color = BLOCK_COLORS[e.color];
    const p = e.elapsed / EXPLOSION_DURATION;
    const s = 1 + 0.5 * p;
    const w = e.w * s;
    const h = e.h * s;
    const x = e.x + (e.w - w) / 2;
    const y = e.y + (e.h - h) / 2;
    ctx.save();
    if (p < 0.5) {
      ctx.fillStyle = withAlpha(PALETTE.ink, (0.5 - p) * 1.2);
      ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
    }
    ctx.strokeStyle = withAlpha(color, 1 - p);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawPaddle() {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
    ctx.fillStyle = withAlpha(PALETTE.cyan, 0.3);
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(paddle.x + paddle.h / 2, paddle.y + 4, paddle.w - paddle.h, 2);
    ctx.restore();
  }

  function drawBall() {
    const r = ball.w / 2;
    ctx.save();
    // Estela: la pelota es el elemento que más se mueve, así que es el que lleva el énfasis.
    trail.forEach((t, i) => {
      const a = ((i + 1) / (trail.length + 1)) * 0.35;
      ctx.fillStyle = withAlpha(PALETTE.cyan, a);
      ctx.beginPath();
      ctx.arc(t.x + r, t.y + r, r * (0.45 + (0.4 * (i + 1)) / trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    // Durante el saque, la pelota late para anunciar que va a salir.
    const pulse = serveTimer > 0 ? 0.75 + 0.25 * Math.sin(clock * 14) : 1;
    ctx.fillStyle = PALETTE.ink;
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 16 * pulse;
    ctx.beginPath();
    ctx.arc(ball.x + r, ball.y + r, r * (serveTimer > 0 ? 0.85 + 0.15 * pulse : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLabel(text: string, x: number, y: number, align: CanvasTextAlign) {
    ctx.textAlign = align;
    ctx.font = `9px ${pixelFont}`;
    ctx.fillStyle = PALETTE.inkDim;
    ctx.fillText(text, x, y);
  }

  function drawValue(text: string, x: number, y: number, align: CanvasTextAlign, color: string) {
    ctx.textAlign = align;
    ctx.font = `16px ${pixelFont}`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  /** HUD del canvas en la franja superior, con los colores del HUD React. */
  function drawHud() {
    ctx.save();
    ctx.textBaseline = "alphabetic";
    drawLabel("PUNTOS", 20, 24, "left");
    drawValue(formatScore(score), 20, 50, "left", PALETTE.cyan);
    drawLabel("NIVEL", W / 2, 24, "center");
    drawValue(String(level).padStart(2, "0"), W / 2, 50, "center", PALETTE.yellow);
    drawLabel("VIDAS", W - 20, 24, "right");
    for (let i = 0; i < lives; i++) {
      const cx = W - 26 - i * 20;
      ctx.beginPath();
      ctx.arc(cx, 43, 6, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.ink;
      ctx.shadowColor = PALETTE.cyan;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.inkFaint;
    ctx.fillRect(0, 64, W, 1);
    ctx.restore();
  }

  function drawEnd() {
    const title = won ? "¡VICTORIA!" : "GAME OVER";
    const color = won ? PALETTE.green : PALETTE.magenta;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
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

    for (const b of blocks) if (b.alive) drawBlock(b);
    if (phase === "ready") return;

    for (const e of explosions) drawExplosion(e);
    drawPaddle();
    if (phase !== "gameover") drawBall();
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
  const canPause = () => phase === "playing" || phase === "dead";
  const clearKeys = () => {
    keys.left = keys.right = false;
  };

  function start() {
    if (phase !== "ready") return;
    initGame();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function restart() {
    paused = false;
    initGame();
    phase = "playing";
    lastTime = null;
    emit();
  }

  function pause() {
    if (paused || !canPause()) return;
    paused = true;
    clearKeys();
    emit();
  }

  function resume() {
    if (!paused) return;
    paused = false;
    // Primer dt = 0 tras reanudar: la pelota no salta de posición.
    lastTime = null;
    emit();
  }

  const togglePause = () => (paused ? resume() : pause());

  /** La pala solo responde en juego, sin pausa y con el input activo. */
  const canMove = () => inputEnabled && !paused && (phase === "playing" || phase === "dead");

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
    if (!canMove()) return;
    if (e.code === "ArrowLeft") keys.left = true;
    if (e.code === "ArrowRight") keys.right = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "ArrowLeft") keys.left = false;
    if (e.code === "ArrowRight") keys.right = false;
  }

  function onMouseMove(e: MouseEvent) {
    if (!canMove()) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const mouseX = ((e.clientX - rect.left) * W) / rect.width;
    movePaddleTo(mouseX - paddle.w / 2);
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") pause();
  }

  function onBlur() {
    clearKeys();
    pause();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);
  canvas.addEventListener("mousemove", onMouseMove);

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
      if (!enabled) clearKeys();
    },
    getSnapshot,
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
