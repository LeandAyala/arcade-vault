# SPEC 07 — Juego CAÍDA jugable en el reproductor

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-16
> **Objective:** Portar a TypeScript el juego de `references/resources/templates/started-games/03-tetris` y montarlo en `/juegos/caida/jugar` como juego real del registro, con su sistema de puntos y sus líneas reflejados en ambos HUD y guardable en el leaderboard.

---

## Por qué existe esta spec

Hoy `/juegos/caida/jugar` usa la simulación de SPEC 01: la puntuación sube sola y no hay juego real. El template `03-tetris` (`game.js`, ~305 líneas) usa variables globales y un listener `keydown` en `document` que nunca se quita. Su `requestAnimationFrame` solo se cancela al perder. Pinta un HUD y overlays en el DOM y guarda un tema claro/oscuro en `localStorage`. Su tablero es vertical (300×600) con la "siguiente pieza" en un segundo canvas, así que no encaja en el CRT 4:3.

Esta spec lo convierte en un motor con el contrato de `lib/games/types.ts`, rediseñado dentro de un mundo 800×600. Es el segundo juego real del Vault. También extiende el contrato con **stats extra** para que el HUD React muestre `Líneas` sin acoplarse a un juego concreto.

---

## Scope

**In:**

- Catálogo: reutiliza la fila `caida` de `public.games` sin cambios (`title` `CAÍDA`, `cat` `PUZZLE`, `cover` `cover-tetro`, `color` `magenta`, `sort_order` `2`). Sin migración.
- Motor TypeScript strict en `lib/games/caida/engine.ts` que implementa `GameEngine`, sin estado de módulo, con la jugabilidad literal del template:
  - Tablero de `10 × 20` celdas de `30` px.
  - **8 piezas**: I, O, T, S, Z, J, L y la tuerca N (`[[8,8,8],[8,0,8],[8,8,8]]`), con las mismas matrices que `PIECES` del template.
  - Sorteo uniforme `Math.floor(Math.random() * 8) + 1`, sin bolsa.
  - Aparición en `x = floor(COLS / 2) − floor(ancho / 2)`, `y = 0`.
  - Rotación horaria (`rotateCW`: transponer + invertir filas) con wall kicks `[0, -1, 1, -2, 2]`.
  - Pieza fantasma proyectada hasta la colisión y dibujada con `globalAlpha = 0.2`.
  - Caída automática cada `dropInterval = max(100, 1000 − (nivel − 1) × 90)` ms. Al bajar por gravedad, el acumulador vuelve a `0`.
  - Al fijar una pieza: `merge` → `clearLines` → `spawn`.
  - **Sistema de puntos:**
    - Líneas limpiadas de una vez: `LINE_SCORES = [0, 100, 300, 500, 800]` × nivel actual (1 línea `100`, 2 `300`, 3 `500`, 4 `800`). El multiplicador es el nivel **antes** de recalcularlo con las líneas nuevas.
    - Soft drop (`↓`): `+1` por fila que la pieza baja. Si no puede bajar, la pieza se fija sin sumar.
    - Hard drop (Espacio): `+2` por celda recorrida hasta la posición fantasma, y la pieza se fija.
    - La puntuación nunca supera `SCORE_CAP = 9_999_999`: al llegar al tope deja de sumar y la partida sigue.
  - Sin vidas: `lives: null`.
  - Nivel `floor(líneas / 10) + 1`.
  - Fin: si la pieza nueva colisiona al aparecer → `phase: "gameover"`.
- **Cambio de contrato (stats extra)** en `lib/games/types.ts` y `components/game-player.tsx`:
  - `GameSnapshot.extra?: Record<string, number>`.
  - `RealGameDef.hudExtras?: GameHudExtra[]` con `{ key, label }`.
  - `PlayerHud` pinta un `.hud-stat.extra` por cada entrada de `hudExtras`, después de `Nivel`, con el valor `extra[key]`.
  - ASTEROIDES no declara `hudExtras` y su HUD no cambia.
