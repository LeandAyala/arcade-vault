# SPEC 08 — Juego BLOQUE BUSTER jugable en el reproductor

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-16
> **Objective:** Portar a TypeScript el juego de `references/resources/templates/started-games/04-arkanoid` y montarlo en `/juegos/bloque-buster/jugar` como juego real del registro, con su sistema de puntos, vidas y niveles reflejados en ambos HUD y guardable en el leaderboard.

---

## Por qué existe esta spec

Hoy `/juegos/bloque-buster/jugar` usa la simulación de SPEC 01: la puntuación sube sola y no hay juego real. El template `04-arkanoid` (`game.js`, 268 líneas, y `levels.js`) guarda todo el estado en variables globales. Registra `keydown`/`keyup` en `document` y `click`/`mousemove` en el canvas sin quitarlos nunca. Su `requestAnimationFrame` no se cancela. Depende de un spritesheet y de dos mp3, y dibuja un menú de selección de nivel dentro de la pausa.

El mundo del template ya es 800×600 (4:3), así que encaja en el CRT sin rediseño. Esta spec lo convierte en un motor con el contrato de `lib/games/types.ts`. Es el tercer juego real del Vault.

---

## Scope

**In:**

- Catálogo: reutiliza la fila `bloque-buster` de `public.games` sin cambios (`title` `BLOQUE BUSTER`, `cat` `ARCADE`, `cover` `cover-bricks`, `color` `cyan`, `sort_order` `1`). Sin migración.
- Motor TypeScript strict en `lib/games/bloque-buster/engine.ts` que implementa `GameEngine`, sin estado de módulo, con la jugabilidad del template:
  - Pala de `81 × 14` px en `y = 560`, centrada al empezar. Se mueve a `400` px/s con `←` `→` y sigue al ratón sobre el canvas. Nunca sale del mundo.
  - Pelota de `16 × 16` px. Velocidad de saque `vx = 200 × speed`, `vy = −300 × speed` (px/s), con `speed` el multiplicador del nivel.
  - Rebote en las paredes izquierda, derecha y superior. Si la pelota pasa `y > 600`, se pierde.
  - **Rebote en la pala (cambio respecto al template):** el ángulo depende del punto de impacto. `t = (centro de la pelota − centro de la pala) / (81 / 2)`, limitado a `[−1, 1]`. Ángulo desde la vertical = `t × 60°`. La rapidez es `BASE_BALL_SPEED × speed`, con `BASE_BALL_SPEED = √(200² + 300²) ≈ 360,56` px/s. La pelota siempre sale hacia arriba.
  - Ventana de colisión con la pala literal del template: `vy > 0`, solapamiento horizontal, y el borde inferior de la pelota entre `560` y `560 + 14 + 8`.
  - **Rebote en bloques (cambio respecto al template):** se resuelve por el eje de menor penetración. Un golpe lateral invierte `vx` y un golpe arriba/abajo invierte `vy`. Como en el template, se rompe como máximo un bloque por paso de física.
  - 5 niveles con los mismos patrones y colores de `levels.js`. Rejilla de `10 × 6` celdas de `64 × 24` px con origen en `x = 80`, `y = 80`:
    1. Parrilla completa (60 bloques), `speed 1.00`.
    2. Pirámide centrada (40 bloques), `speed 1.10`.
    3. Tablero de ajedrez (30 bloques), `speed 1.21`.
    4. Filas con huecos (39 bloques), `speed 1.33`.
    5. Marco + cruz central (39 bloques), `speed 1.46`.
  - **Sistema de puntos:** `+10` por bloque destruido (`POINTS_PER_BLOCK = 10`). Sin multiplicadores ni bonus. El máximo de una partida es `208 × 10 = 2.080`, muy por debajo de `9_999_999`, así que no hace falta tope.
  - **Vidas:** 3. Al perder la pelota se resta una vida. Si quedan vidas, el motor pasa a `phase: "dead"` durante `SERVE_DELAY = 1` s. La pelota espera sobre el centro de la pala, que se puede mover. Al acabar el tiempo, vuelve a `playing` y la pelota sale con la velocidad de saque.
  - **Saque:** al empezar (`start()` / `restart()`) y al pasar de nivel, la pelota también espera `SERVE_DELAY = 1` s sobre la pala y luego sale sola, sin cambiar de fase (`playing`). No hay tecla de saque.
  - **Nivel:** al destruir el último bloque se carga el siguiente nivel. Puntuación y vidas se conservan, la pala no se mueve y la pelota vuelve al saque.
  - **Fin:** con 0 vidas → `phase: "gameover"` y el canvas dibuja `GAME OVER`. Al vaciar el nivel 5 → `phase: "gameover"` y el canvas dibuja `¡VICTORIA!`.
  - Explosión vectorial de `150` ms al destruir un bloque, en el color del bloque (destello que se expande y se desvanece).
