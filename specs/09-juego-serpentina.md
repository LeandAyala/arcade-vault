# SPEC 09 — Juego SERPENTINA jugable en el reproductor

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-18
> **Objective:** Crear el juego SERPENTINA (snake en rejilla con frutas neón) y montarlo en `/juegos/serpentina/jugar` como juego real del registro, con su sistema de puntos, nivel y longitud reflejados en ambos HUD y guardable en el leaderboard.

---

## Por qué existe esta spec

Hoy `/juegos/serpentina/jugar` usa la simulación de SPEC 01: la puntuación sube sola y no hay juego real. No hay template jugable de snake en `references/resources/templates/started-games/`. La única referencia es `references/resources/templates/source-assets/snake-assets/`, que contiene `fruits.png` (hoja de 3790×442 px) y `sprites.js` (atlas de coordenadas).

Esos sprites salen del Google Snake Game (lo indica la cabecera de `sprites.js`). Son arte de terceros, así que el Vault no los usa. Además, las coordenadas del atlas no coinciden con la imagen: en `x = 34` hay una manzana, no la banana que indica el atlas. De la carpeta solo se toma la idea de varias frutas con aspecto distinto. Las frutas se dibujan en canvas con estilo neón propio.

Por eso es un juego nuevo, no un port. Esta spec define su mecánica completa y la monta con el contrato de `lib/games/types.ts`. Es el cuarto juego real del Vault. Usa las stats extra de SPEC 07 para mostrar `Longitud` en el HUD React.

---

## Scope

**In:**

- Catálogo: reutiliza la fila `serpentina` de `public.games` sin cambios (`title` `SERPENTINA`, `cat` `ARCADE`, `cover` `cover-snake`, `color` `green`, `sort_order` `3`). Sin migración.
- Motor TypeScript strict en `lib/games/serpentina/engine.ts` que implementa `GameEngine`, sin estado de módulo, con esta jugabilidad:
  - Rejilla de `32 × 22` celdas de `25` px. El tablero ocupa `x` 0–800 e `y` 50–600. La franja `y` 0–50 es el HUD de canvas.
  - La serpiente empieza con longitud `3`: cabeza en la celda `(16, 11)` y cuerpo en `(15, 11)` y `(14, 11)`. Avanza hacia la derecha desde el primer tick, sin esperar ninguna tecla.
  - Movimiento por ticks de celda. Duración del tick: `max(0.06, 0.15 − (nivel − 1) × 0.01)` s, es decir 150 ms en el nivel 1, 10 ms menos por nivel y un mínimo de 60 ms desde el nivel 10. El tiempo se acumula con `dt` y se ejecutan tantos ticks como quepan.
  - **Giros:** flechas y `W` `A` `S` `D`. Cola de giros de 2 como máximo: cada tick consume uno. Se descarta un giro opuesto a la última dirección encolada (o a la actual si la cola está vacía), un giro igual a esa dirección y cualquier giro con la cola llena.
  - **Crecimiento:** cada fruta comida alarga la serpiente `1` celda. La cola no avanza en el tick siguiente.
  - **Colisión:** si la cabeza sale del tablero o entra en una celda del cuerpo → fin de partida. La celda que la cola deja libre en ese mismo tick no cuenta como cuerpo, salvo que la serpiente esté creciendo.
  - **Frutas:**
    - Siempre hay una fruta normal en una celda libre al azar (sin serpiente y sin otra fruta). Se sortea con pesos: manzana `60 %`, cereza `25 %`, limón `15 %`.
    - Cada vez que el total de frutas comidas llega a un múltiplo de `5`, aparece una uva en otra celda libre si no hay ya una. La uva dura `6` s de juego (el temporizador se congela en pausa) y parpadea durante sus últimos `2` s. Si caduca, desaparece sin penalización.
    - Al comer la fruta normal aparece otra al instante. Al comer la uva no aparece otra hasta el siguiente múltiplo de 5.
  - **Sistema de puntos:** valor de la fruta × nivel actual. El nivel es el de **antes** de recalcularlo con la fruta recién comida.
    - Manzana `10`, cereza `20`, limón `30`, uva `50` (`FRUITS[tipo].points`).
    - Ejemplo: comer un limón en el nivel 3 suma `90`.
    - Sin otros bonus. Cota del máximo teórico: 701 frutas × 50 × nivel 141 ≈ `4.942.050`, por debajo de `9_999_999`, así que no hace falta tope.
  - **Nivel:** `floor(frutas comidas / 5) + 1`. Cuentan todas las frutas, también la uva.
  - Sin vidas: `lives: null`. No se usa la fase `dead`.
  - **Fin:**
    - Chocar con un borde o con el propio cuerpo → `phase: "gameover"` y el canvas dibuja `GAME OVER`.
    - Si tras comer no queda ninguna celda libre para la fruta normal → `phase: "gameover"` y el canvas dibuja `¡VICTORIA!`.