- Definición `caidaDef` en `lib/games/caida/index.ts` y entrada en `lib/games/registry.ts`.
- Mundo lógico 800×600 (4:3), nítido según `devicePixelRatio`, con tablero centrado y dos paneles dibujados en el canvas:
  - Panel izquierdo (`x` 0–250): `PUNTOS`, `LÍNEAS`, `NIVEL`.
  - Tablero (`x` 250–550, `y` 0–600) con grilla.
  - Panel derecho (`x` 550–800): `SIGUIENTE` (caja de 4×4 celdas) y la lista de controles.
- Dos HUD:
  - HUD de canvas: `PUNTOS` (con `formatScore`), `LÍNEAS`, `NIVEL` y `SIGUIENTE`.
  - HUD React `.player-hud`: `Jugador`, `Puntuación`, `Vidas` (`—`), `Nivel`, `Líneas`.
- Pantalla de inicio (`GameScreen`) con `startTitle: "CAÍDA"` y controles: `←` `→` mover, `↑` `X` rotar, `↓` bajar, `ESPACIO` caída, `P` pausa.
- En fase `ready` el canvas dibuja el tablero vacío con su grilla y los marcos de los paneles, sin pieza ni valores.
- GAME OVER: el canvas dibuja `GAME OVER` en `--pixel` magenta con glow y `PUNTAJE: N` en `--mono`, sin instrucción de reinicio. El reproductor abre el modal `FIN DEL JUEGO`. `GUARDAR PUNTUACIÓN` guarda con `saveScore` y el jugador aparece en `/salon` y `/juegos/caida`.
- Pausa (`PAUSA`, `P`, `Escape`, automática al perder el foco), `FIN`, `JUGAR DE NUEVO` e input bloqueado con el modal abierto: como SPEC 05.
- Estilo neón del Vault con `PALETTE` ampliada con naranja `#ff7700` y violeta `#aa00ff` (los de `cover-tetro`). La tuerca usa `inkDim`. Se diseña con `/frontend-design`.
- Documentar la extensión del contrato en `.claude/skills/nuevo-juego/reference/integration.md`.

**Out of scope (para specs futuras):**

- Tema claro/oscuro del template y su `localStorage` (`tetris-theme`).
- HUD DOM, overlay DOM y botón `Reiniciar` del template (los sustituyen el HUD de canvas, el HUD React y el modal).
- Sonido y música.
- Bolsa de 7/8 piezas, hold, T-spins, combos o back-to-back.
- Auto-repeat propio (DAS/ARR) distinto de la repetición del sistema operativo.
- Selección de nivel inicial.
- Cambiar el `title`, el `long` o la portada de `caida`.
- Controles táctiles.
- Anti-trampas (validación de partidas en servidor).
- Tests (no hay framework configurado).

---

## Modelo de datos

- Constantes en `lib/games/caida/constants.ts`, con los valores del template:
  - `W = 800`, `H = 600`, `MAX_DT = 0.05`.
  - `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `BOARD_X = 250`, `BOARD_Y = 0`.
  - `PIECES` (índices 1–8, mismas matrices), `PIECE_COUNT = 8`.
  - `LINE_SCORES = [0, 100, 300, 500, 800] as const`, `SOFT_DROP_POINTS = 1`, `HARD_DROP_POINTS = 2`.
  - `KICKS = [0, -1, 1, -2, 2] as const`, `GHOST_ALPHA = 0.2`.
  - `LINES_PER_LEVEL = 10`, `levelForLines = (lines) => Math.floor(lines / 10) + 1`.
  - `dropIntervalFor = (level) => Math.max(100, 1000 - (level - 1) * 90)` (ms; el motor lo compara con un acumulador en segundos × 1000).
  - `SCORE_CAP = 9_999_999`, igual que `SCORE_MAX` de `lib/scores.ts`. Se duplica porque `lib/scores.ts` es `server-only`.
  - `PALETTE` con los hex de `app/globals.css` (`bg #000000`, `ink #e6e9ff`, `inkDim #8a8fb5`, `inkFaint #4a4f70`, `cyan #00f5ff`, `magenta #ff006e`, `yellow #f5ff00`, `green #00ff88`) más `orange #ff7700` y `violet #aa00ff`.
  - `PIECE_COLORS`: índice 1–8 → color de `PALETTE`, uno distinto por pieza de I a L. La tuerca usa `inkDim`. La asignación concreta se decide con `/frontend-design`.