- Definición `bloqueBusterDef` en `lib/games/bloque-buster/index.ts` y entrada en `lib/games/registry.ts`.
- Mundo lógico 800×600 (4:3), nítido según `devicePixelRatio`, sin letterbox.
- Dos HUD:
  - HUD de canvas en la franja superior (`y < 80`, encima de los bloques): `PUNTOS` a la izquierda (con `formatScore`), `NIVEL` al centro y las vidas a la derecha como pelotas pequeñas.
  - HUD React `.player-hud`: `Jugador`, `Puntuación`, `Vidas`, `Nivel`. Sin `hudExtras`.
- En fase `ready` el canvas dibuja los bloques del nivel 1, quietos, sin pala, pelota ni HUD de juego.
- Pantalla de inicio (`GameScreen`) con `startTitle: "BLOQUE BUSTER"` y controles: `←` `→` mover, `RATÓN` mover, `P` pausa.
- Fin de partida: el canvas dibuja `GAME OVER` (`--pixel`, magenta, con glow) o `¡VICTORIA!` (`--pixel`, verde, con glow), y debajo `PUNTAJE: N` en `--mono`, sin instrucción de reinicio. El reproductor abre el modal `FIN DEL JUEGO`. `GUARDAR PUNTUACIÓN` guarda con `saveScore` y el jugador aparece en `/salon` y `/juegos/bloque-buster`.
- Pausa (`PAUSA`, `P`, `Escape`, automática al perder el foco), `FIN`, `JUGAR DE NUEVO` e input bloqueado con el modal abierto (teclado y ratón): como SPEC 05.
- Estilo neón del Vault con `PALETTE` (pala cyan, pelota `ink`, bloques según `BLOCK_COLORS`), diseñado con `/frontend-design`.

**Out of scope (para specs futuras):**

- Spritesheet (`spritesheet-breakout.png`) y `spritesheet.js` del template.
- Sonidos (`ball-bounce.mp3`, `break-sound.mp3`).
- Menú de selección de nivel en la pausa.
- Overlays de pausa, GAME OVER y victoria del template (los sustituyen `EN PAUSA` del reproductor, el fin de partida en canvas y el modal).
- Power-ups, bloques con varios golpes, bloques irrompibles y vidas extra.
- Bonus de puntos por nivel o por vidas restantes.
- Tecla o click de saque.
- Cambiar el `title`, el `long` o la portada de `bloque-buster`.
- Controles táctiles.
- Anti-trampas (validación de partidas en servidor).
- Tests (no hay framework configurado).

---

## Modelo de datos

- Constantes en `lib/games/bloque-buster/constants.ts`:
  - `W = 800`, `H = 600`, `MAX_DT = 0.05`.
  - `PADDLE_W = 81`, `PADDLE_H = 14`, `PADDLE_Y = 560`, `PADDLE_SPEED = 400`, `PADDLE_CATCH_MARGIN = 8`.
  - `BALL_SIZE = 16`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, `BASE_BALL_SPEED = Math.hypot(200, 300)`.
  - `MAX_BOUNCE_ANGLE = Math.PI / 3` (60°).
  - `MAX_STEP = 8`: la física avanza en subpasos de como mucho 8 px de recorrido de la pelota.
  - `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`, `BLOCK_W = 64`, `BLOCK_H = 24`, `BLOCKS_ORIGIN_X = 80`, `BLOCKS_ORIGIN_Y = 80`.
  - `POINTS_PER_BLOCK = 10`, `START_LIVES = 3`, `SERVE_DELAY = 1` (s), `EXPLOSION_DURATION = 0.15` (s).
  - `PALETTE` con los hex de `app/globals.css` (`bg #000000`, `ink #e6e9ff`, `inkDim #8a8fb5`, `inkFaint #4a4f70`, `cyan #00f5ff`, `magenta #ff006e`, `yellow #f5ff00`, `green #00ff88`) más `orange #ffae00` (de `cover-bricks`) y `violet #aa00ff` (de `cover-tetro`).
  - `BLOCK_COLORS: Record<BlockColor, string>` con los 7 colores del template: `gray → inkDim`, `red → orange`, `yellow → yellow`, `cyan → cyan`, `magenta → violet`, `hotpink → magenta`, `green → green`. Se puede ajustar con `/frontend-design` sin repetir un color.
