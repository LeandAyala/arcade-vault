# Contrato de integración de un juego real

Resumen de lo que SPEC 05 (ASTEROIDES) y SPEC 06 (catálogo y leaderboard) dejaron establecido, ya generalizado en el registro de juegos reales. La implementación de referencia es `lib/games/asteroids/`. **Léela antes de redactar una spec nueva.**

## Piezas existentes (no se reescriben)

| Pieza | Archivo | Rol |
| --- | --- | --- |
| Contrato | `lib/games/types.ts` | `GamePhase`, `GameSnapshot`, `GameEngine`, `EngineOptions`, `CreateEngine`, `RealGameDef`, `formatScore`. |
| Registro | `lib/games/registry.ts` | `REAL_GAMES: Record<id, RealGameDef>`. Un id ausente usa la simulación de SPEC 01. |
| Pantalla | `components/game-screen.tsx` | Monta el `<canvas>` con DPR, crea/destruye el motor (seguro con StrictMode), pantalla de inicio con `controls`, `REQUIERE TECLADO` sin teclado. |
| Reproductor | `components/game-player.tsx` | `RealGamePlayer`: HUD React, `PAUSA`/`FIN`/`SALIR`, overlay `EN PAUSA`, abre el modal al recibir `phase: "gameover"`. |
| Guardado | `app/juegos/[id]/jugar/actions.ts` | `saveScore` (genérico por `gameId`). Valida `1..SCORE_MAX` (`9_999_999`). |
| Rankings | `lib/scores.ts` | Lecturas cacheadas con `cacheTag("scores")`; `saveScore` hace `updateTag`. |
| Catálogo | `lib/catalog.ts`, `public.games` | `getGames`/`getGame` con `cacheTag("games")`. El `id` del juego es el de `public.games`. |
| 404 | `proxy.ts` | Valida `/juegos/:id(/jugar)` contra `public.games`. |

Añadir un juego **no** requiere tocar ninguna de estas piezas: solo `lib/games/<id>/` y una línea en el registro (más la migración si cambia el catálogo).

## Contrato del motor

```ts
export function create<Nombre>Game(canvas: HTMLCanvasElement, options: EngineOptions): GameEngine;
```

Reglas obligatorias (todas cumplidas por `lib/games/asteroids/engine.ts`):

1. **Sin estado de módulo.** Todo el estado vive en el closure de `create…`. Dos llamadas = dos partidas independientes.
2. **Fases:** `ready` (dibuja el fondo/escena en movimiento, sin jugador ni HUD de juego) → `playing` ⇄ `dead` (si hay vidas) → `gameover`. Una victoria (`win`) también termina en `gameover`.
3. **`start()`** solo desde `ready`. **`restart()`** desde cualquier fase: estado inicial y `phase: "playing"`. En `gameover` el motor **no** reinicia por teclado: el reproductor abre el modal y reinicia con `JUGAR DE NUEVO`.
4. **Snapshot:** `onChange` se llama solo cuando cambia algún campo (`phase`, `paused`, `score`, `lives`, `level` o un valor de `extra`), nunca por frame. `lives: null` si el juego no tiene vidas. Para comparar, usa `sameSnapshot` de `lib/games/types.ts`.
   - **Stats extra (SPEC 07):** un juego puede exponer stats propias en `extra: Record<string, number>` (p. ej. `{ lines: 23 }`) y declararlas en `RealGameDef.hudExtras` (`[{ key: "lines", label: "Líneas" }]`). El HUD React pinta una casilla `.hud-stat.extra` por cada una tras `Nivel`. Ambos campos son opcionales; si el juego los usa, `initialSnapshot.extra` lleva sus valores iniciales.
5. **Loop:** `requestAnimationFrame`, `dt` en segundos limitado a `MAX_DT = 0.05`. En pausa no hay `update`, solo `draw`. Al reanudar, `lastTime = null` (primer `dt` = 0).
6. **Input:** listeners en `window` (`keydown`, `keyup`, `blur`) y `document` (`visibilitychange`); ratón, si lo hay, sobre el canvas. Todos se quitan en `destroy()`.
   - `preventDefault` de flechas y Espacio (y cualquier tecla de juego que haga scroll).
   - Ignora eventos con el foco en `INPUT`, `TEXTAREA`, `SELECT`, `BUTTON` o `contentEditable`.
   - `P` y `Escape` alternan pausa; Espacio inicia desde `ready`. No reutilizar esas teclas para otra acción.
   - `blur` y `visibilitychange` (oculta) pausan.
   - `setInputEnabled(false)` ignora el teclado y limpia las teclas pulsadas (modal abierto).
