# SPEC 06 — Catálogo de juegos en Supabase y leaderboard real

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-11-13
> **Objective:** Mover el catálogo de juegos a la tabla `public.games`, guardar las puntuaciones de jugadores con sesión en `public.scores` y mostrar rankings reales (mejor marca por jugador) en el Salón de la Fama y en el detalle de cada juego.

---

## Por qué existe esta spec

Hoy el catálogo vive en el array `GAMES` de `lib/data.ts` y todos los rankings son mock: `seededScores()` genera filas deterministas para `/salon` y `/juegos/[id]`, y `best` / `plays` son números fijos. El botón `GUARDAR PUNTUACIÓN` del modal `FIN DEL JUEGO` solo muestra un toast (SPEC 01, SPEC 05). SPEC 04 dejó `public.profiles` con lectura pública pensando en el ranking.

Esta spec convierte la promesa "compite por la mayor cantidad de puntos" en algo real: una sola fuente de verdad para el catálogo en la BD, puntuaciones ligadas al alias del jugador y rankings que se actualizan al guardar.

Con `cacheComponents: true`, las lecturas públicas (catálogo y rankings) se cachean con `"use cache"` usando un cliente Supabase **sin cookies**, y `saveScore` invalida con `updateTag` (ver `01-app/03-api-reference/04-functions/updateTag.md` y `cacheTag.md`). Así las páginas siguen prerenderizándose.

---

## Scope

**In:**