- Stat extra `length` (longitud de la serpiente) en `snapshot.extra`, declarada en `hudExtras` con la etiqueta `Longitud`.
- Definición `serpentinaDef` en `lib/games/serpentina/index.ts` y entrada en `lib/games/registry.ts`.
- Mundo lógico 800×600 (4:3), nítido según `devicePixelRatio`, sin letterbox.
- Dos HUD:
  - HUD de canvas en la franja `y` 0–50, separada del tablero por una línea `inkFaint`: `PUNTOS` a la izquierda (con `formatScore`), `NIVEL` al centro y `LONGITUD` a la derecha.
  - HUD React `.player-hud`: `Jugador`, `Puntuación`, `Vidas` (`—`), `Nivel`, `Longitud`.
- Fase `ready`: el canvas dibuja la rejilla y una serpiente demo de longitud `8` que recorre en bucle un circuito rectangular fijo a 150 ms por celda. No hay frutas, HUD de juego ni puntuación. La demo no usa `Math.random()` y no afecta al snapshot.
- Pantalla de inicio (`GameScreen`) con `startTitle: "SERPENTINA"` y controles: `←` `↑` `→` `↓` `WASD` girar, `P` pausa.
- Fin de partida: el canvas dibuja `GAME OVER` (`--pixel`, magenta, con glow) o `¡VICTORIA!` (`--pixel`, verde, con glow), y debajo `PUNTAJE: N` en `--mono`, sin instrucción de reinicio. La serpiente queda dibujada donde murió, atenuada. El reproductor abre el modal `FIN DEL JUEGO`. `GUARDAR PUNTUACIÓN` guarda con `saveScore` y el jugador aparece en `/salon` y `/juegos/serpentina`.
- Pausa (`PAUSA`, `P`, `Escape`, automática al perder el foco), `FIN`, `JUGAR DE NUEVO` e input bloqueado con el modal abierto: como SPEC 05.
- Estilo neón del Vault con `PALETTE`, diseñado con `/frontend-design`:
  - Serpiente `green`, con la cabeza más brillante y con ojos.
  - Manzana `magenta`, cereza `orange`, limón `yellow`, uva `violet`.
  - Cada fruta tiene una silueta vectorial propia: manzana redonda con hoja, dos cerezas con rabito, limón ovalado, racimo de uvas.

**Out of scope (para specs futuras):**

- Usar `fruits.png` o `sprites.js` (arte de terceros) o cualquier spritesheet.
- Copiar la carpeta `snake-assets` a `public/`.
- Sonido.
- Vidas, obstáculos, paredes interiores, portales y modo wrap (atravesar bordes).
- Frutas con efectos especiales (encoger, ralentizar, invencibilidad).
- Más de una fruta normal a la vez.
- Cambiar el `title`, el `long` o la portada de `serpentina`.
- Controles táctiles y swipe.
- Anti-trampas (validación de partidas en servidor).
- Tests (no hay framework configurado).

