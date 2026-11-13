# SPEC 05 — Juego ASTEROIDES jugable en el reproductor

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 04
> **Date:** 2026-11-12
> **Objective:** Portar a TypeScript el juego de `references/resources/templates/started-games/02-asteroids` y montarlo en el reproductor `/juegos/asteroides/jugar` (antes ROCAS), con su sistema de puntos real reflejado en el HUD del canvas y en el HUD React.

---

## Por qué existe esta spec

Hoy los 8 juegos del catálogo usan la simulación de SPEC 01 (`components/game-player.tsx`): la puntuación sube sola cada 220 ms y no hay juego real. El template de asteroides (`game.js`, 510 líneas, canvas 800×600) usa variables globales, listeners en `window` sin limpieza y un `requestAnimationFrame` que nunca se cancela: cargado tal cual, se rompe al navegar dentro de la app (listeners duplicados, loops paralelos). Esta spec lo convierte en un motor TypeScript con ciclo de vida (`start` / `pause` / `destroy`) que el reproductor React controla, y es el primer juego real del Vault. Sienta el patrón para los siguientes (`03-tetris`, `04-arkanoid`).

---

## Scope

**In:**

- La entrada `rocas` de `GAMES` pasa a ser ASTEROIDES:
  - `id: "asteroides"`, `title: "ASTEROIDES"`; rutas `/juegos/asteroides` y `/juegos/asteroides/jugar`.
  - `long` se reescribe sin mencionar OVNIs (el juego no los tiene). `short`, `cat`, `color`, `best`, `plays` y la clase de portada `cover-rocas` no cambian.
  - `RECENT_SCORES`: la fila con `game: "Rocas"` pasa a `game: "Asteroides"`.
  - `/juegos/rocas` y `/juegos/rocas/jugar` pasan a 404 (sin redirección).
- Motor portado a TypeScript strict en `lib/games/asteroids/engine.ts`, sin estado global de módulo, con la misma jugabilidad que el template:
  - Física, constantes, tamaños, velocidades, envolvimiento toroidal, colisiones y oleadas (`4` asteroides iniciales, `3 + nivel` por nivel) idénticos.
  - **Sistema de puntos del template:** grande `20`, mediano `50`, pequeño `100`, sumados al destruir cada asteroide.
  - 3 vidas, invencibilidad de 3 s con parpadeo al reaparecer, 2 s de espera tras morir.
  - Power-up de triple disparo (`3x`) con las mismas reglas de aparición (15 % por destrucción, garantizado al 5.º, uno por nivel, 12 s de vida, 5 s de efecto).
- **Dos HUD a la vez:**
  - HUD del canvas, como el template: `SCORE`, `NIVEL`, iconos de vidas e indicador `3x  N.Ns`.
  - HUD React `.player-hud` existente: `Jugador`, `Puntuación`, `Vidas`, `Nivel` con los valores reales del motor, actualizados en vivo.
- Estilo neón del Vault en el canvas (mismo dibujo vectorial, colores del sitio con glow), diseñado con `/frontend-design`.
- Canvas con mundo lógico 800×600 escalado al `.crt-screen` (4:3) y nítido según `devicePixelRatio`.
- Pantalla de inicio dentro del CRT (overlay React): título, controles y `PULSA ESPACIO PARA EMPEZAR`. Espacio o click empiezan la partida.
- Fin de partida en el canvas, como el template: overlay `GAME OVER` con `PUNTAJE: N — ESPACIO PARA REINICIAR`; Espacio reinicia.
- Pausa: botón `PAUSA` / `REANUDAR` del HUD, teclas `P` y `Escape`, y pausa automática al ocultarse la pestaña o perder el foco la ventana. Usa el overlay `EN PAUSA` existente.
- Botón `FIN`: pausa el motor y abre el modal `FIN DEL JUEGO` existente con la puntuación real. `JUGAR DE NUEVO` reinicia el motor y empieza a jugar directamente.
- `GUARDAR PUNTUACIÓN` del modal sigue siendo visual (solo el toast), igual que en SPEC 01.
- Nombre del jugador en el HUD y en el input del modal: alias de sesión en mayúsculas (SPEC 04) o `INVITADO` sin sesión.
- Dispositivos sin teclado (`(pointer: coarse)` y sin `(any-pointer: fine)`): la pantalla de inicio muestra `REQUIERE TECLADO` en lugar de `PULSA ESPACIO`.
- Mientras el juego está montado, las flechas y Espacio no hacen scroll de la página (salvo con el foco en un `input`, `textarea` o botón).
- Los otros 7 juegos siguen con la simulación de SPEC 01 sin cambios.