- Migración nueva con:
  - tabla `public.games` con los 8 juegos actuales como seed (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color` y orden);
  - tabla `public.scores` (una fila por partida guardada);
  - vistas `public.game_leaderboard` (mejor marca por jugador y juego, con puesto) y `public.game_stats` (`best` y `plays` por juego);
  - RLS: lectura pública de todo; insert en `scores` solo para `authenticated` con `user_id = auth.uid()`; sin update ni delete.
- Cliente Supabase público sin cookies `lib/supabase/public.ts`, apto para `"use cache"`.
- Lecturas cacheadas en `lib/catalog.ts` (`getGames`, `getGame`) y `lib/scores.ts` (`getLeaderboard`, `getAllLeaderboards`, `getGameStats`), con `cacheTag("games")` y `cacheTag("scores")`.
- `GAMES`, `getGame` y `seededScores` desaparecen de `lib/data.ts`. Toda la app lee el catálogo desde `lib/catalog.ts`: home (preview de 6), Biblioteca, detalle, reproductor, Salón y `generateStaticParams`.
- `best` y `plays` dejan de ser campos del juego y se calculan desde `scores`: `best` = máxima puntuación guardada, `plays` = número de puntuaciones guardadas. Sin puntuaciones: `best` se muestra `—` y `plays` `0`.
- Guardar puntuación desde **todos** los juegos (ASTEROIDES y los 7 simulados) con la Server Action `saveScore` en `app/juegos/[id]/jugar/actions.ts`.
- Modal `FIN DEL JUEGO`:
  - con sesión: input de nombre de solo lectura con el alias en mayúsculas y botón `GUARDAR PUNTUACIÓN`;
  - sin sesión: en lugar del input y el botón, texto `INICIA SESIÓN PARA GUARDAR` con link a `/auth` (la partida no se conserva);
  - pendiente: botón deshabilitado `GUARDANDO…` con el `.spinner` existente;
  - éxito: toast `▸ PUNTUACIÓN GUARDADA · PUESTO #N_`, donde `N` es el puesto del jugador en el ranking de ese juego; el botón no vuelve a aparecer hasta la siguiente partida;
  - error: línea `[ERR] …` en magenta sobre el botón, que sigue disponible para reintentar;
  - puntuación `0`: el botón queda deshabilitado con el texto `SIN PUNTOS QUE GUARDAR`.
- `saveScore` llama a `updateTag("scores")`: el Salón, el detalle, las tarjetas y los stats muestran la nueva marca en la siguiente petición.
- Salón de la Fama `/salon`: pestañas por juego (desde `public.games`), podio y tabla con el top **12** real. Podio con huecos `---` si hay menos de 3 jugadores.
- Detalle `/juegos/[id]`: bloque `MEJORES PUNTUACIONES` con el top **10** real; `Partidas` y `Mejor global` con `game_stats`.
- Estado vacío en Salón y detalle: `SIN PUNTUACIONES TODAVÍA · SÉ EL PRIMERO` y botón `JUGAR` al reproductor del juego.
- `proxy.ts` valida `/juegos/:id` y `/juegos/:id/jugar` consultando `public.games` (solo en esas rutas). Si la consulta falla, deja pasar y la página usa `notFound()`. Sin variables de entorno el catálogo está vacío y responde 404.
- Diseño de estados nuevos (estado vacío, huecos del podio, toast con puesto, texto sin sesión) con `/frontend-design`, reutilizando las clases existentes.

**Out of scope (para specs futuras):**

- Widgets de la home `RECENT_SCORES` ("puntuaciones recientes") y `TOP_PLAYERS_TODAY`: siguen mock.
- Anti-trampas real (validación de la partida en servidor, firmas, replays). Solo hay límites por `CHECK` y RLS.
- Edge Functions y RPC para escribir puntuaciones.
- Realtime (ranking en vivo).
- Guardar como invitado y conservar la partida tras iniciar sesión.
- Filtros por periodo (hoy, semana, mes) y ranking global multi-juego.
- Mostrar la posición propia fuera del top en el Salón o el detalle.
- Página de perfil o historial de partidas del jugador.
- Administrar el catálogo (alta, baja, edición) desde la app.
- Tipos TypeScript generados del esquema (`database.types.ts`).
- Tests.

---

## Modelo de datos

### Base de datos — `supabase/migrations/<timestamp>_create_games_and_scores.sql`

```sql
create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]{1,32}$'),
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,           -- clase CSS: "cover-bricks"
  color      text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  sort_order smallint not null unique, -- orden del catálogo (1..8, el actual de GAMES)
  created_at timestamptz not null default now()
);

create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  score      integer not null check (score between 1 and 9999999),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_user_game_idx  on public.scores (user_id, game_id);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public"  on public.games  for select to anon, authenticated using (true);
create policy "scores_select_public" on public.scores for select to anon, authenticated using (true);
create policy "scores_insert_own"    on public.scores for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Sin políticas de update/delete en ninguna de las dos tablas.

-- Vistas con security_invoker = true (respetan RLS de quien consulta).
-- game_leaderboard: una fila por (game_id, user_id) con su mejor marca.
--   columnas: game_id, user_id, username, score, achieved_at, rank
--   rank = row_number() over (partition by game_id order by score desc, achieved_at asc)
--   achieved_at = created_at de la primera partida que logró esa marca.
-- game_stats: una fila por juego (left join, incluye juegos sin partidas).
--   columnas: game_id, best (integer | null), plays (integer, 0 sin partidas)

-- insert into public.games (...) values (...8 filas con los datos actuales de GAMES...);
```

- Desempate: a igual puntuación, gana quien la logró antes.
- `plays` cuenta puntuaciones **guardadas**, no partidas jugadas.
- Borrar un usuario borra su perfil y, en cascada, sus puntuaciones.

### TypeScript — `lib/catalog.ts` (`import "server-only"`)

```ts
export interface Game {
  id: string; title: string; short: string; long: string;
  cat: Category; cover: string; color: GameColor;
}
export function getGames(): Promise<Game[]>;              // "use cache", cacheTag("games"), cacheLife("days"); orden sort_order
export function getGame(id: string): Promise<Game | undefined>; // filtra sobre getGames()
```

- `Category`, `CategoryFilter`, `GameColor` y `CATS` se quedan en `lib/data.ts`. La interfaz `Game` se mueve a `lib/catalog.ts` sin `best` ni `plays`.
- Sin variables de Supabase, `getGames()` devuelve `[]`. Ante un error de Supabase, **lanza** (no se cachea un catálogo vacío por un fallo).

### TypeScript — `lib/scores.ts` (`import "server-only"` salvo los tipos)

```ts
export interface LeaderboardRow { rank: number; name: string; score: number; date: string } // name en mayúsculas, date "dd/mm/yyyy" (UTC)
export interface GameStats { best: number | null; plays: number }

export const LEADERBOARD_SIZE = { salon: 12, detail: 10 } as const;
export const SCORE_MAX = 9_999_999;

export function getLeaderboard(gameId: string, limit: number): Promise<LeaderboardRow[]>;       // "use cache", cacheTag("scores")
export function getAllLeaderboards(limit: number): Promise<Record<string, LeaderboardRow[]>>;   // una query: rank <= limit
export function getGameStats(): Promise<Record<string, GameStats>>;                            // "use cache", cacheTag("scores")
```

- `cacheLife("hours")` en las tres; la frescura real la da `updateTag("scores")`.
- Sin variables de Supabase devuelven vacío (`[]`, `{}`). Ante error, lanzan.

### Server Action — `app/juegos/[id]/jugar/actions.ts` (`"use server"`)

```ts
export type SaveScoreErrorCode = "VALIDATION" | "CONFIG" | "UNAUTHENTICATED" | "GAME_NOT_FOUND" | "DB";

export type SaveScoreState =
  | { status: "idle" }
  | { status: "saved"; rank: number; id: number }
  | { status: "error"; code: SaveScoreErrorCode; message: string; id: number };

export function saveScore(prev: SaveScoreState, formData: FormData): Promise<SaveScoreState>; // campos: gameId, score
```

- `id` es `Date.now()` en servidor, igual que en SPEC 03 y SPEC 04.
- Valida `score` entero en `1..SCORE_MAX`, obtiene el usuario con `getClaims()`, inserta con el cliente de sesión (`lib/supabase/server.ts`), llama a `updateTag("scores")` y lee `rank` de `game_leaderboard` para ese `game_id` y `user_id`.
- Errores de Supabase: FK de `game_id` (`23503`) → `GAME_NOT_FOUND`; cualquier otro → `DB`, con `console.error` del detalle.

| `code` | Mensaje |
| --- | --- |
| `VALIDATION` | `[ERR] Puntuación inválida.` |
| `CONFIG` | `[ERR] Servicio de puntuaciones no configurado.` |
| `UNAUTHENTICATED` | `[ERR] Tu sesión expiró. Inicia sesión para guardar.` |
| `GAME_NOT_FOUND` | `[ERR] Ese juego no existe.` |
| `DB` | `[ERR] No se pudo guardar. Inténtalo de nuevo.` |

### Cliente público — `lib/supabase/public.ts` (`import "server-only"`)

```ts
export function createPublicClient(): SupabaseClient | null; // supabase-js con publishable key, auth.persistSession = false, sin cookies; null sin env
```

---

## Estructura de archivos

```
supabase/migrations/
  <timestamp>_create_games_and_scores.sql   (nuevo: tablas, índices, RLS, vistas, seed de 8 juegos)
lib/
  data.ts                    (modificar: quitar GAMES, Game, getGame, ScoreRow y seededScores)
  catalog.ts                 (nuevo, server-only: Game, getGames, getGame)
  scores.ts                  (nuevo: tipos, límites y lecturas cacheadas de rankings y stats)
  supabase/public.ts         (nuevo, server-only: createPublicClient)
proxy.ts                     (modificar: valida ids de juego contra public.games)
app/
  page.tsx                   (modificar: preview de 6 juegos desde getGames + stats)
  biblioteca/page.tsx        (modificar: pasa games y stats a <Library/>)
  salon/page.tsx             (modificar: getGames + getAllLeaderboards → <HallOfFame/>)
  juegos/[id]/page.tsx       (modificar: getGame, getLeaderboard(10), getGameStats, estado vacío)
  juegos/[id]/jugar/
    page.tsx                 (modificar: getGame, pasa hasSession a GamePlayer)
    actions.ts               (nuevo, "use server": saveScore)
components/
  library.tsx                (modificar: recibe games y stats por props)
  game-card.tsx              (modificar: recibe stats; best "—" sin puntuaciones)
  hall-of-fame.tsx           (modificar: recibe games y leaderboards por props; podio con huecos; estado vacío)
  leaderboard.tsx            (modificar: LeaderboardRow; estado vacío con JUGAR)
  game-player.tsx            (modificar: modal con useActionState(saveScore), estados sin sesión / pendiente / error / guardado)
app/globals.css              (modificar: estilos de estado vacío, huecos del podio y texto sin sesión)
```

---

## Plan de implementación

1. Crear la migración con `npx supabase migration new create_games_and_scores`: tablas, índices, RLS, vistas y seed de los 8 juegos copiados de `GAMES`. Aplicar con `npx supabase db push`. Verificar: `list_tables` muestra `games` (8 filas) y `scores` con RLS activado, y `get_advisors` (security) no reporta avisos sobre tablas ni vistas nuevas.
2. Crear `lib/supabase/public.ts`. Verificar: `npx tsc --noEmit` pasa.
3. Crear `lib/catalog.ts` con `getGames` / `getGame` cacheados. Migrar a él `generateStaticParams`, `generateMetadata` y las páginas de detalle y reproductor. Verificar: `/juegos/asteroides` y `/juegos/asteroides/jugar` se ven igual que antes.
4. Migrar la home (preview de 6), `/biblioteca` (`Library` recibe `games` por props) y `/salon` (pestañas) a `getGames()`. Quitar `GAMES`, `Game` y `getGame` de `lib/data.ts`. Hasta el paso 6, las tarjetas y el detalle muestran `best` `—` y `plays` `0`. Verificar: `npx tsc --noEmit` pasa y no queda ningún import de `GAMES`.
5. Modificar `proxy.ts`: en rutas `/juegos/:id(/jugar)`, consultar `games` por id con el cliente de `updateSession`; si no existe (o no hay env), reescribir a `/_juego-no-encontrado`; si la consulta falla, dejar pasar. Verificar: `/juegos/no-existe` da 404 y `/juegos/caida` 200.
6. Crear `lib/scores.ts` con `getGameStats` y conectarlo a `GameCard` (home y Biblioteca) y al `stat-strip` del detalle. Verificar: con `scores` vacía, `Mejor global` muestra `—` y `Partidas` `0`.
7. Añadir `getLeaderboard` y `getAllLeaderboards`. Conectar el detalle (top 10) y el Salón (top 12, `HallOfFame` recibe los datos por props y mantiene las pestañas en cliente). Quitar `ScoreRow` y `seededScores` de `lib/data.ts`. Diseñar con `/frontend-design` el estado vacío y los huecos `---` del podio. Verificar: ambos muestran `SIN PUNTUACIONES TODAVÍA · SÉ EL PRIMERO`.
8. Crear `app/juegos/[id]/jugar/actions.ts` con `saveScore` (validación, `getClaims`, insert, `updateTag("scores")`, lectura de `rank`, mapeo de errores). Verificar: `npx tsc --noEmit` pasa.
9. Modificar `app/juegos/[id]/jugar/page.tsx` para pasar `hasSession` a `GamePlayer` (ya lee `getSessionProfile`), y `components/game-player.tsx` para que el modal use `useActionState(saveScore)` con sus estados: sin sesión, `SIN PUNTOS QUE GUARDAR`, `GUARDANDO…`, `[ERR] …` y toast con puesto. Reiniciar la partida (`JUGAR DE NUEVO` o Espacio en ASTEROIDES) reinicia el estado del modal. Diseñar el texto sin sesión y el toast con `/frontend-design`. Verificar: guardar una partida de `caida` hace aparecer al jugador en `/salon` y en `/juegos/caida`.
10. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [x] `supabase/migrations/` contiene la migración nueva y `npx supabase db push` no reporta cambios pendientes.
- [x] `public.games` tiene 8 filas con los mismos `id`, títulos, descripciones, categoría, portada, color y orden que el antiguo `GAMES`.
- [x] `public.games` y `public.scores` tienen RLS activado y `get_advisors` (security) no reporta avisos sobre ellas ni sobre las vistas.
- [x] El código ya no contiene `GAMES`, `seededScores` ni los campos `best` / `plays` como datos fijos.
- [x] Home, Biblioteca, detalle, reproductor y pestañas del Salón muestran los 8 juegos en el mismo orden que antes.
- [x] `/juegos/no-existe` y `/juegos/no-existe/jugar` responden 404; `/juegos/{id válido}` y `/juegos/{id válido}/jugar` responden 200.
- [x] Con `scores` vacía, el Salón y el detalle muestran `SIN PUNTUACIONES TODAVÍA · SÉ EL PRIMERO` con botón `JUGAR`, y las tarjetas y el detalle muestran `best` `—` y `Partidas` `0`.
> **Pendientes de verificación manual:** los criterios sin marcar requieren una sesión real en el navegador o rankings con varios jugadores. RLS, `CHECK`, FK, vista `game_leaderboard` y `game_stats` se verificaron con SQL en una transacción revertida; la validación y `UNAUTHENTICATED` de `saveScore`, por HTTP.

- [ ] Sin sesión, el modal `FIN DEL JUEGO` muestra `INICIA SESIÓN PARA GUARDAR` con link a `/auth` y no muestra el botón `GUARDAR PUNTUACIÓN`.
- [ ] Con sesión, el input del modal muestra el alias en mayúsculas y no es editable.
- [ ] Con puntuación `0`, el botón muestra `SIN PUNTOS QUE GUARDAR` y está deshabilitado.
- [ ] Durante el guardado el botón muestra `GUARDANDO…`, está deshabilitado y un segundo click no crea otra fila.
- [ ] Guardar crea exactamente una fila en `public.scores` con el `user_id` de la sesión, el `game_id` del juego y la puntuación mostrada en el modal.
- [ ] Tras guardar se muestra `▸ PUNTUACIÓN GUARDADA · PUESTO #N_` con el puesto que luego aparece en el Salón para ese jugador y juego.
- [ ] Tras guardar, el botón no reaparece hasta empezar una partida nueva.
- [ ] Se puede guardar desde ASTEROIDES y desde un juego simulado (p. ej. `caida`).
- [ ] Tras guardar, `/salon` y `/juegos/{id}` muestran la nueva marca en la siguiente carga, sin esperar a que expire la caché.
- [x] Un jugador con varias partidas guardadas en un juego aparece una sola vez en su ranking, con su mejor marca.
- [ ] A igual puntuación, aparece primero quien la logró antes.
- [ ] El Salón muestra como máximo 12 filas por juego y el detalle como máximo 10.
- [ ] Con 1 o 2 jugadores en un juego, el podio muestra `---` en los puestos vacíos.
- [x] `Mejor global` del detalle y de la tarjeta coincide con el `#01` del ranking; `Partidas` coincide con el número de filas de `scores` del juego.
- [x] Un insert directo con la publishable key y un `user_id` ajeno, o sin sesión, es rechazado por RLS.
- [x] Un `update` o `delete` directo sobre `scores` o `games` con la publishable key no modifica ninguna fila.
- [x] Llamar a `saveScore` con `score` `0`, negativo, decimal o mayor que `9999999` devuelve `[ERR] Puntuación inválida.` sin insertar.
- [x] Si la sesión expira antes de guardar, el modal muestra `[ERR] Tu sesión expiró. Inicia sesión para guardar.`
- [x] Sin variables de Supabase, la app navega sin errores, la Biblioteca y el Salón muestran estado vacío y el detalle de cualquier id responde 404.
- [x] Los widgets `RECENT_SCORES` y `TOP_PLAYERS_TODAY` de la home se ven igual que antes.
- [x] La jugabilidad de ASTEROIDES (SPEC 05) y la simulación de los demás juegos no cambian.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Catálogo completo en `public.games` | Tabla mínima solo para FK / pantalla visual | Decisión del usuario: una sola fuente de verdad en la BD. |
| Seed de los 8 juegos dentro de la migración | `supabase/seed.sql` | El catálogo es dato de producción, no de prueba; `db push` lo aplica. |
| Guardar desde todos los juegos | Solo ASTEROIDES | Decisión del usuario. Los juegos simulados generan puntuaciones "falsas"; se acepta mientras se portan los reales. |
| Mejor marca por jugador en el ranking | Todas las partidas | Decisión del usuario: un jugador no acapara el top. Se guardan todas las partidas igualmente. |
| Vistas `security_invoker` para ranking y stats | Calcular en TypeScript / RPC | El agregado vive en SQL, respeta RLS y es una sola query. |
| Desempate por fecha más antigua | Sin desempate / por alias | Premia a quien llegó primero; el orden es estable. |
| Server Action + RLS + `CHECK` | RPC `security definer` / Edge Function | Decisión del usuario. Mismo patrón que SPEC 03/04; anti-trampas real queda fuera. |
| Guardar requiere sesión | Invitados con nombre libre | Decisión del usuario: evita spam y suplantación de alias. |
| Input del modal de solo lectura con el alias | Iniciales libres | El nombre del ranking es el alias de `profiles`; un nombre editable no se guardaría. |
| `best` / `plays` calculados de `scores` | Columnas mock en `games` | Decisión del usuario: los números deben ser reales. |
| `plays` = puntuaciones guardadas | Partidas jugadas | No se registran partidas sin guardar; sería otra tabla. |
| Ranking vacío al arrancar | Seed con jugadores ficticios | Decisión del usuario; crear usuarios falsos en `auth.users` es frágil. |
| Proxy consulta `games` solo en `/juegos/*` | Lista de ids en código / quitar validación | Decisión del usuario: una sola fuente de verdad y 404 real. |
| Proxy deja pasar si la consulta falla | Responder 404 o 500 | Un fallo de red no debe ocultar juegos válidos; la página tiene `notFound()`. |
| Sin variables de Supabase el proxy responde 404 | Dejar pasar | Ajuste durante la implementación: sin env el catálogo está vacío, así que ningún juego existe; cumple el criterio de 404 sin variables. |
| Toast sin puesto si no se puede leer `rank` tras guardar | Reportar error | Ajuste durante la implementación: la puntuación ya quedó guardada; se muestra `▸ PUNTUACIÓN GUARDADA_`. |
| `"use cache"` + `cacheTag` + `updateTag("scores")` | Todo dinámico en `<Suspense>` | Decisión del usuario: prerender y lectura inmediata de lo propio. |
| Un solo tag `scores` | Tag por juego `scores:{id}` | El Salón lee todos los juegos a la vez; un tag simplifica sin coste relevante con 8 juegos. |
| Cliente público sin cookies para lecturas | Cliente de sesión | `cookies()` no puede usarse dentro de `"use cache"`; los datos son públicos. |
| Las lecturas lanzan ante error de Supabase | Devolver vacío | No se cachea un ranking o catálogo vacío por un fallo transitorio. |
| `getAllLeaderboards` en una query para el Salón | Una query por pestaña | Las pestañas cambian en cliente sin esperas. |
| Toast con puesto del jugador | Toast simple | Decisión del usuario: refuerza la competición. |
| Una vez por partida; `0` no se guarda | Guardar varias veces | Evita duplicados y filas sin valor. |
| Salón 12, detalle 10 | Salón 50 | Decisión del usuario: mismo diseño que los mocks. |
| Fecha `dd/mm/yyyy` en UTC | Zona horaria del visitante | El render es en servidor y cacheado; el mismo HTML para todos. |
| Tipos escritos a mano | `database.types.ts` | Coherente con SPEC 04; dos tablas aún no lo justifican. |
| Widgets de la home siguen mock | Conectarlos | Decisión del usuario: fuera de esta spec. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Cualquiera puede enviar una puntuación inventada a `saveScore` o con la publishable key. | `CHECK` de rango, RLS por `auth.uid()` y sesión obligatoria. Anti-trampas real queda explícitamente fuera. |
| Los juegos simulados llenan el ranking de puntuaciones que no reflejan habilidad. | Aceptado por el usuario; se resolverá al portar cada juego real. |
| Sin variables de Supabase, `getGames()` devuelve `[]` y `generateStaticParams` queda vacío, lo que Cache Components puede rechazar en el build. | `generateStaticParams` devuelve un id centinela (`__none__`) cuando el catálogo está vacío; el proxy y `notFound()` lo tratan como 404. Se verifica en el criterio de build sin variables. |
| Si Supabase no responde durante el build, el build falla. | Comportamiento deseado: no se publica un catálogo vacío. Las lecturas lanzan en vez de devolver vacío. |
| La consulta del proxy añade latencia a `/juegos/*`. | Solo en esas rutas, por clave primaria; si falla, deja pasar. |
| Usar el cliente de sesión dentro de `"use cache"` rompe el build o filtra datos entre usuarios. | Lecturas siempre con `createPublicClient()` (sin cookies); el cliente de sesión solo en `saveScore` y el proxy. |
| Las vistas con `security definer` implícito saltarían RLS. | `with (security_invoker = true)` en ambas y revisión con `get_advisors`. |
| El puesto del toast no coincide con el Salón si otro jugador guarda justo después. | Aceptado: el puesto es el del momento del guardado. |
| Quitar `GAMES` rompe imports que no estén en la lista de archivos. | El paso 4 verifica con `tsc` que no queda ningún import. |
| Doble click o reenvío crea dos filas. | Botón deshabilitado durante el envío y oculto tras guardar; criterio dedicado. |

---

## Lo que **no** entra en esta spec

- Widgets `RECENT_SCORES` y `TOP_PLAYERS_TODAY` reales.
- Anti-trampas, RPC y Edge Functions.
- Realtime.
- Guardar como invitado o conservar la partida tras el login.
- Filtros por periodo y ranking global.
- Posición propia fuera del top, perfil e historial.
- Administración del catálogo.
- Tipos generados.
- Tests.

Cada uno de estos, si llega, va en su propia spec.
