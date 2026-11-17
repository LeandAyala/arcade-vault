---
name: nuevo-juego
description: Genera una spec (estado Borrador) para añadir al Arcade Vault un juego real jugable en el reproductor, integrado con el catálogo de Supabase (public.games) y el leaderboard (public.scores). Porta un template de references/resources/templates/started-games/ o diseña un juego desde cero. Usar al pedir "nuevo juego", "portar tetris/arkanoid", "integrar un juego en la plataforma".
disable-model-invocation: true
argument-hint: <carpeta de started-games (p. ej. 03-tetris) o descripción breve del juego>
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(wc:*)
---

# /nuevo-juego — Spec de un juego real con leaderboard

## Contexto de la sesión

Fecha de hoy (úsala en la cabecera de la spec, nunca la inventes):
!`date +%F`

Specs existentes:
!`ls specs/`

Templates disponibles en `references/resources/templates/started-games/`:
!`ls references/resources/templates/started-games/ 2>/dev/null || echo "(sin templates)"`

Juegos reales ya registrados:
!`ls lib/games/`

Migraciones de Supabase:
!`ls supabase/migrations/`

---

Esta skill **no escribe código**. Produce `specs/NN-juego-<id>.md`, una spec lista para `/spec-impl`, que integra un juego real siguiendo el patrón de SPEC 05 (ASTEROIDES) y SPEC 06 (catálogo y leaderboard), ya generalizado en el registro `lib/games/registry.ts`.

Antes de empezar, lee en este orden:

1. **La skill `/spec`**: `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` (si no existen, `.agents/skills/spec/`). Es el método base para crear specs en este repo: **esta skill es una especialización de `/spec` para juegos y sigue sus fases, reglas y forma de preguntar**. Si `/spec` no existe en ninguna de las dos rutas, avisa al usuario y sigue solo con esta skill.
2. `reference/integration.md` (junto a este archivo): el contrato técnico que toda spec de juego debe respetar. **No lo contradigas en la spec.**
3. `template.md` (junto a este archivo): las secciones de juego que se rellenan sobre la estructura general de `.claude/skills/spec/template.md`.
4. `reference/criterios.md`: criterios de aceptación comunes que se copian en cada spec.
5. `CLAUDE.md` del repo y las dos specs más recientes de `specs/` para respetar idioma, estados (`Borrador`, `Aprobado`, `Implementado`) y estilo.

### Relación con `/spec`

- Las cuatro fases de abajo corresponden a las de `/spec` (contexto → preguntas → redacción → guardado). Aplica todas sus reglas: preguntas concretas en bloques de 3 a 5 con `AskUserQuestion` y la recomendación primero, el criterio de cuándo dejar de preguntar, cuándo escribir la spec completa o sección por sección, los errores comunes que hay que evitar, las reglas globales del documento (sin TODO, nombres concretos, una idea por frase) y las reglas estrictas (no escribir código, no proponer implementar, no asumir decisiones).
- Esta skill **añade** a `/spec` lo específico de un juego: las preguntas de catálogo y adaptaciones (Fases 2 y 3), el contrato técnico y los criterios comunes.
- Si `/spec` y esta skill chocan, manda esta skill en lo específico de juegos (nombre `NN-juego-<id>.md`, dependencias SPEC 05 y SPEC 06, criterios comunes) y `/spec` en todo lo demás.

Responde siempre en el idioma del usuario.

## Fase 1 — Identificar el origen del juego

El argumento recibido es: `$ARGUMENTS`

- **Vacío:** pregunta qué juego quiere añadir y si viene de un template (muestra la lista de arriba) o es nuevo.
- **Coincide con una carpeta de `started-games/`** (nombre completo, número o slug, p. ej. `03`, `tetris`, `04-arkanoid`): es un **port**. Lee `game.js` (y otros `.js`), `index.html`, `README.md` y `CLAUDE.md` del template, y apunta:
  - tamaño del canvas y proporción (el CRT es 4:3; otra proporción usa letterbox);
  - controles exactos (teclas, ratón);
  - **sistema de puntos con sus valores literales** (constantes, multiplicadores, bonus);
  - vidas (¿hay? ¿cuántas?), niveles y cómo suben, condición de fin (`gameover`, `win`);
  - estado global, listeners sin limpiar, HUD en DOM, overlays DOM, temas, `localStorage`;
  - assets (sprites, sonidos, fuentes) y specs propias del template (`specs/`).
- **Otro texto:** es un **juego nuevo**. Pide en la Fase 3 la mecánica, controles, puntos, vidas, niveles y fin de partida.

Si el juego ya está en `lib/games/registry.ts`, avisa y pregunta si se trata de una mejora (entonces sugiere `/spec` en lugar de esta skill).

## Fase 2 — Ubicar el juego en el catálogo

Lee la última migración de `supabase/migrations/` que inserta en `public.games` (y cualquiera posterior que la modifique) para conocer las filas actuales: `id`, `title`, `cat`, `cover`, `color`, `sort_order`.

Decide con el usuario (usa `AskUserQuestion`, recomendación primero):

