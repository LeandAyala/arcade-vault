// Motor de ASTEROIDES: estado encapsulado, input propio, loop con rAF y ciclo de vida
// (`destroy()` deja el `window` limpio). Portado de started-games/02-asteroids/game.js.

import {
  H,
  INITIAL_ASTEROIDS,
  MAX_DT,
  PALETTE,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  POWERUP_GUARANTEED_AFTER,
  RESPAWN_DELAY,
  SHIP_HIT_FUDGE,
  SPAWN_SAFE_DIST,
  START_LIVES,
  W,
  asteroidsForLevel,
} from "./constants";
import { Asteroid, Bullet, PARTICLE_RGB, Particle, PowerUp, Ship, dist, rand } from "./entities";

export type AsteroidsPhase = "ready" | "playing" | "dead" | "gameover";

/** Lo que el motor comunica al HUD React. */
export interface AsteroidsSnapshot {
  phase: AsteroidsPhase;
  paused: boolean;
  score: number;
  lives: number; // 0..3
  level: number; // >= 1
}

export interface AsteroidsOptions {
  /** Se llama solo cuando cambia algún campo del snapshot (nunca 60 veces por segundo). */
  onChange: (snapshot: AsteroidsSnapshot) => void;
}

export interface AsteroidsGame {
  start(): void; // ready → playing
  restart(): void; // cualquier fase → playing, score 0, vidas 3, nivel 1
  pause(): void;
  resume(): void;
  togglePause(): void;
  /** Con `false` el motor ignora el teclado (p. ej. con el modal de FIN abierto). */
  setInputEnabled(enabled: boolean): void;
  getSnapshot(): AsteroidsSnapshot;
  destroy(): void; // cancela rAF y quita todos los listeners
}

/** Formato de puntuación compartido con el HUD React, para que ambos HUD coincidan. */
export const formatScore = (score: number) => score.toLocaleString("es-ES");

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

export function createAsteroidsGame(canvas: HTMLCanvasElement, options: AsteroidsOptions): AsteroidsGame {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("Canvas 2D no disponible");
  const ctx: CanvasRenderingContext2D = ctxOrNull;

  const pixelFont = cssFont("--pixel", "monospace");
  const monoFont = cssFont("--mono", "monospace");

  // Campo de estrellas estático y tenue, generado una vez.
  const stars = Array.from({ length: 90 }, () => ({
    x: rand(0, W),
    y: rand(0, H),
    r: Math.random() < 0.15 ? 1.2 : 0.7,
    a: rand(0.15, 0.5),
  }));

  // ── Input ──────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  let inputEnabled = true;

  const pressed = (code: string) => {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  };

  const clearKeys = () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    for (const k of Object.keys(justPressed)) justPressed[k] = false;
  };

  // ── Estado ─────────────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let phase: AsteroidsPhase = "ready";
  let paused = false;
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  // ── Snapshot ───────────────────────────────────────────────────────────────
  let lastSnapshot: AsteroidsSnapshot | null = null;
  const getSnapshot = (): AsteroidsSnapshot => ({ phase, paused, score, lives, level });

  function emit() {
    const s = getSnapshot();
    const prev = lastSnapshot;
    if (
      prev &&
      prev.phase === s.phase &&
      prev.paused === s.paused &&
      prev.score === s.score &&
      prev.lives === s.lives &&
      prev.level === s.level
    ) {
      return;
    }
    lastSnapshot = s;
    options.onChange(s);
  }

  // ── Reglas del juego ───────────────────────────────────────────────────────
  function spawnAsteroids(count: number) {
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SPAWN_SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = START_LIVES;
    level = 1;
    deadTimer = 0;
    spawnAsteroids(INITIAL_ASTEROIDS);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(asteroidsForLevel(level));
  }

  function explode(x: number, y: number, count: number, rgb: string) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, rgb));
  }

  function killShip() {
    explode(ship.x, ship.y, 14, PARTICLE_RGB.ship);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      phase = "gameover";
    } else {
      phase = "dead";
      deadTimer = RESPAWN_DELAY;
    }
  }

  const updateParticles = (dt: number) => {
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  };

  function update(dt: number) {
    if (phase === "ready") {
      // Fondo vivo detrás de la pantalla de inicio.
      asteroids.forEach((a) => a.update(dt));
      return;
    }

    if (phase === "gameover") {
      if (pressed("Space")) {
        restart();
        return;
      }
      updateParticles(dt);
      return;
    }

    if (phase === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        phase = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, { left: !!keys.ArrowLeft, right: !!keys.ArrowRight, thrust: !!keys.ArrowUp });
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5, PARTICLE_RGB.asteroid);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= POWERUP_GUARANTEED_AFTER;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * SHIP_HIT_FUDGE) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawLifeIcon(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = PALETTE.magenta;
    ctx.shadowColor = PALETTE.magenta;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /** HUD del canvas: los mismos colores que el HUD React (cyan, amarillo, magenta). */
  function drawHUD() {
    ctx.save();
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left";
    ctx.font = `9px ${pixelFont}`;
    ctx.fillStyle = PALETTE.inkDim;
    ctx.fillText("SCORE", 18, 28);
    ctx.font = `14px ${pixelFont}`;
    ctx.fillStyle = PALETTE.cyan;
    ctx.shadowColor = PALETTE.cyan;
    ctx.shadowBlur = 6;
    ctx.fillText(formatScore(score), 72, 29);

    ctx.textAlign = "center";
    ctx.font = `9px ${pixelFont}`;
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.inkDim;
    ctx.fillText("NIVEL", W / 2 - 18, 28);
    ctx.font = `14px ${pixelFont}`;
    ctx.fillStyle = PALETTE.yellow;
    ctx.shadowColor = PALETTE.yellow;
    ctx.shadowBlur = 6;
    ctx.fillText(String(level).padStart(2, "0"), W / 2 + 30, 29);
    ctx.restore();

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 20 - i * 24, 22);

    if (ship.tripleShot > 0) {
      ctx.save();
      ctx.textAlign = "left";
      ctx.font = `9px ${pixelFont}`;
      ctx.fillStyle = PALETTE.green;
      ctx.shadowColor = PALETTE.green;
      ctx.shadowBlur = 6;
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 18, 50);
      ctx.restore();
    }
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
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
    ctx.fillText(`PUNTAJE: ${formatScore(score)}   —   ESPACIO PARA REINICIAR`, W / 2, H / 2 + 32);
    ctx.restore();
  }

  function draw(now: number) {
    // El componente fija canvas.width = W × devicePixelRatio; el mundo siempre es 800×600.
    const scale = canvas.width / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = PALETTE.ink;
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    if (phase === "ready") return;

    powerUps.forEach((p) => p.draw(ctx, now, pixelFont));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);
    drawHUD();

    if (phase === "gameover") drawGameOver();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    if (!paused) update(dt);
    draw(ts);
    emit();
    rafId = requestAnimationFrame(loop);
  }

  // ── Controles ──────────────────────────────────────────────────────────────
  const canPause = () => phase === "playing" || phase === "dead";

  function start() {
    if (phase !== "ready") return;
    phase = "playing";
    ship.reset();
    clearKeys();
    lastTime = null;
    emit();
  }

  function restart() {
    initGame();
    phase = "playing";
    paused = false;
    clearKeys();
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
    clearKeys();
    // Primer dt = 0 tras reanudar: nada salta.
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

    if (phase === "ready" && e.code === "Space") {
      if (!e.repeat) start();
      return;
    }

    if (paused) return;
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") pause();
  }

  function onBlur() {
    pause();
    clearKeys();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibilityChange);

  initGame();
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
    },
  };
}