- Sin `entities.ts`: el juego es una matriz.
  - Tablero: `number[][]` de `ROWS × COLS`, `0` vacía, `1–8` índice de pieza.
  - Pieza: `{ type: number; shape: number[][]; x: number; y: number }`.
  - Todo vive en el closure de `createCaidaGame`: `board`, `current`, `next`, `score`, `lines`, `level`, `dropAccum`, `phase`, `paused`.
- Contrato extendido (`lib/games/types.ts`):

```ts
export interface GameSnapshot {
  phase: GamePhase;
  paused: boolean;
  score: number;
  lives: number | null;
  level: number;
  /** Stats propias del juego para el HUD React, por clave de `RealGameDef.hudExtras`. */
  extra?: Record<string, number>;
}

export interface GameHudExtra {
  key: string;   // "lines"
  label: string; // "Líneas"
}

export interface RealGameDef {
  // …campos actuales sin cambios…
  hudExtras?: GameHudExtra[];
}
```

- Snapshot de CAÍDA: `{ phase, paused, score, lives: null, level, extra: { lines } }`. `onChange` también se emite cuando cambia algún valor de `extra`. Nunca se emite por frame.
- `caidaDef`:
  - `id: "caida"`, `create: createCaidaGame`, `world: { width: 800, height: 600 }`.
  - `initialSnapshot: { phase: "ready", paused: false, score: 0, lives: null, level: 1, extra: { lines: 0 } }`.
  - `startTitle: "CAÍDA"`.
  - `controls: [{ keys: ["←", "→"], label: "mover" }, { keys: ["↑", "X"], label: "rotar" }, { keys: ["↓"], label: "bajar" }, { keys: ["ESPACIO"], label: "caída" }, { keys: ["P"], label: "pausa" }]`.
  - `pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR"`.
  - `hudExtras: [{ key: "lines", label: "Líneas" }]`.
- Base de datos: sin cambios.

---

## Estructura de archivos

```
lib/games/caida/
  constants.ts      (nuevo: constantes del template, PALETTE, PIECE_COLORS)
  engine.ts         (nuevo: createCaidaGame: CreateEngine)
  index.ts          (nuevo: caidaDef: RealGameDef)
lib/games/types.ts        (modificar: GameSnapshot.extra, GameHudExtra, RealGameDef.hudExtras)
lib/games/registry.ts     (modificar: añadir caidaDef)
components/game-player.tsx  (modificar: PlayerHud pinta los hudExtras)
app/globals.css           (modificar: color de .hud-stat.extra .v)
.claude/skills/nuevo-juego/reference/integration.md  (modificar: documentar extra / hudExtras)
```

---

## Plan de implementación