**Out of scope (para specs futuras):**

- Guardar puntuaciones en Supabase, ranking real, Salón de la Fama real y `best` real del catálogo.
- Controles táctiles.
- Sonido y música.
- OVNIs u otros enemigos que no estén en el template.
- Portar `03-tetris` y `04-arkanoid`.
- Redirección de `/juegos/rocas/*`.
- Cambiar la portada `cover-rocas` o renombrar su clase CSS.
- Configuración de teclas, dificultad o modo pantalla completa.
- Tests (no hay framework configurado).

---

## Modelo de datos

No hay datos persistentes nuevos. Se introducen los tipos del motor en `lib/games/asteroids/engine.ts`:

```ts
export type AsteroidsPhase = "ready" | "playing" | "dead" | "gameover";

/** Lo que el motor comunica al HUD React. */
export interface AsteroidsSnapshot {
  phase: AsteroidsPhase;
  paused: boolean;
  score: number;
  lives: number;   // 0..3
  level: number;   // >= 1
}

export interface AsteroidsOptions {
  /** Se llama solo cuando cambia algún campo del snapshot (nunca 60 veces por segundo). */
  onChange: (snapshot: AsteroidsSnapshot) => void;
}

export interface AsteroidsGame {
  start(): void;     // ready → playing
  restart(): void;   // cualquier fase → playing, score 0, vidas 3, nivel 1
  pause(): void;
  resume(): void;
  togglePause(): void;
  getSnapshot(): AsteroidsSnapshot;
  destroy(): void;   // cancela rAF y quita todos los listeners
}

export function createAsteroidsGame(canvas: HTMLCanvasElement, options: AsteroidsOptions): AsteroidsGame;
```