- Niveles en `lib/games/bloque-buster/levels.ts`, portados literalmente de `levels.js`:

```ts
export type BlockColor = "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export interface LevelDef {
  speed: number; // 1.00, 1.10, 1.21, 1.33, 1.46
  blocks: { col: number; row: number; color: BlockColor }[];
}

export const LEVELS: readonly LevelDef[]; // 5 niveles, generados una vez sin estado mutable
```

- Estado en el closure de `createBloqueBusterGame` (sin `entities.ts`, son rectángulos simples):

```ts
paddle: { x: number; y: number; w: number; h: number };
ball: { x: number; y: number; w: number; h: number; vx: number; vy: number };
blocks: { x: number; y: number; w: number; h: number; color: BlockColor; alive: boolean }[];
explosions: { x: number; y: number; w: number; h: number; color: BlockColor; elapsed: number }[];
score: number; lives: number; level: number; // level de 1 a 5
serveTimer: number; // s restantes con la pelota sobre la pala; 0 = en juego
phase: GamePhase; paused: boolean;
keys: { left: boolean; right: boolean };
```

- Snapshot: `{ phase, paused, score, lives, level }`, comparado con `sameSnapshot` de `lib/games/types.ts`. `onChange` nunca se emite por frame.
- `bloqueBusterDef`:
  - `id: "bloque-buster"`, `create: createBloqueBusterGame`, `world: { width: 800, height: 600 }`.
  - `initialSnapshot: { phase: "ready", paused: false, score: 0, lives: 3, level: 1 }`.
  - `startTitle: "BLOQUE BUSTER"`.
  - `controls: [{ keys: ["←", "→", "RATÓN"], label: "mover" }, { keys: ["P"], label: "pausa" }]`.
  - `pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR"`.
- Base de datos: sin cambios.

---

## Estructura de archivos

```
lib/games/bloque-buster/
  constants.ts      (nuevo: constantes, PALETTE, BLOCK_COLORS)
  levels.ts         (nuevo: LEVELS, LevelDef, BlockColor)
  engine.ts         (nuevo: createBloqueBusterGame: CreateEngine)
  index.ts          (nuevo: bloqueBusterDef: RealGameDef)
lib/games/registry.ts   (modificar: añadir bloqueBusterDef)
```

No cambian `lib/games/types.ts`, `components/game-player.tsx`, `components/game-screen.tsx`, `app/globals.css` ni `supabase/migrations/`.

---

## Plan de implementación

1. Crear `lib/games/bloque-buster/constants.ts` y `lib/games/bloque-buster/levels.ts` con todo el modelo de datos. Verificar: `npx tsc --noEmit` y que `LEVELS` tiene 60, 40, 30, 39 y 39 bloques.
2. Crear `lib/games/bloque-buster/engine.ts` con la lógica del juego:
   - Estado en el closure y `resetGame()`, `loadLevel(n)` y `serve()`.
   - Física en subpasos de `MAX_STEP`: paredes, pala con ángulo por impacto y bloques por eje de menor penetración, con un bloque como máximo por subpaso.
   - Puntuación, vidas, cambio de nivel, `serveTimer`, fases `ready → playing ⇄ dead → gameover` y victoria.
   - Loop con `dt` limitado a `MAX_DT` y pausa con `lastTime = null` al reanudar.
   - `onChange` con `sameSnapshot`.
   Verificar: `npx tsc --noEmit`.