---

## Modelo de datos

- Constantes en `lib/games/serpentina/constants.ts`:
  - `W = 800`, `H = 600`, `MAX_DT = 0.05`.
  - `CELL = 25`, `COLS = 32`, `ROWS = 22`, `BOARD_Y = 50` (el tablero va de `y = 50` a `y = 600`).
  - `START_LENGTH = 3`, `START_HEAD = { x: 16, y: 11 }`, `START_DIR: Dir = "right"`.
  - `STEP_BASE = 0.15`, `STEP_DEC = 0.01`, `STEP_MIN = 0.06` (s).
  - `FRUITS_PER_LEVEL = 5`, `GRAPE_EVERY = 5`, `GRAPE_TTL = 6`, `GRAPE_BLINK = 2` (s).
  - `TURN_QUEUE_MAX = 2`.
  - `DEMO_LENGTH = 8`, `DEMO_STEP = 0.15` (s).
  - `PALETTE` con los hex de `app/globals.css` (`bg #000000`, `ink #e6e9ff`, `inkDim #8a8fb5`, `inkFaint #4a4f70`, `cyan #00f5ff`, `magenta #ff006e`, `yellow #f5ff00`, `green #00ff88`) más `orange #ffae00` y `violet #aa00ff` (los mismos que SPEC 08).
  - Frutas:

```ts
export type FruitKind = "apple" | "cherry" | "lemon" | "grape";

export const FRUITS: Record<FruitKind, { points: number; weight: number; color: string }> = {
  apple: { points: 10, weight: 60, color: PALETTE.magenta },
  cherry: { points: 20, weight: 25, color: PALETTE.orange },
  lemon: { points: 30, weight: 15, color: PALETTE.yellow },
  grape: { points: 50, weight: 0, color: PALETTE.violet }, // solo aparece por GRAPE_EVERY
};
```

- Dibujo de frutas en `lib/games/serpentina/fruits.ts`: `drawFruit(ctx, kind, cx, cy, size, alpha)`, con trazos vectoriales y sin imágenes. No hay `entities.ts`: la serpiente es una lista de celdas.
- Estado en el closure de `createSerpentinaGame`:

```ts
type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number }; // columna 0..31, fila 0..21

snake: Cell[];          // snake[0] = cabeza
dir: Dir;               // dirección del último tick
turnQueue: Dir[];       // como mucho TURN_QUEUE_MAX
growth: number;         // celdas pendientes de crecer
food: { cell: Cell; kind: Exclude<FruitKind, "grape"> };
grape: { cell: Cell; ttl: number } | null;
eaten: number;          // frutas comidas (todas)
score: number; level: number;
stepAcc: number;        // s acumulados hacia el siguiente tick
result: "lose" | "win" | null; // qué texto dibuja el fin de partida
demo: { snake: Cell[]; pathIndex: number; acc: number }; // solo en ready
phase: GamePhase; paused: boolean; inputEnabled: boolean;
```

- Snapshot: `{ phase, paused, score, lives: null, level, extra: { length } }`, comparado con `sameSnapshot` de `lib/games/types.ts`. `onChange` nunca se emite por frame.
- `serpentinaDef`:
  - `id: "serpentina"`, `create: createSerpentinaGame`, `world: { width: 800, height: 600 }`.
  - `initialSnapshot: { phase: "ready", paused: false, score: 0, lives: null, level: 1, extra: { length: 3 } }`.
  - `startTitle: "SERPENTINA"`.
  - `controls: [{ keys: ["←", "↑", "→", "↓", "WASD"], label: "girar" }, { keys: ["P"], label: "pausa" }]` (etiquetas únicas: `GameScreen` usa `label` como `key`).
  - `pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR"`.
  - `hudExtras: [{ key: "length", label: "Longitud" }]`.
- Base de datos: sin cambios.