7. **`destroy()`** cancela el rAF, quita todos los listeners y marca el motor como destruido (el loop no vuelve a programarse).
8. **Canvas:** mundo lógico fijo (`W`, `H` en `constants.ts`). `GameScreen` fija `canvas.width = W × dpr`; el motor dibuja con `ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0)`. El `.crt-screen` es 4:3; otra proporción se ve con letterbox (`object-fit: contain` en `.game-canvas`).
9. **Puntuación:** entero `>= 0`. El HUD de canvas usa `formatScore` de `lib/games/types.ts` para coincidir con el HUD React. Una puntuación `> 9_999_999` no se puede guardar: si el juego puede superarla, la spec lo trata.
10. **Sin `Math.random()` ni acceso a `window` en el render de React:** el motor solo se crea en `useEffect` (lo hace `GameScreen`).
11. **Fuentes:** leer `--pixel` y `--mono` con `getComputedStyle(document.documentElement)` (ver `cssFont` en el motor de asteroides).

## `RealGameDef`

```ts
export const <id>Def: RealGameDef = {
  id: "<id de public.games>",
  create: create<Nombre>Game,
  world: { width: W, height: H },
  initialSnapshot: { phase: "ready", paused: false, score: 0, lives: <N | null>, level: 1 },
  startTitle: "<TÍTULO>",
  controls: [{ keys: ["←", "→"], label: "mover" }, /* … */ { keys: ["P"], label: "pausa" }],
  pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR",
  hudExtras: [/* opcional: { key: "lines", label: "Líneas" } */],
};
```

`initialSnapshot` debe coincidir con el primer `onChange` del motor (evita un parpadeo del HUD).

## Estilo visual

- `PALETTE` en `constants.ts` con los hex de `app/globals.css`: `bg #000000`, `ink #e6e9ff`, `inkDim #8a8fb5`, `inkFaint #4a4f70`, `cyan #00f5ff`, `magenta #ff006e`, `yellow #f5ff00`, `green #00ff88`.
- Glow con `shadowBlur` solo en elementos clave (jugador, proyectiles, power-ups); el resto con trazo doble o alpha, por rendimiento.
- GAME OVER en el canvas: título en `--pixel` magenta con glow y `PUNTAJE: N` en `--mono`, sin instrucción de reinicio (lo da el modal).
- Diseño con `/frontend-design` durante la implementación (CLAUDE.md lo exige).

## Catálogo (`public.games`)

```sql
-- columnas: id text pk (^[a-z0-9-]{1,32}$), title, short, long,
--   cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS'), cover (clase CSS cover-*),
--   color in ('cyan','magenta','yellow','green'), sort_order smallint unique, created_at
insert into public.games (id, title, short, long, cat, cover, color, sort_order) values (...);
update public.games set title = '…', long = '…' where id = '…';
```

- Migración con `npx supabase migration new <accion>_<id>` y `npx supabase db push`.
- `getGames` tiene `cacheLife("days")`: tras la migración, el catálogo se refresca con un nuevo build/deploy (o expiración). La spec lo menciona en la verificación.
- Una portada nueva es una clase `.cover-<nombre>` en `app/globals.css` con el mismo patrón que las existentes (`cover-bricks`, `cover-tetro`, …).

## Correspondencias conocidas template → catálogo

| Template | Fila existente | Notas |
| --- | --- | --- |
| `02-asteroids` | `asteroides` | Ya integrado (SPEC 05). |
| `03-tetris` | `caida` (PUZZLE, `cover-tetro`) | Ya integrado (SPEC 07, `lib/games/caida/`, stat extra `lines`). Tablero 300×600 vertical + preview "siguiente": rediseñar a 800×600 con panel lateral en canvas. Sin vidas → `lives: null`. Puntos `[0,100,300,500,800] × nivel`, soft drop +1/fila, hard drop +2/celda. Usa `↑`/`X` para rotar y Espacio para hard drop: Espacio también inicia desde `ready` (sin conflicto). |
| `04-arkanoid` | `bloque-buster` (ARCADE, `cover-bricks`) | 800×600. +10 por bloque, 3 vidas, 5 niveles en `levels.js`, estado `win` → `gameover`. Sonidos y spritesheet en `assets/`; menú de niveles en la pausa (descartar). Ratón para la pala. |
