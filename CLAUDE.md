# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar juegos arcade online y competir por la mayor puntuación. Incluye landing, biblioteca con buscador y filtros, detalle de juego, reproductor con juegos reales en `<canvas>`, leaderboards por juego y Salón de la Fama, autenticación con Supabase y formulario de contacto con Resend.

La funcionalidad se construye con **Spec Driven Design**: cada cambio relevante nace como una spec en `specs/` y se implementa con `/spec-impl`.

## Comandos

```bash
npm run dev       # servidor de desarrollo (http://localhost:3000)
npm run build     # build de producción
npm run start     # servir el build
npm run lint      # ESLint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit  # chequeo de tipos

npx supabase migration new <accion>_<id>  # nueva migración en supabase/migrations/
npx supabase db push                      # aplica migraciones al proyecto enlazado (usa SUPABASE_DB_PASSWORD)
```

No hay framework de tests configurado todavía: la verificación es `lint` + `tsc` + prueba manual en el navegador.

## Skills

- **Usa siempre `/frontend-design` para diseñar interfaces de usuario** (también al dibujar el canvas de un juego nuevo).
- `/spec` y `/spec-impl` ([Klerith/fernando-skills](https://github.com/Klerith/fernando-skills)): crear una spec y luego implementarla. `/spec-impl` crea la rama `spec-NN-slug` automáticamente (`specs/.spec-config.yml` → `AutoCreateBranch: true`).
- `/nuevo-juego <carpeta de started-games o descripción>` (skill propia): genera una spec `Borrador` para integrar un juego real con catálogo y leaderboard. Es una especialización de `/spec`; su contrato técnico está en `.claude/skills/nuevo-juego/reference/integration.md`.
- Las skills viven en `.claude/skills/` y duplicadas en `.agents/skills/` (instaladas con `npx skills`, ver `skills-lock.json`). Si modificas una, mantén ambas copias iguales.

## Specs

`specs/NN-slug.md` con estados `Borrador` → `Aprobado` → `Implementado`. Las specs se escriben en español. Implementadas hasta ahora:

| Spec | Contenido |
| --- | --- |
| 01 | MVP de pantallas visuales (biblioteca, detalle, reproductor simulado, salón, auth) |
| 02 | Home / landing |
| 03 | Acerca de + formulario de contacto (Resend + React Email) |
| 04 | Auth con Supabase (registro, login, confirmación por email, `public.profiles`) |
| 05 | Primer juego real: ASTEROIDES |
| 06 | Catálogo en `public.games` y leaderboard en `public.scores` |
| 07 | Juego CAÍDA (bloques que caen; introduce `extra`/`hudExtras` en el HUD) |
| 08 | Juego BLOQUE BUSTER (rompe-ladrillos con niveles) |
| 09 | Juego SERPENTINA |

`references/resources/templates/` contiene el material de referencia de las specs: el prototipo HTML/JSX original (`Arcade Vault.html`, `*.jsx`, `styles.css`, `home-about/`) y `started-games/` (juegos JS de partida para portar: `02-asteroids`, `03-tetris`, `04-arkanoid`).

## Arquitectura

### Rutas (`app/`)

- `/` landing · `/biblioteca` catálogo · `/juegos/[id]` detalle + leaderboard · `/juegos/[id]/jugar` reproductor · `/salon` Salón de la Fama · `/acerca-de` contacto · `/auth` login/registro · `/auth/confirm` route handler del enlace de confirmación.
- Mutaciones con Server Actions junto a su ruta (`app/**/actions.ts`): `saveScore`, acciones de auth y `sendContactMessage`. Se usan con `useActionState` y revalidan todo en servidor.
- `proxy.ts` (equivalente al antiguo `middleware`): refresca la sesión de Supabase, redirige `/auth` → `/biblioteca` con sesión y valida `/juegos/:id(/jugar)` contra `public.games`, reescribiendo a una ruta inexistente para servir `app/not-found.tsx` con status 404 (con `cacheComponents`, `notFound()` llegaría tarde, tras el 200).

### Datos (`lib/`)

- `lib/supabase/`: `server.ts` (cliente con cookies, para Server Components/Actions), `public.ts` (cliente sin sesión, **el único válido dentro de `"use cache"`**), `proxy.ts` (sesión en el proxy) y `env.ts` (lee las variables en cada llamada).
- `lib/catalog.ts` (`getGames`/`getGame`, `cacheTag("games")`) y `lib/scores.ts` (rankings y stats, `cacheTag("scores")`; `saveScore` hace `updateTag`). `SCORE_MAX = 9_999_999`.
- `lib/session.ts`: perfil del jugador con sesión o `null`, nunca lanza.
- `lib/auth.ts`, `lib/contact.ts`: tipos y validación compartidos cliente/servidor (sin `"use server"`). `lib/resend.ts` + `emails/` envían el correo de contacto.
- `lib/data.ts`: tipos compartidos (`Category`, `GameColor`) y mocks de la home.
- Los módulos de servidor llevan `import "server-only"`.

### Base de datos (Supabase, `supabase/migrations/`)

`public.profiles` (creado por trigger al registrarse), `public.games` (catálogo; `id` = slug de la URL) y `public.scores`, más las vistas `game_leaderboard` y `game_stats`. Todo con RLS: lectura pública, inserción de scores solo del propio usuario. El MCP de Supabase está configurado en `.mcp.json`.

### Juegos reales (`lib/games/`)

- `types.ts` define el contrato (`GameEngine`, `GameSnapshot`, `RealGameDef`, `sameSnapshot`, `formatScore`). `registry.ts` mapea id de `public.games` → `RealGameDef`; un juego del catálogo que no está en el registro usa la simulación de SPEC 01.
- Registrados: `asteroides`, `caida`, `bloque-buster`, `serpentina`. Cada uno en `lib/games/<id>/` (`constants.ts`, `engine.ts`, `index.ts`, más archivos propios).
- `components/game-screen.tsx` monta el canvas y el motor; `components/game-player.tsx` pinta HUD, pausa y modal de fin de partida con guardado. **Añadir un juego no toca estas piezas**: solo su carpeta, una línea en el registro y, si cambia el catálogo, una migración.
- Reglas del motor (sin estado de módulo, fases `ready/playing/dead/gameover`, `onChange` solo al cambiar el snapshot, limpieza de listeners en `destroy()`, mundo lógico fijo, paleta de `globals.css`): ver `.claude/skills/nuevo-juego/reference/integration.md`.

## Stack y particularidades

- **Next.js 16.4 (App Router) + React 19.3 + TypeScript strict.** Las APIs difieren de versiones anteriores: consultar `node_modules/next/dist/docs/` (`01-app/`) antes de escribir código.
- **`next.config.ts` activa features que cambian el modelo de rendering/caching:**
  - `cacheComponents: true` — Cache Components / PPR: el data fetching dinámico (cookies, sesión) debe ir dentro de `<Suspense>` o cachearse con `"use cache"` + `cacheTag`/`cacheLife`. Ver `01-app/01-getting-started/08-caching.md`.
  - `partialPrefetching: true` — ver `01-app/02-guides/adopting-partial-prefetching.md`.
  - `experimental.agentFeedback: true` — ver `01-app/02-guides/ai-agents.md`.
- **Tailwind CSS v4** cargado vía la regla de Turbopack `@tailwindcss/turbopack` (no hay `postcss.config` ni `tailwind.config`). Los tokens de tema se definen con `@theme inline` en `app/globals.css`, que también contiene el CSS portado del prototipo (clases `cover-*`, `.crt-screen`, `.hud-stat`, etc.).
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) para auth y datos; **Resend** + **React Email** para el correo de contacto.
- Tipos globales de rutas generados por Next (p. ej. `LayoutProps<"/">`) sin import explícito.
- Alias de imports: `@/*` → raíz del repo.
- UI y textos en español.

## Variables de entorno

Copiar `.env.example` a `.env.local`. Todas son opcionales para el build: sin Supabase la app funciona sin sesión y con catálogo vacío; sin Resend el contacto responde "Servicio de correo no configurado.".

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable, nunca una secret key).
- `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (opcional) — solo servidor.
- `SUPABASE_DB_PASSWORD` — solo para la CLI de Supabase; la app no la lee.