---

## Estructura de archivos

```
lib/games/serpentina/
  constants.ts      (nuevo: constantes, PALETTE, FRUITS)
  fruits.ts         (nuevo: drawFruit)
  engine.ts         (nuevo: createSerpentinaGame: CreateEngine)
  index.ts          (nuevo: serpentinaDef: RealGameDef)
lib/games/registry.ts   (modificar: añadir serpentinaDef)
```

No cambian `lib/games/types.ts`, `components/game-player.tsx`, `components/game-screen.tsx`, `app/globals.css`, `supabase/migrations/` ni `references/`.

---

## Plan de implementación

1. Crear `lib/games/serpentina/constants.ts` con todo el modelo de datos. Verificar: `npx tsc --noEmit`.
2. Crear `lib/games/serpentina/fruits.ts` con `drawFruit` para las 4 frutas. Verificar: `npx tsc --noEmit`.
3. Crear `lib/games/serpentina/engine.ts` con la lógica del juego:
   - Estado en el closure, `resetGame()`, `spawnFood()` (celda libre al azar con pesos) y `spawnGrape()`.
   - `tick()`: consume un giro de la cola, mueve la cabeza, comprueba bordes y cuerpo (con la excepción de la cola), come fruta, suma puntos con el nivel previo, recalcula el nivel, crece y comprueba la victoria.
   - Acumulador `stepAcc` con la duración del tick del nivel. Temporizador de la uva con `dt`.
   - Fases `ready → playing → gameover`, `result` para el texto de fin y loop con `dt` limitado a `MAX_DT`. Al reanudar, `lastTime = null`.
   - `onChange` con `sameSnapshot` y `extra: { length }`.
   Verificar: `npx tsc --noEmit`.
4. Añadir el input en `engine.ts`:
   - `keydown` / `blur` en `window` y `visibilitychange` en `document`, todos quitados en `destroy()`.
   - Flechas y `W` `A` `S` `D` encolan giros con las reglas de la cola. Solo se encolan en `playing`, sin pausa y con el input activo.
   - Espacio solo inicia desde `ready`. `P` y `Escape` alternan pausa.
   - `preventDefault` en flechas y Espacio. Se ignoran eventos con el foco en `INPUT`, `TEXTAREA`, `SELECT`, `BUTTON` o `contentEditable`.
   - `setInputEnabled(false)` ignora el teclado y vacía `turnQueue`.
   Verificar: `npx tsc --noEmit`.
5. Dibujar en `engine.ts`:
   - Rejilla del tablero, serpiente, fruta normal y uva (con parpadeo en sus últimos 2 s).
   - HUD de canvas en la franja superior.
   - Fin de partida (`GAME OVER` o `¡VICTORIA!` con `PUNTAJE: N`).
   - En `ready`, la rejilla y la serpiente demo en su circuito.
   - Fuentes con `getComputedStyle(document.documentElement)` (`--pixel`, `--mono`).
   Verificar: `npx tsc --noEmit`.
6. Crear `lib/games/serpentina/index.ts` con `serpentinaDef` y registrarlo en `lib/games/registry.ts`. Verificar: `/juegos/serpentina/jugar` muestra la pantalla de inicio de SERPENTINA con la demo de fondo y se juega.
7. Aplicar el estilo neón con `/frontend-design`: siluetas de las frutas, cabeza con ojos y glow con `shadowBlur` solo en la cabeza, las frutas y el texto de fin. El cuerpo y la rejilla van sin glow.
8. Probar GAME OVER → modal → guardar con sesión → el jugador aparece en `/salon` (pestaña SERPENTINA) y en `/juegos/serpentina`.
9. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