3. Añadir el input en `engine.ts`:
   - `keydown` / `keyup` / `blur` en `window`, `visibilitychange` en `document` y `mousemove` en el canvas, todos quitados en `destroy()`.
   - `←` `→` marcan `keys.left` / `keys.right`. `blur` las limpia.
   - El ratón convierte `clientX` a coordenadas del mundo con `getBoundingClientRect()` (`(clientX − rect.left) × W / rect.width`) y centra la pala en ese punto.
   - La pala solo se mueve en `playing` o `dead`, sin pausa y con el input activo.
   - Espacio solo inicia desde `ready`. `P` y `Escape` alternan pausa.
   - `preventDefault` en flechas y Espacio. Se ignoran eventos con el foco en campos o botones.
   - `setInputEnabled(false)` ignora teclado y ratón y limpia `keys`.
   Verificar: `npx tsc --noEmit`.
4. Dibujar en `engine.ts`: bloques, explosiones, pala, pelota, HUD de canvas y pantalla de fin (`GAME OVER` o `¡VICTORIA!` con `PUNTAJE: N`). En `ready` solo los bloques del nivel 1. Fuentes con `getComputedStyle(document.documentElement)` (`--pixel`, `--mono`). Verificar: `npx tsc --noEmit`.
5. Crear `lib/games/bloque-buster/index.ts` con `bloqueBusterDef` y registrarlo en `lib/games/registry.ts`. Verificar: `/juegos/bloque-buster/jugar` muestra la pantalla de inicio de BLOQUE BUSTER y se juega.
6. Aplicar el estilo neón con `/frontend-design`: `BLOCK_COLORS`, glow con `shadowBlur` solo en la pala, la pelota, las explosiones y el texto de fin, y bloques con relleno y trazo sin glow.
7. Probar GAME OVER y `¡VICTORIA!` → modal → guardar con sesión → el jugador aparece en `/salon` (pestaña BLOQUE BUSTER) y en `/juegos/bloque-buster`.
8. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

**Comunes:**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [x] `/juegos/bloque-buster` y `/juegos/bloque-buster/jugar` responden 200 y muestran el título BLOQUE BUSTER.
- [x] `lib/games/registry.ts` contiene `bloque-buster` y su motor implementa `GameEngine` sin estado de módulo.
- [x] Al entrar a `/juegos/bloque-buster/jugar` se ve la pantalla de inicio con los controles y `PULSA ESPACIO PARA EMPEZAR`; la partida no empieza hasta pulsar Espacio o hacer click.
- [x] La puntuación, las vidas y el nivel del HUD del canvas y del HUD React coinciden en todo momento.
- [x] `PAUSA`, `P` y `Escape` congelan el juego y muestran `EN PAUSA`; `REANUDAR`, `P` o `Escape` lo reanudan sin salto de posiciones.
- [x] Cambiar de pestaña o de ventana pausa el juego automáticamente.
- [x] Al terminar la partida el canvas muestra el fin de partida con el puntaje y se abre el modal `FIN DEL JUEGO` con la misma puntuación.
- [x] `FIN` abre el modal con la misma puntuación que muestran los HUD.
- [x] `JUGAR DE NUEVO` cierra el modal y empieza una partida nueva con el estado inicial en ambos HUD.
- [x] Con el modal abierto, el teclado no mueve ni acciona nada en el juego.
- [ ] Con sesión, `GUARDAR PUNTUACIÓN` guarda la partida, muestra `▸ PUNTUACIÓN GUARDADA · PUESTO #N_` y el jugador aparece en `/salon` (pestaña BLOQUE BUSTER) y en `/juegos/bloque-buster`.
- [x] Sin sesión, el modal muestra `INICIA SESIÓN PARA GUARDAR`.
- [x] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [x] Navegar a otra página y volver a `/juegos/bloque-buster/jugar` (varias veces) no duplica velocidad, input ni listeners.
- [x] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene su proporción al redimensionar la ventana.
- [x] El canvas usa la paleta neón del Vault.
- [x] En un dispositivo táctil sin puntero fino, la pantalla de inicio muestra `REQUIERE TECLADO`.
- [x] ASTEROIDES, CAÍDA y los juegos simulados siguen funcionando igual.
- [x] No hay errores en la consola del navegador durante una partida completa.

**Específicos de BLOQUE BUSTER:**

