// Frutas vectoriales de SERPENTINA: contorno neón, relleno teñido y glow. Sin imágenes (SPEC 09).

import { FRUITS, PALETTE, type FruitKind } from "./constants";

/** `#rrggbb` → `rgba(r, g, b, a)`. */
export function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Rellena con el color teñido y traza el contorno del camino actual. */
function neonShape(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = withAlpha(color, 0.28);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.stroke();
}

function apple(ctx: CanvasRenderingContext2D, color: string, u: number) {
  // Cuerpo con la hendidura superior.
  ctx.beginPath();
  ctx.moveTo(0, -0.22 * u);
  ctx.bezierCurveTo(0.25 * u, -0.42 * u, 0.48 * u, -0.22 * u, 0.42 * u, 0.06 * u);
  ctx.bezierCurveTo(0.36 * u, 0.34 * u, 0.18 * u, 0.44 * u, 0, 0.36 * u);
  ctx.bezierCurveTo(-0.18 * u, 0.44 * u, -0.36 * u, 0.34 * u, -0.42 * u, 0.06 * u);
  ctx.bezierCurveTo(-0.48 * u, -0.22 * u, -0.25 * u, -0.42 * u, 0, -0.22 * u);
  neonShape(ctx, color);
  // Rabito y hoja en verde.
  ctx.beginPath();
  ctx.moveTo(0, -0.22 * u);
  ctx.lineTo(0.04 * u, -0.42 * u);
  ctx.strokeStyle = PALETTE.green;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0.16 * u, -0.38 * u, 0.12 * u, 0.05 * u, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(PALETTE.green, 0.5);
  ctx.fill();
}

function cherry(ctx: CanvasRenderingContext2D, color: string, u: number) {
  // Rabitos que se unen arriba.
  ctx.beginPath();
  ctx.moveTo(-0.2 * u, 0.12 * u);
  ctx.quadraticCurveTo(-0.12 * u, -0.22 * u, 0.08 * u, -0.42 * u);
  ctx.moveTo(0.22 * u, 0.06 * u);
  ctx.quadraticCurveTo(0.18 * u, -0.2 * u, 0.08 * u, -0.42 * u);
  ctx.strokeStyle = PALETTE.green;
  ctx.stroke();
  for (const [x, y] of [
    [-0.2, 0.24],
    [0.22, 0.18],
  ]) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, 0.18 * u, 0, Math.PI * 2);
    neonShape(ctx, color);
  }
}

function lemon(ctx: CanvasRenderingContext2D, color: string, u: number) {
  ctx.save();
  ctx.rotate(-0.45);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.4 * u, 0.28 * u, 0, 0, Math.PI * 2);
  neonShape(ctx, color);
  // Puntas del limón.
  ctx.beginPath();
  ctx.moveTo(-0.4 * u, 0);
  ctx.lineTo(-0.48 * u, 0);
  ctx.moveTo(0.4 * u, 0);
  ctx.lineTo(0.48 * u, 0);
  ctx.stroke();
  ctx.restore();
}

function grape(ctx: CanvasRenderingContext2D, color: string, u: number) {
  const r = 0.12 * u;
  const berries = [
    [-0.22, -0.16],
    [0, -0.16],
    [0.22, -0.16],
    [-0.11, 0.04],
    [0.11, 0.04],
    [0, 0.24],
  ];
  for (const [x, y] of berries) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, r, 0, Math.PI * 2);
    neonShape(ctx, color);
  }
  ctx.beginPath();
  ctx.moveTo(0, -0.28 * u);
  ctx.lineTo(0.06 * u, -0.44 * u);
  ctx.strokeStyle = PALETTE.green;
  ctx.stroke();
}

const SHAPES: Record<FruitKind, (ctx: CanvasRenderingContext2D, color: string, u: number) => void> = {
  apple,
  cherry,
  lemon,
  grape,
};

/** Dibuja una fruta centrada en `(cx, cy)` dentro de un cuadrado de lado `size`. */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  kind: FruitKind,
  cx: number,
  cy: number,
  size: number,
  alpha = 1,
) {
  const color = FRUITS[kind].color;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  SHAPES[kind](ctx, color, size);
  ctx.restore();
}