1. Extender `lib/games/types.ts` con `extra`, `GameHudExtra` y `hudExtras`. Hacer que `PlayerHud` reciba `extras: { label: string; value: number }[]` y pinte un `.hud-stat.extra` por cada uno tras `Nivel`. `RealGamePlayer` lo arma con `def.hudExtras` y `snapshot.extra`; la simulación pasa `[]`. Añadir el color de `.hud-stat.extra .v` en `app/globals.css`. Verificar: `npx tsc --noEmit` pasa y `/juegos/asteroides/jugar` muestra el mismo HUD que antes.
2. Crear `lib/games/caida/constants.ts` con todas las constantes del modelo de datos. Verificar: `npx tsc --noEmit`.
3. Crear `lib/games/caida/engine.ts` con la lógica del tablero (`collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `spawn`), la puntuación con `SCORE_CAP`, el nivel y el `dropInterval`. Las fases son `ready → playing → gameover` y `dead` no se usa. Incluir el loop con `dt` limitado a `MAX_DT` y la pausa con `lastTime = null` al reanudar. `onChange` se emite solo ante cambios, incluido `extra.lines`. Verificar: `npx tsc --noEmit`.
4. Añadir el input en `engine.ts`: `keydown` / `keyup` / `blur` en `window` y `visibilitychange` en `document`, todos quitados en `destroy()`. Las teclas se tratan así:
   - `←` `→` mueven y `↓` hace soft drop, con la repetición del sistema operativo.
   - `↑` `X` rotan y Espacio hace hard drop, ignorando `e.repeat`.
   - Espacio en `ready` solo inicia la partida, sin hard drop en esa pulsación.
   - `P` y `Escape` alternan pausa.
   - `preventDefault` en flechas y Espacio.
   - Se ignoran eventos con el foco en campos o botones.
   - `setInputEnabled(false)` corta el input.
   Verificar: `npx tsc --noEmit`.
5. Dibujar en `engine.ts` el mundo 800×600: paneles, tablero con grilla, piezas fijadas, fantasma, pieza actual, `SIGUIENTE`, HUD de canvas y pantalla `GAME OVER` con `PUNTAJE: N`. Fuentes con `getComputedStyle(document.documentElement)` (`--pixel`, `--mono`). Verificar: `npx tsc --noEmit`.
6. Crear `lib/games/caida/index.ts` con `caidaDef` y registrarlo en `lib/games/registry.ts`. Verificar: `/juegos/caida/jugar` muestra la pantalla de inicio de CAÍDA y se juega.
7. Aplicar el estilo neón con `/frontend-design`: colores de `PIECE_COLORS`, glow con `shadowBlur` solo en la pieza actual y en `GAME OVER`, y bloques fijados con relleno y trazo sin glow.
8. Probar GAME OVER → modal → guardar con sesión → el jugador aparece en `/salon` (pestaña CAÍDA) y en `/juegos/caida`.
9. Documentar en `.claude/skills/nuevo-juego/reference/integration.md` los campos `extra` y `hudExtras` (contrato del motor, `RealGameDef` y regla 4 de `onChange`).
10. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

**Comunes:**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [x] `/juegos/caida` y `/juegos/caida/jugar` responden 200 y muestran el título CAÍDA.
- [x] `lib/games/registry.ts` contiene `caida` y su motor implementa `GameEngine` sin estado de módulo.
- [x] Al entrar a `/juegos/caida/jugar` se ve la pantalla de inicio con los controles y `PULSA ESPACIO PARA EMPEZAR`; la partida no empieza hasta pulsar Espacio o hacer click.
- [x] La puntuación, las vidas y el nivel del HUD del canvas y del HUD React coinciden en todo momento.
- [x] `PAUSA`, `P` y `Escape` congelan el juego y muestran `EN PAUSA`; `REANUDAR`, `P` o `Escape` lo reanudan sin salto de posiciones.
- [x] Cambiar de pestaña o de ventana pausa el juego automáticamente.
- [x] Al terminar la partida el canvas muestra el fin de partida con el puntaje y se abre el modal `FIN DEL JUEGO` con la misma puntuación.
- [x] `FIN` abre el modal con la misma puntuación que muestran los HUD.
- [x] `JUGAR DE NUEVO` cierra el modal y empieza una partida nueva con el estado inicial en ambos HUD.
- [x] Con el modal abierto, el teclado no mueve ni acciona nada en el juego.
- [x] Con sesión, `GUARDAR PUNTUACIÓN` guarda la partida, muestra `▸ PUNTUACIÓN GUARDADA · PUESTO #N_` y el jugador aparece en `/salon` (pestaña CAÍDA) y en `/juegos/caida`.
- [x] Sin sesión, el modal muestra `INICIA SESIÓN PARA GUARDAR`.
- [x] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [x] Navegar a otra página y volver a `/juegos/caida/jugar` (varias veces) no duplica velocidad, input ni listeners.
- [x] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene su proporción al redimensionar la ventana.
- [x] El canvas usa la paleta neón del Vault.
- [x] En un dispositivo táctil sin puntero fino, la pantalla de inicio muestra `REQUIERE TECLADO`.
- [x] ASTEROIDES y los juegos simulados siguen funcionando igual.
- [x] No hay errores en la consola del navegador durante una partida completa.

**Específicos de CAÍDA:**

- [x] El HUD React muestra `Jugador`, `Puntuación`, `Vidas` con `—`, `Nivel` y `Líneas`, en ese orden.
- [x] `Líneas` del HUD React coincide en todo momento con `LÍNEAS` del HUD del canvas.
- [x] El HUD React de ASTEROIDES no muestra `Líneas` ni ninguna casilla nueva.
- [x] El canvas muestra el tablero 10×20 centrado, `PUNTOS` / `LÍNEAS` / `NIVEL` a la izquierda y `SIGUIENTE` y los controles a la derecha.
- [x] En fase `ready` el tablero se ve vacío, sin pieza ni valores.
- [x] Pulsar Espacio en `ready` inicia la partida sin hacer hard drop de la primera pieza.
- [x] Aparecen las 8 piezas, incluida la tuerca 3×3 con hueco central.
- [x] `SIGUIENTE` muestra la pieza que aparece después de fijar la actual.
- [x] `←` y `→` mueven la pieza una columna y no atraviesan paredes ni bloques.
- [x] `↑` y `X` rotan en sentido horario; junto a una pared la pieza se desplaza hasta 2 columnas para poder rotar.
- [x] Mantener `↑` o Espacio pulsado no encadena rotaciones ni hard drops.
- [x] La pieza fantasma se ve semitransparente en la fila donde aterrizaría la pieza actual.
- [x] Limpiar 1, 2, 3 o 4 líneas a la vez en nivel 1 suma 100, 300, 500 u 800 puntos respectivamente.
- [x] Limpiar 1 línea en nivel 3 suma 300 puntos.
- [x] Cada pulsación de `↓` que baja la pieza una fila suma 1 punto.
- [x] Un hard drop que recorre 15 filas suma 30 puntos y fija la pieza.
- [x] Al llegar a 10 líneas el nivel pasa a 02 en ambos HUD, y a 03 a las 20 líneas.
- [x] La caída automática tarda 1000 ms por fila en nivel 1, 910 ms en nivel 2 y nunca baja de 100 ms.
- [x] Cuando una pieza nueva no cabe al aparecer, el canvas muestra `GAME OVER` y `PUNTAJE: N` y se abre el modal.
- [x] La puntuación no supera 9.999.999 aunque se sigan limpiando líneas.
- [x] Al reanudar tras una pausa larga, la pieza no baja varias filas de golpe.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Reutilizar la fila `caida` sin cambios | Migración `update` del `long` / fila nueva | Decisión del usuario. El `long` ya describe el juego; conserva portada, posición y puntuaciones, y no hay migración. |
| Título `CAÍDA` | Renombrar al nombre del template | El catálogo del Vault ya usa CAÍDA. |
| 8 piezas literales, incluida la tuerca | Quitar la tuerca / bolsa de 7 u 8 | Decisión del usuario: portar el template tal cual. |
| Puntuación idéntica al template | Ajustar valores | Decisión del usuario, como en SPEC 05. |
| Mundo 800×600 con tablero centrado y dos paneles en canvas | Letterbox de 300×600 / tablero a la izquierda | Decisión del usuario. Llena el CRT 4:3 y conserva el `BLOCK` de 30 px. |
| Mostrar `Líneas` en el HUD React | Solo en el canvas | Decisión del usuario. |
| Stats extra genéricos (`extra` + `hudExtras`) | Campo `lines` en `GameSnapshot` | Decisión del usuario. No acopla el contrato a un juego y sirve a juegos futuros. |
| Mantener `Vidas —` con `lives: null` | Ocultar la casilla | Decisión del usuario. Sigue el contrato sin tocar el render de vidas. |
| `PALETTE` + naranja y violeta de `cover-tetro`; tuerca en `inkDim` | Solo 4 neones repetidos / hex del template | Decisión del usuario. Distingue las piezas sin salirse de la estética del sitio. |
| Tope de puntuación `SCORE_CAP = 9_999_999` en el motor | Sin tope | Decisión del usuario. Toda partida se puede guardar con `saveScore`. |
| `SCORE_CAP` duplicado en `constants.ts` | Importar `SCORE_MAX` | `lib/scores.ts` es `server-only` y no se puede importar desde el motor. |
| Repetición del sistema operativo para mover y bajar | DAS/ARR propio | Comportamiento literal del template. |
| Rotación y hard drop ignoran `e.repeat` | Repetir como el template | Evita encadenar hard drops al mantener Espacio. Es la única desviación de control respecto al template. |
| Espacio en `ready` solo inicia | Iniciar y hacer hard drop | El contrato reserva Espacio para iniciar desde `ready`. |
| `ready` muestra el tablero vacío | Escena animada de piezas cayendo | Basta para dar contexto y no compite con la pantalla de inicio de `GameScreen`. |
| Sin `entities.ts` | Clases por pieza | El juego es una matriz; las funciones del template bastan. |
| Descartar tema claro/oscuro, `localStorage`, HUD y overlays DOM | Portarlos | El Vault es oscuro, el leaderboard es Supabase, y los HUD y el modal ya cubren esos estados. |
| Glow solo en la pieza actual y en `GAME OVER` | Glow en todos los bloques | Rendimiento: hasta 200 celdas fijadas por frame. |
| (Implementación) Pieza J en `ink` | Añadir un séptimo neón | Hay 7 piezas de I a L y 6 neones; `ink` ya está en `PALETTE` y se distingue de los demás. |
| (Implementación) Sin listener `keyup` | Registrarlo como ASTEROIDES | El motor actúa en cada `keydown` y no guarda teclas pulsadas, así que no hay nada que soltar. |
| (Implementación) Comparación del snapshot con `sameSnapshot` en `lib/games/types.ts` | Comparar a mano en cada motor | Incluye los valores de `extra` y la pueden reutilizar los próximos juegos. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| StrictMode monta el efecto dos veces y crea dos motores. | `GameScreen` llama a `destroy()` en el cleanup; `destroy()` cancela rAF y quita todos los listeners. |
| El registro genérico (`lib/games/registry.ts`, `types.ts`, `components/game-screen.tsx`) aún no está commiteado en `main`. | Commitear esos cambios antes de ejecutar `/spec-impl 07-juego-caida`. |
| El cambio de contrato rompe ASTEROIDES o la simulación. | Los campos nuevos son opcionales. El paso 1 verifica `/juegos/asteroides/jugar` antes de crear el motor. Hay un criterio de que ASTEROIDES no muestra `Líneas`. |
| `onChange` deja de emitir al cambiar solo `extra.lines`. | La comparación del snapshot incluye cada valor de `extra`. Hay un criterio de coincidencia de líneas en ambos HUD. |
| Espacio en `ready` hace también hard drop de la primera pieza. | `start()` consume la pulsación. Hay un criterio específico. |
| El `dt` acumulado tras una pausa hace caer varias filas de golpe. | `lastTime = null` al reanudar y `dt` limitado a `MAX_DT = 0.05`. |
| `shadowBlur` en las 200 celdas baja los fps. | Glow solo en la pieza actual y en `GAME OVER`. Los bloques fijados usan relleno y trazo. |
| El tablero ocupa los 600 px de alto y queda pegado al borde del CRT. | Se acepta para conservar `BLOCK = 30`. Si molesta, se ajusta con `/frontend-design` en el paso 7 sin cambiar la lógica. |
| El catálogo cacheado (`cacheLife("days")`) no refleja cambios. | No aplica: la fila `caida` no cambia. |

---

## Lo que **no** entra en esta spec

- Tema claro/oscuro y `localStorage` del template.
- HUD, overlays y botón `Reiniciar` en el DOM del template.
- Sonido y música.
- Bolsa de piezas, hold, T-spins, combos y back-to-back.
- DAS/ARR propio.
- Selección de nivel inicial.
- Cambios en el `title`, el `long` o la portada de `caida`.
- Controles táctiles.
- Anti-trampas.
- Tests.

Cada uno de estos, si llega, va en su propia spec.