- [x] El HUD React muestra `Jugador`, `Puntuación`, `Vidas`, `Nivel`, sin casillas extra.
- [x] En fase `ready` el canvas muestra los 60 bloques del nivel 1 sin pala, pelota ni HUD de juego.
- [x] Al empezar, la pelota espera 1 s sobre el centro de la pala y luego sale sola hacia arriba a la derecha.
- [x] `←` y `→` mueven la pala y no la sacan del canvas.
- [x] Mover el ratón sobre el canvas centra la pala bajo el cursor, también con la ventana redimensionada.
- [x] Con el juego en pausa o con el modal abierto, ni el teclado ni el ratón mueven la pala.
- [x] La pelota rebota en las paredes izquierda, derecha y superior.
- [x] Golpear con el centro de la pala devuelve la pelota casi vertical; golpear con un borde la devuelve inclinada hacia ese lado, como mucho a 60° de la vertical.
- [x] La rapidez de la pelota no cambia al rebotar en la pala dentro de un mismo nivel.
- [x] Un golpe lateral a un bloque invierte la dirección horizontal de la pelota; un golpe por arriba o por abajo invierte la vertical.
- [x] Cada bloque destruido suma exactamente 10 puntos y muestra una explosión de su color durante 150 ms.
- [x] Nunca se destruyen dos bloques en el mismo paso de física.
- [x] La pelota no atraviesa bloques ni la pala en el nivel 5.
- [x] Los niveles 1 a 5 muestran la parrilla completa, la pirámide, el tablero de ajedrez, las filas con huecos y el marco con cruz, con 60, 40, 30, 39 y 39 bloques.
- [x] Al vaciar un nivel, el nivel sube en ambos HUD, aparece el patrón siguiente, se conservan puntuación y vidas, y la pelota espera 1 s sobre la pala.
- [x] La pelota del nivel 2 va un 10 % más rápida que la del nivel 1, y la del nivel 5 un 46 %.
- [x] Al perder la pelota se resta una vida en ambos HUD, la pelota espera 1 s sobre la pala y la pala se puede mover durante la espera.
- [x] Al perder la tercera vida, el canvas muestra `GAME OVER` y `PUNTAJE: N` y se abre el modal.
- [x] Al vaciar el nivel 5, el canvas muestra `¡VICTORIA!` y `PUNTAJE: 2080` y se abre el modal (`formatScore` con `es-ES` no agrupa números de 4 cifras).
- [x] Al reanudar tras una pausa larga, la pelota no salta de posición.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Reutilizar la fila `bloque-buster` sin cambios | Migración `update` del `long` / fila nueva `arkanoid` | Decisión del usuario. Conserva portada, posición 1 y puntuaciones, y no hay migración. |
| Título `BLOQUE BUSTER` | Renombrar a Arkanoid | El catálogo del Vault ya usa BLOQUE BUSTER y no se copian nombres de juegos existentes. |
| Puntuación literal: `+10` por bloque | `+10 × nivel` / bonus por vidas al ganar | Decisión del usuario, como en SPEC 05 y SPEC 07. |
| Sin tope de puntuación en el motor | `SCORE_CAP = 9_999_999` como en CAÍDA | El máximo posible es 2.080. Un tope sería código muerto. |
| Ángulo de rebote por punto de impacto, hasta 60° | Literal: solo invertir `vy` | Decisión del usuario. Da control al jugador y evita trayectorias que se repiten sin fin. |
| Rebote en bloques por eje de menor penetración | Literal: siempre invertir `vy` | Decisión del usuario. Un golpe lateral que invierte `vy` se ve como un error. |
| Un bloque por paso de física | Romper todos los solapados | Literal del template; evita dobles rebotes que se anulan. |
| Pala de 81 px | 162 px del sprite | Decisión del usuario. Es el valor que usa `game.js`. |
| Espera de 1 s antes de cada saque (`dead` al perder vida, `serveTimer` en `playing` al empezar y al subir de nivel) | Literal: relanzar al instante / tecla de saque | Decisión del usuario. Da tiempo a reaccionar sin añadir controles. La fase `dead` solo se usa al perder vida, como pide el contrato. |
| Velocidad de saque literal (`200`, `−300`) × `speed` | Saque vertical | Conserva la trayectoria inicial del template. |
| Física en subpasos de 8 px | Un paso por frame como el template | A `speed 1.46` y `dt = 0.05` la pelota recorre unos 26 px, más que su tamaño, y atravesaría bloques. |
| Dibujo vectorial neón con explosión de 150 ms | Portar spritesheet y mp3 / sin explosión | Decisión del usuario. Encaja con la estética del Vault y evita cargar assets y gestionarlos en `destroy()`. |
| `BLOCK_COLORS` con `PALETTE` + naranja de `cover-bricks` y violeta de `cover-tetro` | Hex del spritesheet / solo 4 neones | Distingue los 7 colores del template sin salirse de la estética del sitio. Se puede ajustar con `/frontend-design`. |
| `¡VICTORIA!` en verde al ganar | `¡COMPLETASTE EL JUEGO!` / `GAME OVER` | Decisión del usuario. Distingue la victoria de la derrota; el modal es el mismo. |
| `ready` muestra los bloques del nivel 1 | Escena vacía | Da contexto bajo la pantalla de inicio de `GameScreen` sin mostrar jugador ni HUD. |
| Descartar el menú de niveles de la pausa | Portarlo | Permitiría saltar niveles y falsear el leaderboard. La pausa la gestiona el reproductor. |
| Sin `entities.ts` | Clases `Paddle`, `Ball`, `Block` | Son rectángulos simples; un archivo de niveles separado aporta más que clases. |
| Ratón con `mousemove` en el canvas | `pointermove` en `window` | Literal del template y del contrato. La pala no se mueve con el cursor fuera del juego. |
| Glow solo en pala, pelota, explosiones y texto de fin | Glow en todos los bloques | Rendimiento: hasta 60 bloques por frame. |
| (Implementación) Un solo control `← → RATÓN · mover` | Dos controles con la etiqueta `mover` | `GameScreen` usa `label` como `key` de React; dos etiquetas iguales daban un error de keys duplicadas en consola. Así no se toca `GameScreen`. |
| (Implementación) Estela de 6 posiciones en la pelota y pulso durante el saque | Pelota sin efectos | Decisión de `/frontend-design`: la pelota es el único elemento con énfasis visual, y el pulso anuncia que va a salir sin añadir texto. |
| (Implementación) Franja del HUD de canvas separada por una línea `inkFaint` en `y = 64` | HUD flotando sobre el juego | Separa el HUD de los bloques (que empiezan en `y = 80`) igual que el marco del pozo en CAÍDA. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| StrictMode monta el efecto dos veces y crea dos motores. | `GameScreen` llama a `destroy()` en el cleanup; `destroy()` cancela rAF y quita todos los listeners, también `mousemove`. |
| La pelota atraviesa bloques o la pala a velocidades altas. | Subpasos de `MAX_STEP = 8` px y `dt` limitado a `MAX_DT`. Hay un criterio específico para el nivel 5. |
| La pelota queda atrapada entre dos bloques y rebota dentro de ellos. | Un bloque por subpaso y, tras un rebote, la pelota se recoloca fuera del bloque por el eje resuelto. |
| Un ángulo casi horizontal deja la pelota rebotando entre paredes mucho tiempo. | El ángulo máximo es 60° desde la vertical, así que la pelota siempre tiene componente vertical. |
| La posición del ratón no coincide con la pala si el canvas está escalado. | Conversión con `getBoundingClientRect()` y `W / rect.width` en cada evento. Hay un criterio con la ventana redimensionada. |
| El ratón mueve la pala con el modal abierto o en pausa. | `mousemove` respeta `inputEnabled`, `paused` y la fase. Hay un criterio específico. |
| El `dt` acumulado tras una pausa hace saltar la pelota. | `lastTime = null` al reanudar y `dt` limitado a `MAX_DT = 0.05`. |
| El catálogo cacheado (`cacheLife("days")`) no refleja cambios. | No aplica: la fila `bloque-buster` no cambia. |

---

## Lo que **no** entra en esta spec

- Spritesheet y sonidos del template.
- Menú de selección de nivel en la pausa.
- Overlays del template.
- Power-ups, bloques con varios golpes, bloques irrompibles y vidas extra.
- Bonus de puntos.
- Tecla o click de saque.
- Cambios en el `title`, el `long` o la portada de `bloque-buster`.
- Controles táctiles.
- Anti-trampas.
- Tests.

Cada uno de estos, si llega, va en su propia spec.