> **Verificación (2026-11-18):** los criterios marcados se comprobaron con `npm run lint`, `npx tsc --noEmit`, `npm run build`, peticiones HTTP a las rutas y una simulación del motor real en Node con stubs del DOM (39 comprobaciones de reglas, input, pausa, fin, victoria y `destroy()`). Los criterios sin marcar necesitan una prueba manual en el navegador (pantalla de inicio, modal, guardado, nitidez, táctil, consola), porque en esta sesión no había navegador automatizado disponible.

**Comunes:**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [x] `/juegos/serpentina` y `/juegos/serpentina/jugar` responden 200 y muestran el título SERPENTINA.
- [x] `lib/games/registry.ts` contiene `serpentina` y su motor implementa `GameEngine` sin estado de módulo.
- [ ] Al entrar a `/juegos/serpentina/jugar` se ve la pantalla de inicio con los controles y `PULSA ESPACIO PARA EMPEZAR`; la partida no empieza hasta pulsar Espacio o hacer click.
- [ ] La puntuación, las vidas y el nivel del HUD del canvas y del HUD React coinciden en todo momento.
- [ ] `PAUSA`, `P` y `Escape` congelan el juego y muestran `EN PAUSA`; `REANUDAR`, `P` o `Escape` lo reanudan sin salto de posiciones.
- [x] Cambiar de pestaña o de ventana pausa el juego automáticamente.
- [ ] Al terminar la partida el canvas muestra el fin de partida con el puntaje y se abre el modal `FIN DEL JUEGO` con la misma puntuación.
- [ ] `FIN` abre el modal con la misma puntuación que muestran los HUD.
- [ ] `JUGAR DE NUEVO` cierra el modal y empieza una partida nueva con el estado inicial en ambos HUD.
- [x] Con el modal abierto, el teclado no mueve ni acciona nada en el juego.
- [ ] Con sesión, `GUARDAR PUNTUACIÓN` guarda la partida, muestra `▸ PUNTUACIÓN GUARDADA · PUESTO #N_` y el jugador aparece en `/salon` (pestaña SERPENTINA) y en `/juegos/serpentina`.
- [ ] Sin sesión, el modal muestra `INICIA SESIÓN PARA GUARDAR`.
- [x] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [x] Navegar a otra página y volver a `/juegos/serpentina/jugar` (varias veces) no duplica velocidad, input ni listeners.
- [ ] El canvas se ve nítido con `devicePixelRatio` 2 y mantiene su proporción al redimensionar la ventana.
- [ ] El canvas usa la paleta neón del Vault.
- [ ] En un dispositivo táctil sin puntero fino, la pantalla de inicio muestra `REQUIERE TECLADO`.
- [ ] ASTEROIDES, CAÍDA, BLOQUE BUSTER y los juegos simulados siguen funcionando igual.
- [ ] No hay errores en la consola del navegador durante una partida completa.

**Específicos de SERPENTINA:**