- **Reutilizar una fila existente** cuando ya hay un juego simulado equivalente (p. ej. Tetris → `caida`, Arkanoid → `bloque-buster`). Es lo recomendado: conserva portada, posición y puntuaciones. Si cambia el `title` o el `long`, la spec incluye una migración `update`. Si cambia el `id`, advierte que las puntuaciones guardadas con el id viejo quedan en ese juego (FK `on delete cascade`) y que el cambio de id es una migración delicada; recomienda no cambiarlo.
- **Crear una fila nueva**: `id` kebab-case (`^[a-z0-9-]{1,32}$`), `title` en mayúsculas, `short`, `long`, `cat` (`ARCADE | PUZZLE | SHOOTER | VERSUS`), `color` (`cyan | magenta | yellow | green`), `sort_order` = máximo actual + 1, y portada: reutilizar una clase `cover-*` de `app/globals.css` o diseñar una nueva con `/frontend-design`.

## Fase 3 — Aclarar las adaptaciones

Pregunta en bloques de 3 a 5 con `AskUserQuestion`. Considera siempre las que apliquen:

1. **Puntuación:** ¿se mantiene idéntica al template? (recomendado: sí, literal). Para juegos nuevos: valores concretos por acción.
2. **Vidas:** si el juego no tiene vidas, `lives: null` y el HUD React muestra `—`. Si las tiene, cuántas.
3. **Nivel:** qué cuenta como nivel (oleada, líneas/10, pantalla). El snapshot siempre expone `level >= 1`.
4. **Fin de partida:** todo final (`win` incluido) se traduce a `phase: "gameover"`, que abre el modal `FIN DEL JUEGO` para guardar. ¿Qué texto dibuja el canvas (`GAME OVER`, `¡VICTORIA!`)?
5. **Proporción del mundo:** si no es 4:3, se mantiene el mundo lógico y el canvas queda con letterbox, o se rediseña el layout dentro de 4:3 (p. ej. tablero + panel lateral con "siguiente pieza" dibujado en el canvas). Recomendación: dibujar dentro de un mundo 4:3 cuando el template tiene paneles laterales.
6. **Controles:** las teclas `P` / `Escape` quedan reservadas para pausa; Espacio inicia desde `ready`. Si el template usa esas teclas para otra cosa, propón alternativas. Ratón: permitido sobre el canvas, quitado en `destroy()`.
7. **Elementos del template que se descartan o posponen:** HUD DOM y overlays DOM (se sustituyen por HUD de canvas + HUD React), temas claro/oscuro, `localStorage` de récords (el leaderboard es Supabase), sonido y sprites (por defecto fuera de scope; si entran, en `public/games/<id>/`), menús de selección de nivel.
8. **Estilo visual:** paleta neón del Vault (`PALETTE`), qué color para cada entidad; se diseña con `/frontend-design` durante la implementación.
9. **Táctil:** fuera de scope por defecto (pantalla `REQUIERE TECLADO`).

Deja de preguntar cuando puedas responder sin suponer nada: qué archivos aparecen o cambian, cuál es el primer y el último paso, y cómo se verifica.

## Fase 4 — Escribir y guardar la spec

Antes de escribir el archivo, vuelve a abrir `.claude/skills/spec/SKILL.md` (fases 3 y 4) y `.claude/skills/spec/template.md` y comprueba que la spec cumple su estructura: cabecera con objetivo en una sola frase, Scope con **In** y **Out of scope**, modelo de datos con nombres reales, plan con pasos que dejan el sistema funcionando, criterios booleanos, decisiones con motivo, riesgos y la sección final de lo que no entra. Sigue también su paso de guardado (incluido crear `specs/.spec-config.yml` solo si no existe) y su mensaje de confirmación.

1. Número: el mayor de `specs/` + 1, con dos dígitos. Slug: `juego-<id>` (p. ej. `07-juego-caida.md`). Si el archivo existe, pregunta.
2. Rellena `template.md` con datos reales: nada de `TODO` ni placeholders. Los valores de puntuación van **literales** en Scope, Modelo de datos y Criterios.
3. `**Depends on:**` siempre incluye `SPEC 05, SPEC 06`; comprueba que existen en `specs/`.
4. Copia los criterios comunes de `reference/criterios.md` y añade los específicos del juego (cada regla de puntos, vidas, niveles, fin de partida).
5. Estado `Borrador` (o el equivalente que usen las specs del repo). Nunca `Aprobado`.
6. Confirma al usuario: ruta del archivo, que está en `Borrador`, y el siguiente paso: revisarla, marcarla `Aprobado` y ejecutar `/spec-impl NN-juego-<id>`.
7. **Detente.** No implementes nada.

## Reglas

- Las reglas estrictas de `/spec` (`.claude/skills/spec/SKILL.md`, sección "Hard rules") también aplican aquí.
- Nunca escribas código ni migraciones: solo el `.md` de la spec.
- Nunca contradigas `reference/integration.md`. Si el juego necesita algo que el contrato no cubre (p. ej. un campo extra en el HUD React), la spec debe incluir el cambio del contrato como paso explícito y la decisión en la tabla de decisiones.
- No toques `saveScore`, `lib/scores.ts`, `lib/catalog.ts` ni `proxy.ts` en la spec salvo que el usuario lo pida: ya son genéricos.
- Un juego por spec. Si piden varios, una spec cada uno.
