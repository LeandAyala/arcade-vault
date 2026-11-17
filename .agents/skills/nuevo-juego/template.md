# Plantilla de spec de juego real

Forma que debe tener `specs/NN-juego-<id>.md`. Es la plantilla general de `/spec` (`.claude/skills/spec/template.md`) ya rellenada con las secciones de juego: el propósito y las reglas de cada sección (objetivo en una frase, Scope In/Out obligatorio, pasos que dejan el sistema funcionando, criterios booleanos, decisiones con motivo) son los de esa plantilla. Los textos entre `<…>` se sustituyen por datos reales; **nada de placeholders en la spec final**. Las secciones siguen el orden de SPEC 05 y SPEC 06.

---

```markdown
# SPEC NN — Juego <TÍTULO> jugable en el reproductor

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06
> **Date:** <fecha del contexto de sesión>
> **Objective:** <Portar a TypeScript el juego de `references/resources/templates/started-games/<carpeta>` | Crear el juego <TÍTULO>> y montarlo en `/juegos/<id>/jugar` como juego real del registro, con su sistema de puntos reflejado en ambos HUD y guardable en el leaderboard.

---

## Por qué existe esta spec

<Qué juego es, de dónde sale, qué hay hoy en `/juegos/<id>/jugar` (simulación de SPEC 01 o nada) y qué problemas tiene el template tal cual (globals, listeners sin limpiar, HUD DOM, proporción). Una o dos frases sobre por qué ahora.>

---

## Scope

**In:**

- Catálogo: <reutiliza la fila `<id>` de `public.games` sin cambios | migración `update` de `title`/`long` | migración `insert` con `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `sort_order`>.
- Motor TypeScript strict en `lib/games/<id>/engine.ts` que implementa `GameEngine` de `lib/games/types.ts`, sin estado global de módulo, con la jugabilidad del template:
  - <física / reglas / velocidades / niveles idénticos, con valores literales>.
  - **Sistema de puntos:** <cada regla con su valor literal>.
  - <Vidas: N, reaparición… | Sin vidas: `lives: null`>.
  - <Condición de fin → `phase: "gameover"`>.
- Definición `RealGameDef` en `lib/games/<id>/index.ts` y entrada en `lib/games/registry.ts`.
- Mundo lógico <W×H> <4:3 | con letterbox | rediseñado a 800×600 con panel lateral en canvas>, nítido según `devicePixelRatio`.
- Dos HUD: HUD de canvas (<qué muestra>) y HUD React `.player-hud` (`Jugador`, `Puntuación`, `Vidas`, `Nivel`) con los valores del snapshot.
- Pantalla de inicio (`GameScreen`) con `startTitle` y `controls`: <lista de teclas y acciones>.
- GAME OVER: el canvas dibuja <texto> y el reproductor abre el modal `FIN DEL JUEGO`; `GUARDAR PUNTUACIÓN` guarda con `saveScore` y el jugador aparece en `/salon` y `/juegos/<id>`.
- Pausa (`PAUSA`, `P`, `Escape`, automática al perder foco), `FIN`, `JUGAR DE NUEVO`, input bloqueado con el modal abierto: como SPEC 05.
- Estilo neón del Vault con `PALETTE`, diseñado con `/frontend-design`.

**Out of scope (para specs futuras):**

- <Sonido / sprites / temas / selección de nivel / récords en localStorage del template>.
- Controles táctiles.
- Anti-trampas (validación de partidas en servidor).
- <Lo que haya surgido en las preguntas y se haya dejado fuera>.

---

## Modelo de datos

- Constantes del template en `lib/games/<id>/constants.ts` con los mismos valores (`W`, `H`, `MAX_DT = 0.05`, <constantes de puntos, velocidades, niveles>) y `PALETTE` con los hex de `app/globals.css`.
- Entidades en `lib/games/<id>/entities.ts` con `draw(ctx)` (sin `ctx` global). <Omitir si el juego es una matriz simple.>
- Snapshot del motor:

\`\`\`ts
// GameSnapshot (lib/games/types.ts), sin cambios
{ phase, paused, score, lives: <number | null>, level }
\`\`\`

- `RealGameDef` de `<id>`: `world: { width: <W>, height: <H> }`, `initialSnapshot: { phase: "ready", paused: false, score: 0, lives: <N | null>, level: 1 }`, `startTitle: "<TÍTULO>"`, `controls: [...]`, `pauseHint: "PULSA REANUDAR, P O ESC PARA CONTINUAR"`.
- Base de datos: <sin cambios | migración `supabase/migrations/<timestamp>_<accion>_<id>.sql` con el SQL concreto>.

---

## Estructura de archivos

\`\`\`
lib/games/<id>/
  constants.ts      (nuevo)
  entities.ts       (nuevo, si aplica)
  engine.ts         (nuevo: create<Nombre>Game: CreateEngine)
  index.ts          (nuevo: <id>Def: RealGameDef)
lib/games/registry.ts   (modificar: añadir <id>Def)
supabase/migrations/<timestamp>_<accion>_<id>.sql   (nuevo, solo si cambia el catálogo)
app/globals.css     (modificar solo si hay portada nueva o estilos propios)
\`\`\`

---

## Plan de implementación

1. <Solo si cambia el catálogo> Crear la migración con `npx supabase migration new <accion>_<id>` y aplicarla con `npx supabase db push`. Verificar con `execute_sql` / `list_tables` y `get_advisors` (security).
2. Crear `constants.ts` y `entities.ts` portando las estructuras del template a TS. Verificar: `npx tsc --noEmit`.
3. Crear `engine.ts` con estado en el closure, input en `window` con limpieza en `destroy()`, loop con `dt` limitado a `MAX_DT`, fases, pausa, `setInputEnabled` y `onChange` solo ante cambios. HUD de canvas y pantalla de GAME OVER. Verificar: `npx tsc --noEmit`.
4. Crear `index.ts` con la `RealGameDef` y registrarla en `lib/games/registry.ts`. Verificar: `/juegos/<id>/jugar` muestra la pantalla de inicio y se juega.
5. Aplicar el estilo neón con `/frontend-design` (glow con `shadowBlur` moderado, colores de `PALETTE`).
6. Probar GAME OVER → modal → guardar con sesión → el jugador aparece en `/salon` y `/juegos/<id>`.
7. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

<Criterios comunes de reference/criterios.md con <id> sustituido>
<Criterios específicos: cada regla de puntos, vidas, niveles, fin de partida, controles>

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| <Reutilizar fila `<id>` / fila nueva> | <la otra> | <motivo> |
| Puntuación idéntica al template | Ajustar valores | <motivo> |
| <Mundo 4:3 / letterbox> | <la otra> | <motivo> |
| <Elementos del template descartados> | <portarlos> | <motivo> |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| StrictMode monta el efecto dos veces y crea dos motores. | `GameScreen` llama a `destroy()` en el cleanup; `destroy()` cancela rAF y quita todos los listeners. |
| <Riesgo propio del juego> | <mitigación> |

---

## Lo que **no** entra en esta spec

- <Repetición del Out of scope.>

Cada uno de estos, si llega, va en su propia spec.
```