- [ ] El HUD React muestra `Jugador`, `Puntuación`, `Vidas` con `—`, `Nivel` y `Longitud`.
- [ ] En fase `ready` el canvas muestra la rejilla y una serpiente demo de 8 celdas que recorre un circuito, sin frutas ni HUD de juego.
- [x] Al empezar, la serpiente mide 3 celdas en el centro del tablero y avanza sola hacia la derecha. `Longitud` muestra `3` en ambos HUD.
- [x] En el nivel 1 la serpiente avanza una celda cada 150 ms.
- [x] Las flechas y `W` `A` `S` `D` giran la serpiente.
- [x] Pulsar la dirección opuesta a la actual no hace nada.
- [x] Pulsar `↑` y `←` muy seguidos yendo a la derecha ejecuta los dos giros en ticks consecutivos.
- [x] Siempre hay exactamente una fruta normal en el tablero, nunca sobre la serpiente.
- [x] Comer una manzana suma `10 × nivel`, una cereza `20 × nivel`, un limón `30 × nivel` y una uva `50 × nivel`, con el nivel previo a la fruta.
- [x] La quinta fruta se come en el nivel 1 y suma su valor × 1. Tras comerla, el nivel pasa a 2 en ambos HUD.
- [x] Cada fruta comida alarga la serpiente 1 celda y suma 1 a `Longitud` en ambos HUD.
- [x] Al llegar a 5, 10, 15… frutas comidas aparece una uva, si no había ya una.
- [ ] La uva parpadea en sus últimos 2 s y desaparece a los 6 s sin restar puntos.
- [x] El temporizador de la uva no avanza con el juego en pausa.
- [x] Cada nivel reduce el tick en 10 ms. Desde el nivel 10 se mantiene en 60 ms.
- [ ] Chocar con cualquier borde del tablero termina la partida con `GAME OVER` y `PUNTAJE: N` y abre el modal.
- [x] Chocar con el propio cuerpo termina la partida con `GAME OVER`.
- [x] Moverse a la celda que la cola deja libre en ese mismo tick no termina la partida.
- [ ] Si no queda ninguna celda libre para la fruta normal, el canvas muestra `¡VICTORIA!` y abre el modal.
- [x] La franja superior del canvas (`y` 0–50) muestra `PUNTOS`, `NIVEL` y `LONGITUD` y nunca la tapa la serpiente.
- [x] Al reanudar tras una pausa larga, la serpiente no avanza varias celdas de golpe.
- [x] El repo no contiene copias de `fruits.png` ni de `sprites.js` fuera de `references/`, y el juego no carga imágenes.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Reutilizar la fila `serpentina` sin cambios | Fila nueva `snake` / `update` del `long` | Decisión del usuario. Conserva portada, posición 3 y puntuaciones. No hace falta migración y no hay dos snakes en el catálogo. |
| Juego nuevo con mecánica definida en esta spec | Port de un template | No existe template jugable de snake. La carpeta de referencia solo trae sprites. |
| Frutas vectoriales neón propias | Usar `fruits.png` con `sprites.js` | Los sprites son arte del Google Snake Game (de terceros) y el atlas no coincide con la imagen. Decisión del usuario. |
| Rejilla 32×22 de 25 px con franja de HUD de 50 px | 40×28 de 20 px / 20×14 de 40 px | Decisión del usuario. Celdas legibles, mucho espacio de juego y HUD que no tapa el tablero. |
| Los bordes matan | Wrap (atravesar bordes) | Decisión del usuario. Encaja con el `long` del catálogo ("un movimiento en falso"). |
| Puntos = valor de la fruta × nivel previo | `+10` fijo / valor sin multiplicador | Decisión del usuario. Diferencia mejor el leaderboard. Usar el nivel previo sigue el criterio de CAÍDA. |
| Una fruta normal + uva temporal cada 5 frutas | Una sola fruta / tres simultáneas | Decisión del usuario. La uva añade riesgo y recompensa sin saturar el tablero. |
| Nivel cada 5 frutas, −10 ms por nivel hasta 60 ms | Cada 10 frutas / velocidad constante | Decisión del usuario. Cumple "cada bocado la hace más veloz" con un techo jugable. |
| Sin vidas (`lives: null`) y extra `Longitud` | 3 vidas / sin extras | Decisión del usuario. Es el snake clásico. La longitud es la stat propia del género y SPEC 07 ya la soporta. |
| Sin tope de puntuación en el motor | `SCORE_CAP = 9_999_999` | La cota teórica es ≈ 4,94 M. Un tope sería código muerto. |
| Cola de 2 giros con flechas + WASD | Un giro por tick, solo flechas | Decisión del usuario. Los giros rápidos en U no se pierden y no se puede hacer un giro de 180° en un tick. |
| Arranque automático hacia la derecha | Esperar la primera flecha | Decisión del usuario. Sigue el contrato: Espacio inicia y la partida corre. |
| `ready` con serpiente demo en circuito fijo | Rejilla vacía | Decisión del usuario. Da vida a la pantalla de inicio. El circuito fijo evita `Math.random()` en la demo. |
| Fin directo a `gameover`, sin fase `dead` | Animación de muerte en `dead` | El contrato reserva `dead` para juegos con vidas. |
| `¡VICTORIA!` al llenar el tablero | Ignorar el caso | Sin celda libre no se puede colocar fruta. Hay que cerrar la partida de forma explícita. |
| Sin `entities.ts`, con `fruits.ts` para el dibujo | Clases `Snake` y `Fruit` | La serpiente es una lista de celdas. Separar el dibujo de las frutas deja `engine.ts` más corto. |
| Un control `← ↑ → ↓ WASD · girar` | Dos controles con la etiqueta `girar` | `GameScreen` usa `label` como `key` de React (lección de SPEC 08). |
| Glow solo en la cabeza, las frutas y el texto de fin | Glow en todo el cuerpo | Rendimiento: el cuerpo puede tener cientos de celdas. |
| (Implementación) Serpiente como tubo de luz continuo: tramos opacos de verde a verde tenue hacia la cola y un núcleo claro de un solo trazo | Cuadrados por celda | Decisión de `/frontend-design`. Se lee como la "serpiente de luz" del catálogo. Los colores opacos evitan uniones más oscuras por solape de alfa. |
| (Implementación) Rejilla de puntos en las intersecciones y marco `inkFaint` | Líneas de rejilla completas | Marca las celdas sin competir con la serpiente. |
| (Implementación) Anillo de 0,2 s del color de la fruta al comerla (`BITE_DURATION`) | Sin respuesta visual | Única animación: confirma el bocado en el punto donde ocurre. |
| (Implementación) `Longitud` = celdas + crecimiento pendiente | Solo celdas dibujadas | Sube en el mismo tick en que se come y no un tick después. |
| (Implementación) Al comer una uva que deja el total en múltiplo de 5, aparece otra uva | No reponer nunca tras una uva | Aplica literalmente la regla "al llegar a un múltiplo de 5 aparece una uva si no hay ya una". |
| (Implementación) Sin línea separadora propia en `y = 50`: el marco del tablero cumple esa función | Línea extra como en BLOQUE BUSTER | Evita un doble trazo sobre el borde superior del tablero. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| StrictMode monta el efecto dos veces y crea dos motores. | `GameScreen` llama a `destroy()` en el cleanup. `destroy()` cancela el rAF y quita todos los listeners. |
| Dos giros en el mismo tick producen un giro de 180° y una muerte injusta. | Cola de giros validada contra la última dirección encolada, no contra la del tick anterior. |
| `spawnFood` se queda en bucle buscando celda libre con la serpiente muy larga. | Elegir al azar entre la lista de celdas libres calculada, no reintentar posiciones al azar. Con la lista vacía → victoria. |
| El `dt` acumulado tras una pausa ejecuta varios ticks de golpe. | `lastTime = null` al reanudar y `dt` limitado a `MAX_DT = 0.05`. Como mucho un tick por frame desde el nivel 10. |
| La uva caduca mientras el juego está en pausa o con el modal abierto. | El temporizador solo avanza en `update`, que no corre en pausa ni en `gameover`. |
| La demo de `ready` modifica el snapshot o la partida real. | La demo vive en `demo`, aparte de `snake`. `start()` y `restart()` no la leen. |
| El catálogo cacheado (`cacheLife("days")`) no refleja cambios. | No aplica: la fila `serpentina` no cambia. |

---

## Lo que **no** entra en esta spec

- `fruits.png`, `sprites.js` y cualquier spritesheet.
- Sonido.
- Vidas, obstáculos, paredes interiores, portales y modo wrap.
- Frutas con efectos especiales y varias frutas normales a la vez.
- Cambios en el `title`, el `long` o la portada de `serpentina`.
- Controles táctiles.
- Anti-trampas.
- Tests.

Cada uno de estos, si llega, va en su propia spec.