- Constantes del template (`RADII`, `SPEEDS`, `POINTS = [0, 100, 50, 20]`, `POWERUP_*`, `TRIPLE_SPREAD`, etc.) viven en `lib/games/asteroids/constants.ts`, con los mismos valores.
- Colores del canvas en `constants.ts` como `PALETTE`, con los valores hex de los tokens de `app/globals.css` (`--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, `--ink #e6e9ff`). La asignación concreta (qué color para nave, asteroides, balas, power-up, partículas y HUD) se decide con `/frontend-design`.
- `pause()` congela `update`; al reanudar se reinicia la referencia de tiempo para que el primer `dt` sea 0.
- En fase `ready` el motor dibuja el campo de asteroides en movimiento sin nave ni HUD de juego; en `gameover`, el overlay de canvas.
- Cambios en `lib/data.ts`: la entrada `rocas` pasa a `id: "asteroides"`, `title: "ASTEROIDES"` y nuevo `long`; `RECENT_SCORES` cambia `"Rocas"` por `"Asteroides"`. La interfaz `Game` no cambia.

---

## Estructura de archivos

```
lib/
  data.ts                          (modificar: rocas → asteroides, RECENT_SCORES)
  games/asteroids/
    constants.ts                   (nuevo: constantes del template + PALETTE)
    entities.ts                    (nuevo: Bullet, Asteroid, PowerUp, Ship, Particle)
    engine.ts                      (nuevo: createAsteroidsGame, estado, input, loop, HUD de canvas)
components/
  asteroids-screen.tsx             (nuevo, "use client": <canvas>, ciclo de vida del motor, DPR, overlay de inicio)
  game-player.tsx                  (modificar: si game.id === "asteroides" usa AsteroidsScreen y el snapshot; si no, la simulación)
app/
  juegos/[id]/jugar/page.tsx       (modificar: resuelve el alias con getSessionProfile y lo pasa como playerName)
  globals.css                      (modificar: estilos del canvas dentro de .crt-screen y del overlay de inicio)
```

---

## Plan de implementación

1. Renombrar en `lib/data.ts` la entrada `rocas` a `asteroides` (`id`, `title`, `long`) y la fila de `RECENT_SCORES`. Verificar: `/juegos/asteroides` muestra el detalle con título ASTEROIDES, `/juegos/rocas` da 404 y la Biblioteca y la home muestran ASTEROIDES.
2. Crear `lib/games/asteroids/constants.ts` y `entities.ts` portando las clases del template a TS. Las entidades reciben el `CanvasRenderingContext2D` en `draw(ctx)` en lugar de usar un `ctx` global. Verificar: `npx tsc --noEmit` pasa.
3. Crear `lib/games/asteroids/engine.ts` con `createAsteroidsGame`: estado encapsulado en el closure, input con `keys` / `justPressed` registrados en `window` y quitados en `destroy()`, loop con `dt` limitado a 50 ms, fases `ready | playing | dead | gameover`, pausa y emisión de `onChange` solo cuando cambia el snapshot. HUD de canvas y overlay `GAME OVER` como el template. Verificar: `npx tsc --noEmit` pasa.
4. Crear `components/asteroids-screen.tsx`: monta el `<canvas>` (800×600 × `devicePixelRatio`, CSS al 100 % del `.crt-screen`), crea el motor en `useEffect` y lo destruye en el cleanup (debe funcionar con el doble montaje de StrictMode), y muestra el overlay de inicio en fase `ready` (`PULSA ESPACIO PARA EMPEZAR` o `REQUIERE TECLADO`). Expone el snapshot y los controles al padre.
5. Modificar `components/game-player.tsx`: para `asteroides`, el HUD React lee `score`, `lives` y `level` del snapshot; `PAUSA` llama a `togglePause()`; el overlay `EN PAUSA` se muestra con `snapshot.paused`; `FIN` pausa y abre el modal con `snapshot.score`; `JUGAR DE NUEVO` llama a `restart()`. Para los demás juegos, la simulación queda igual. Verificar: `/juegos/caida/jugar` se comporta como antes.
6. Añadir teclas `P` / `Escape` para pausar, pausa automática con `visibilitychange` (oculta) y `blur`, y `preventDefault` de flechas y Espacio salvo con el foco en `input`, `textarea` o `button`. Con el modal abierto el motor no recibe input.
7. Modificar `app/juegos/[id]/jugar/page.tsx`: dentro del `<Suspense>` existente, `GamePlayerScreen` llama a `getSessionProfile()` y pasa `playerName` (alias en mayúsculas o `INVITADO`) a `GamePlayer`. Verificar: con sesión el HUD muestra el alias; sin sesión, `INVITADO`.
8. Aplicar el estilo neón al canvas y al overlay de inicio con `/frontend-design` (glow con `shadowBlur`, colores de `PALETTE`), y añadir los estilos en `app/globals.css`.
9. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [x] El catálogo, la home y el detalle muestran ASTEROIDES; no queda ningún texto visible "ROCAS" ni "Rocas" en la app.
- [x] `/juegos/asteroides` y `/juegos/asteroides/jugar` responden 200; `/juegos/rocas` y `/juegos/rocas/jugar` responden 404.
- [x] Al entrar a `/juegos/asteroides/jugar` se ve la pantalla de inicio con `PULSA ESPACIO PARA EMPEZAR`; la partida no empieza hasta pulsar Espacio o hacer click.
- [x] `←` `→` rotan, `↑` propulsa y Espacio dispara, con la misma sensación que el template.
- [x] Destruir un asteroide grande suma 20, uno mediano 50 y uno pequeño 100.
- [x] La puntuación, las vidas y el nivel del HUD del canvas y del HUD React coinciden en todo momento.
- [x] El indicador `3x  N.Ns` aparece en el HUD del canvas mientras dura el triple disparo.
- [x] Al perder una vida, ambos HUD la descuentan y la nave reaparece a los 2 s parpadeando durante 3 s.
- [x] Al limpiar todos los asteroides el nivel sube en ambos HUD y aparecen `3 + nivel` asteroides grandes.
- [x] Al perder la última vida se muestra en el canvas `GAME OVER` con el puntaje final; Espacio reinicia con puntuación 0, 3 vidas y nivel 01 en ambos HUD.
- [x] `PAUSA`, `P` y `Escape` congelan el juego y muestran `EN PAUSA`; `REANUDAR`, `P` o `Escape` lo reanudan sin salto de posiciones.
- [x] Cambiar de pestaña o de ventana pausa el juego automáticamente.
- [x] `FIN` abre el modal con la misma puntuación que muestran los HUD; `JUGAR DE NUEVO` cierra el modal y empieza una partida nueva.
- [x] Con el modal abierto, escribir en el input no mueve la nave ni dispara.
- [x] Con sesión, `Jugador` muestra el alias en mayúsculas; sin sesión, `INVITADO`.
- [x] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [x] Navegar a otra página y volver a `/juegos/asteroides/jugar` (varias veces) no duplica velocidad, disparos ni listeners.
- [x] El canvas se ve nítido en pantallas con `devicePixelRatio` 2 y mantiene 4:3 al redimensionar la ventana.
- [x] El canvas usa la paleta neón del Vault, no el blanco del template.
- [x] En un dispositivo táctil sin puntero fino, la pantalla de inicio muestra `REQUIERE TECLADO`.
- [x] `/juegos/{otro id}/jugar` (p. ej. `caida`) mantiene la simulación de SPEC 01 sin cambios.
- [x] No hay errores en la consola del navegador durante una partida completa.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Reutilizar ROCAS renombrado a ASTEROIDES | Nueva entrada en el catálogo | Decisión del usuario; ROCAS ya era un juego de asteroides con portada propia. |
| Cambiar el id a `asteroides`, sin redirección | Mantener `rocas` / redirigir 308 | Coherente con el título; no hay enlaces externos que preservar. |
| Portar a TypeScript con ciclo de vida | Iframe con `public/` / `next/script` tal cual | Evita globals y listeners huérfanos al navegar; el HUD React recibe datos directos. |
| Mantener ambos HUD | Solo React / solo canvas | Decisión del usuario. |
| Sistema de puntos idéntico al template (20/50/100) | Ajustar valores | Decisión del usuario: que el sistema de puntos funcione tal cual. |
| `onChange` solo ante cambios del snapshot | Re-render de React por frame | El loop corre a 60 fps; React solo se entera de lo que cambia. |
| GAME OVER en el overlay del canvas con Espacio para reiniciar | Abrir el modal React al morir | Decisión del usuario; el modal queda para `FIN`. |
| Pausa con botón, `P` / `Escape` y automática | Solo botón | Evita morir al cambiar de pestaña. |
| Pantalla de inicio `PULSA ESPACIO` | Empezar al cargar | No se pierde una vida mientras la página carga o el usuario lee. |
| Paleta neón del Vault | Blanco vectorial del template | Coherencia visual con el CRT y el sitio. |
| Mundo lógico 800×600 escalado | Mundo al tamaño del contenedor | La dificultad no depende del dispositivo. |
| Alias de sesión o `INVITADO` | Siempre `INVITADO` | Reutiliza SPEC 04 sin coste; prepara la spec de puntuaciones. |
| Sesión resuelta en el `<Suspense>` existente de la página | Slot separado con su propio `<Suspense>` | El reproductor ya se transmite por `params`; no añade espera visible. |
| Sin persistir puntuaciones | Tabla `scores` en esta spec | Otro dominio (migración, RLS, anti-trampas); va en su propia spec. |
| Sin controles táctiles, con aviso | Controles en pantalla | Reduce el alcance; queda para otra spec. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| StrictMode monta el efecto dos veces y crea dos motores. | `destroy()` cancela el rAF y quita listeners; el cleanup del `useEffect` lo llama. Criterio de navegación repetida. |
| Los listeners de teclado en `window` interfieren con el input del modal o con otras páginas. | Input ignorado con el modal abierto y con foco en campos; todos los listeners se quitan al desmontar. |
| `Math.random()` en el render rompe la hidratación. | El motor solo se crea en `useEffect`, nunca durante el render. |
| Cambiar el id a `asteroides` cambia las puntuaciones mock del detalle (la semilla usa `id.length`). | Aceptado: los datos son mock hasta la spec de puntuaciones. |
| `shadowBlur` para el glow baja los fps en equipos lentos. | Glow aplicado solo a nave, balas y power-up, o con trazo doble; se valida durante el paso 8. |
| Leer la sesión en la página del reproductor la vuelve dinámica. | Ya está dentro de `<Suspense>`; el build valida que no hay acceso fuera de él. |
| El `dt` acumulado tras una pausa larga hace saltar las entidades. | Al reanudar se reinicia la referencia de tiempo (`dt = 0`) y se mantiene el tope de 50 ms. |

---

## Lo que **no** entra en esta spec

- Guardar puntuaciones, ranking y Salón de la Fama reales.
- Controles táctiles.
- Sonido.
- Enemigos nuevos (OVNIs).
- Tetris y Arkanoid.
- Redirección de las URLs de ROCAS.
- Tests.

Cada uno de estos, si llega, va en su propia spec.
