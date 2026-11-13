# SPEC 04 — Supabase y autenticación con correo y contraseña

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-12
> **Objective:** Integrar Supabase en la app con `@supabase/ssr` y conectar `/auth` a Supabase Auth (registro con confirmación de correo, inicio y cierre de sesión), guardando el alias del jugador en `public.profiles`.

---

## Por qué existe esta spec

Hoy `/auth` es puramente visual (SPEC 01) y el nav siempre muestra "Iniciar Sesión" (SPEC 02). El proyecto Supabase `mvznnvlgnqwqlwqrmxtt` ya está conectado por MCP (`.mcp.json`), pero el esquema `public` está vacío y no hay paquetes `@supabase/*` instalados. Esta spec monta la base que necesitarán las specs siguientes (puntuaciones, Salón de la Fama real, Realtime, Edge Functions): clientes de Supabase, refresco de sesión en `proxy.ts`, migraciones versionadas y una identidad de jugador (`profiles`).

Con `cacheComponents: true`, leer la sesión (cookies) es dato de petición: todo lo que dependa del usuario va detrás de `<Suspense>` (ver `01-app/02-guides/authentication-with-cache-components.md`).

---

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`, y `supabase` (CLI) como devDependency.
- Cliente de servidor `lib/supabase/server.ts` y helper de sesión para el proxy `lib/supabase/proxy.ts`.
- `proxy.ts` refresca la sesión de Supabase en todas las rutas de página, conservando la validación de ids de `/juegos/:id` existente.
- `proxy.ts` redirige `/auth` → `/biblioteca` si ya hay sesión.
- Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example` y README.
- Supabase CLI inicializado (`supabase/config.toml`) y primera migración `supabase/migrations/<timestamp>_create_profiles.sql`:
  - tabla `public.profiles` con `username` único;
  - RLS activado, lectura pública, sin escritura desde el cliente;
  - trigger que crea el perfil al registrarse un usuario en `auth.users`.
- Formulario de `/auth` funcional:
  - Tab "INICIAR SESIÓN": campos `CORREO ELECTRÓNICO` y `CONTRASEÑA` (el campo `Usuario` desaparece de este tab).
  - Tab "CREAR CUENTA": campos `USUARIO`, `CORREO ELECTRÓNICO` y `CONTRASEÑA`.
  - Server Actions `signIn`, `signUp` y `signOut` en `app/auth/actions.ts`.
  - Estado pendiente: botón deshabilitado `CONECTANDO…` con el `.spinner` existente.
  - Error: línea `[ERR] …` en magenta sobre el botón, conservando lo escrito (salvo la contraseña).
  - Registro exitoso: terminal `.terminal-success` de SPEC 03 con `REVISA TU CORREO` y el email usado.
- Confirmación de correo en `app/auth/confirm/route.ts` (`verifyOtp` con `token_hash`), que abre sesión y redirige a `/biblioteca`.
- Enlace de confirmación inválido o expirado → `/auth?error=confirm`, con el mensaje `[ERR] El enlace de confirmación no es válido o expiró.`
- Login exitoso → redirect a `/biblioteca`.
- Nav con sesión: el botón "Iniciar Sesión" se reemplaza por el alias del jugador en mayúsculas y un botón `SALIR`, en desktop y panel móvil. `SALIR` cierra sesión y redirige a `/`.
- Validación compartida cliente/servidor en `lib/auth.ts` (alias, correo, contraseña).
- Configuración manual del dashboard de Supabase documentada en el README (Site URL, Redirect URLs, plantilla "Confirm signup").

**Out of scope (para specs futuras):**

- Realtime (p. ej. actividad en vivo, ranking en vivo) y Edge Functions. Llegarán en specs propias.
- Cliente de navegador `lib/supabase/client.ts`: se crea cuando la spec de Realtime lo necesite.
- OAuth (Google, GitHub) y "JUGAR COMO INVITADO" (anonymous sign-in): los botones quedan visuales, sin función.
- Recuperación / cambio de contraseña.
- Página de perfil y edición del alias.
- Proteger rutas (p. ej. `/juegos/[id]/jugar`) y parámetro `?next=` en el login.
- Puntuaciones, Salón de la Fama y créditos reales (`CRÉDITOS · 03` sigue mock).
- Tipos TypeScript generados del esquema (`database.types.ts`).
- Secret key / service role y cliente admin.
- SMTP propio, rate limiting o captcha propios (se usan los límites por defecto de Supabase Auth).
- Tests.

---

## Modelo de datos

### Base de datos — `supabase/migrations/<timestamp>_create_profiles.sql`

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lectura pública (servirá al ranking). Sin políticas de insert/update/delete.
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);

-- handle_new_user(): security definer, set search_path = '',
-- inserta (new.id, new.raw_user_meta_data ->> 'username') en public.profiles.
-- Trigger: after insert on auth.users for each row.
```

- `username` se guarda siempre en minúsculas. El `CHECK` lo garantiza, así que `unique` ya es insensible a mayúsculas en la práctica.
- Si el alias del metadata viola el `CHECK` o el `unique`, el trigger falla y Supabase no crea el usuario.

### TypeScript — `lib/auth.ts` (sin `"use server"`, importable desde cliente y servidor)

```ts
export const AUTH_LIMITS = { username: { min: 3, max: 16 }, email: 254, password: { min: 8, max: 72 } } as const;
export const USERNAME_RE = /^[a-z0-9_]{3,16}$/;

export interface SignInInput { email: string; password: string }
export interface SignUpInput extends SignInInput { username: string } // username ya en minúsculas

export type AuthErrorCode =
  | "VALIDATION" | "CONFIG" | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED" | "USERNAME_TAKEN" | "RATE_LIMIT" | "AUTH";

export type AuthState =
  | { status: "idle" }
  | { status: "signup-sent"; email: string; id: number }
  | { status: "error"; code: AuthErrorCode; message: string; id: number };

export function validateSignIn(raw: { email: unknown; password: unknown }):
  { ok: true; data: SignInInput } | { ok: false; message: string };
export function validateSignUp(raw: { username: unknown; email: unknown; password: unknown }):
  { ok: true; data: SignUpInput } | { ok: false; message: string };
```

- `id` es `Date.now()` en servidor, igual que en SPEC 03.
- El login exitoso no devuelve estado: la acción hace `redirect("/biblioteca")`.

Mensajes `[ERR]` por código:

| `code` | Mensaje |
| --- | --- |
| `VALIDATION` | `[ERR] Datos inválidos: {detalle de validate*}` |
| `CONFIG` | `[ERR] Servicio de autenticación no configurado.` |
| `INVALID_CREDENTIALS` | `[ERR] Correo o contraseña incorrectos.` |
| `EMAIL_NOT_CONFIRMED` | `[ERR] Confirma tu correo antes de entrar.` |
| `USERNAME_TAKEN` | `[ERR] Ese usuario ya está en uso.` |
| `RATE_LIMIT` | `[ERR] Demasiados intentos. Espera unos minutos.` |
| `AUTH` | `[ERR] El servidor de autenticación no respondió.` |

### Sesión — `lib/session.ts` (`import "server-only"`)

```ts
export interface SessionProfile { id: string; username: string }
export function getSessionProfile(): Promise<SessionProfile | null>;
```

- Usa `supabase.auth.getClaims()` para el id y lee `username` de `public.profiles`.
- Devuelve `null` sin sesión, sin variables de entorno o ante cualquier error. Nunca lanza.

### Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=                # obligatoria; https://mvznnvlgnqwqlwqrmxtt.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=    # obligatoria; sb_publishable_...
SUPABASE_DB_PASSWORD=                    # solo CLI (supabase db push); ya existe en .env.local
```

Sin las dos primeras: el build pasa, el proxy deja pasar las peticiones sin refrescar sesión, el nav muestra "Iniciar Sesión" y las acciones devuelven `CONFIG`.

---

## Estructura de archivos

```
app/
  layout.tsx               (modificar: pasa al Nav los slots de cuenta envueltos en <Suspense>)
  auth/
    page.tsx               (modificar: <AuthForm/> dentro de <Suspense>)
    actions.ts             (nuevo, "use server": signIn, signUp, signOut)
    confirm/route.ts       (nuevo: GET verifyOtp → /biblioteca | /auth?error=confirm)
components/
  auth-form.tsx            (modificar: campos por tab, useActionState, estados)
  nav.tsx                  (modificar: recibe slots `account` y `mobileAccount`)
  nav-account.tsx          (nuevo, server: alias + SALIR o link "Iniciar Sesión")
lib/
  auth.ts                  (nuevo: tipos, límites, validaciones)
  session.ts               (nuevo, server-only: getSessionProfile)
  supabase/
    env.ts                 (nuevo: lee y valida las dos variables NEXT_PUBLIC_SUPABASE_*)
    server.ts              (nuevo, server-only: createClient con cookies())
    proxy.ts               (nuevo: updateSession(request) para proxy.ts)
proxy.ts                   (modificar: updateSession + redirect /auth + validación de juegos)
supabase/
  config.toml              (nuevo: supabase init)
  migrations/<timestamp>_create_profiles.sql (nuevo)
.env.example               (modificar: variables de Supabase)
README.md                  (modificar: variables, CLI y configuración del dashboard)
package.json               (modificar: @supabase/supabase-js, @supabase/ssr, supabase dev)
```

---

## Plan de implementación

1. Instalar `@supabase/supabase-js` y `@supabase/ssr`, y `supabase` como devDependency. Verificar: `npm run build` pasa y `npx supabase --version` responde.
2. Añadir las variables a `.env.example` y documentarlas en el README. Rellenar `.env.local` con la URL y la publishable key (obtenibles por MCP con `get_project_url` / `get_publishable_keys`). Verificar: `git status` no muestra `.env.local`.
3. `npx supabase init` y `npx supabase link --project-ref mvznnvlgnqwqlwqrmxtt`. Verificar: existe `supabase/config.toml`.
4. `npx supabase migration new create_profiles` y escribir el SQL del modelo de datos. Aplicar con `npx supabase db push`. Verificar: `list_tables` muestra `public.profiles` con RLS activado y `get_advisors` (security) no reporta avisos sobre `profiles` ni `handle_new_user`.
5. Configurar el dashboard de Supabase y documentarlo en el README:
   - Site URL `http://localhost:3000` y Redirect URLs `http://localhost:3000/**`;
   - "Confirm email" activado;
   - plantilla "Confirm signup" con el enlace `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
6. Crear `lib/supabase/env.ts` y `lib/supabase/server.ts` (`createServerClient` con `getAll`/`setAll` de `cookies()`, creado dentro de cada llamada, nunca a nivel de módulo). Verificar: `npx tsc --noEmit` pasa.
7. Crear `lib/supabase/proxy.ts` con `updateSession(request)` y conectarlo en `proxy.ts`:
   - matcher para todas las rutas salvo `_next/static`, `_next/image`, `favicon.ico` y archivos estáticos;
   - la validación de `/juegos/:id` y `/juegos/:id/jugar` se mantiene igual, aplicada después de refrescar la sesión;
   - sin variables de entorno, `updateSession` devuelve `NextResponse.next()`.

   Verificar: `/juegos/no-existe` sigue dando 404 y el resto de rutas 200.
8. Crear `lib/auth.ts` con tipos, límites y validaciones. Verificar: `npx tsc --noEmit` pasa.
9. Crear `app/auth/actions.ts`:
   - `signUp`: valida, comprueba si el alias existe en `profiles` (→ `USERNAME_TAKEN`), llama a `auth.signUp` con `options.data.username` y devuelve `signup-sent`;
   - `signIn`: valida, llama a `auth.signInWithPassword` y hace `redirect("/biblioteca")`;
   - `signOut`: `auth.signOut()` y `redirect("/")`;
   - mapea errores de Supabase a `AuthErrorCode` por `error.code` (`invalid_credentials`, `email_not_confirmed`, `over_request_rate_limit` / `over_email_send_rate_limit`) y registra el detalle con `console.error`.
10. Actualizar `components/auth-form.tsx`: campos por tab, inputs controlados, `useActionState` con la acción del tab activo, estados pendiente / error / `signup-sent`. La contraseña se vacía tras un error. Cambiar de tab limpia el error.
11. Crear `app/auth/confirm/route.ts` (`verifyOtp({ type, token_hash })`) y mostrar en `AuthForm` el error `confirm` leído con `useSearchParams()`. Envolver `<AuthForm/>` en `<Suspense>` en `app/auth/page.tsx`.
12. Añadir a `proxy.ts` la redirección `/auth` → `/biblioteca` cuando `updateSession` detecta usuario (solo la ruta exacta `/auth`, nunca `/auth/confirm`).
13. Crear `lib/session.ts` y `components/nav-account.tsx` (variantes `desktop` y `mobile`). Con sesión: alias en mayúsculas + `<form action={signOut}>` con botón `SALIR`. Sin sesión: el link actual "Iniciar Sesión".
14. Modificar `components/nav.tsx` para recibir los slots `account` y `mobileAccount` (envolver el slot móvil en un contenedor con `onClick={close}`). En `app/layout.tsx`, pasar cada slot dentro de `<Suspense>` con un placeholder del mismo tamaño que el botón. Diseñar alias y `SALIR` con `/frontend-design`, reutilizando las clases del nav.
15. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build` termina sin errores con y sin variables de Supabase, sin avisos de "uncached data accessed outside of `<Suspense>`".
- [x] `npm run lint` y `npx tsc --noEmit` pasan sin errores.
- [x] `supabase/migrations/` contiene exactamente una migración y `npx supabase db push` no reporta cambios pendientes.
- [x] `public.profiles` existe con RLS activado y `get_advisors` (security) no reporta avisos sobre ella ni sobre `handle_new_user`.
- [x] En el tab "INICIAR SESIÓN" se ven solo `CORREO ELECTRÓNICO` y `CONTRASEÑA`; en "CREAR CUENTA", `USUARIO`, `CORREO ELECTRÓNICO` y `CONTRASEÑA`.
- [x] Crear cuenta con alias, correo y contraseña válidos muestra la terminal `REVISA TU CORREO` con ese correo, y llega un correo de confirmación.
- [x] Tras crear la cuenta existe una fila en `public.profiles` con el alias en minúsculas y el `id` del usuario.
- [x] El enlace del correo abre `/auth/confirm`, deja la sesión iniciada y termina en `/biblioteca`.
- [x] Un enlace de confirmación alterado o ya usado termina en `/auth?error=confirm` y muestra `[ERR] El enlace de confirmación no es válido o expiró.`
- [x] Registrar un alias ya existente (también con otras mayúsculas, p. ej. `NeonFox` vs `neonfox`) muestra `[ERR] Ese usuario ya está en uso.` y no crea usuario.
- [x] Un alias de 2 o 17 caracteres, o con caracteres fuera de `[a-z0-9_]` tras pasar a minúsculas, devuelve `VALIDATION`, también saltando la validación del cliente.
- [x] Una contraseña de menos de 8 caracteres devuelve `VALIDATION`.
- [x] Iniciar sesión antes de confirmar el correo muestra `[ERR] Confirma tu correo antes de entrar.`
- [x] Iniciar sesión con contraseña incorrecta muestra `[ERR] Correo o contraseña incorrectos.`, conserva el correo y vacía la contraseña.
- [x] Iniciar sesión con credenciales válidas redirige a `/biblioteca`.
- [x] Durante cualquier envío el botón muestra `CONECTANDO…`, está deshabilitado y un segundo click no dispara otra petición.
- [x] Con sesión, el nav muestra el alias en mayúsculas y `SALIR` en desktop y en el panel móvil, en todas las rutas; sin sesión muestra "Iniciar Sesión".
- [x] Recargar la página con sesión iniciada mantiene la sesión.
- [x] `SALIR` cierra la sesión, redirige a `/` y el nav vuelve a mostrar "Iniciar Sesión".
- [x] Con sesión, visitar `/auth` redirige a `/biblioteca`.
- [x] Sin variables de Supabase, la app navega sin errores, el nav muestra "Iniciar Sesión" y enviar el form muestra `[ERR] Servicio de autenticación no configurado.`
- [x] `/juegos/no-existe` sigue respondiendo 404 y `/juegos/{id válido}` 200.
- [x] Los botones `GOOGLE`, `GITHUB` y `JUGAR COMO INVITADO` siguen visibles y no hacen ninguna petición.
- [x] Ningún archivo de `.next/static` contiene `SUPABASE_DB_PASSWORD` ni una clave `sb_secret_`.
- [x] `.env.example` documenta las variables de Supabase y `.env.local` sigue ignorado.
- [x] Las pantallas de SPEC 01, SPEC 02 y SPEC 03 se ven igual que antes, salvo el área de cuenta del nav.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Infraestructura + Auth en una spec | Solo infraestructura / incluir puntuaciones | Decisión del usuario: Auth da un uso real a la infraestructura; puntuaciones es otro dominio. |
| Realtime y Edge Functions fuera, pero previstos | Incluirlos ya | El usuario los planea a futuro; la estructura `lib/supabase/` deja sitio para `client.ts` y `supabase/functions/`. |
| Sin `lib/supabase/client.ts` por ahora | Crearlo sin uso | Todo el flujo de Auth es servidor (Server Actions + proxy). Se crea con Realtime. |
| `@supabase/ssr` con cookies | `supabase-js` con localStorage | La sesión debe leerse en Server Components, acciones y proxy. |
| Refresco de sesión en `proxy.ts` | Refrescar solo en acciones | Los Server Components no pueden escribir cookies; el proxy mantiene el token vigente. |
| `getClaims()` para identificar al usuario | `getSession()` | `getSession()` no valida el JWT en servidor; `getClaims()` lo verifica. |
| Correo + contraseña para entrar | Usuario o correo | Nativo de Supabase, sin lookup usuario→email ni enumeración de cuentas. |
| Alias en `public.profiles` + trigger | Solo `user_metadata` | Garantiza unicidad y sirve de base para ranking y puntuaciones. |
| Lectura pública de `profiles`, sin escritura desde el cliente | Políticas de update propias | El alias no se edita en esta spec; menos superficie con RLS. |
| Alias `[a-z0-9_]{3,16}` en minúsculas con `CHECK` | Respetar mayúsculas + índice `lower()` | Una sola regla en cliente, servidor y SQL; el nav lo muestra en mayúsculas. |
| Pre-chequeo del alias + error del trigger mapeado a `USERNAME_TAKEN` | Solo uno de los dos | El pre-chequeo da el mensaje claro; el trigger cubre la carrera entre dos registros. |
| Confirmación de correo con `token_hash` en `/auth/confirm` | Sesión inmediata / flujo PKCE con `code` | Default seguro de Supabase; `token_hash` funciona aunque el correo se abra en otro navegador. |
| Supabase CLI + `supabase/migrations` | Cambios directos por MCP o dashboard | Esquema versionado y reproducible. El MCP queda para inspección y advisors. |
| Sin tipos generados | `database.types.ts` | Decisión del usuario: una tabla no lo justifica todavía. |
| Solo URL + publishable key | Secret key y cliente admin | Nada en esta spec necesita saltarse RLS. |
| Server Actions + `useActionState` | Route Handlers `/api/auth/*` | Mismo patrón que SPEC 03, con estado pendiente integrado. |
| Login redirige a `/biblioteca` | `/` o parámetro `next` | Coherente con "ENTRAR AL VAULT"; `next` llega con las rutas protegidas. |
| Redirect `/auth` con sesión en el proxy | Redirect en `page.tsx` | El proxy ya conoce al usuario; evita leer cookies en la página. |
| Slots del nav con `<Suspense>` desde el layout | Leer la sesión en el Nav cliente con `useEffect` | Patrón de Cache Components: el shell sigue estático y la cuenta se transmite. |
| OAuth e invitado quedan visuales | Ocultarlos / implementarlos | Decisión del usuario; cada uno irá en su spec. |
| Errores genéricos al usuario + `console.error` | Mostrar el error de Supabase | No filtra detalles de la cuenta ni del proyecto. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El SMTP por defecto de Supabase limita mucho los correos por hora; las pruebas de registro pueden bloquearse. | Mapear a `RATE_LIMIT` con mensaje claro. Documentar el límite en el README. SMTP propio queda fuera. |
| Con "Confirm email", registrar un correo ya existente devuelve éxito falso (anti-enumeración). | Se muestra la misma terminal `REVISA TU CORREO`. Comportamiento aceptado. |
| Si la plantilla "Confirm signup" no se cambia, el enlace no pasa por `/auth/confirm` y la sesión no llega a la app. | Paso 5 del plan y README con el enlace exacto. Criterio de aceptación dedicado. |
| El trigger `security definer` es superficie sensible. | `set search_path = ''`, nombres totalmente cualificados y revisión con `get_advisors`. |
| Ampliar el matcher de `proxy.ts` rompe la validación de juegos o añade latencia a estáticos. | La lógica de juegos se mantiene tras `updateSession`; el matcher excluye `_next` y archivos estáticos. Criterio de 404 dedicado. |
| Leer `cookies()` fuera de `<Suspense>` rompe el build con `cacheComponents`. | Toda lectura de sesión vive en `NavAccount` (dentro de `<Suspense>`), acciones, route handler y proxy. |
| El placeholder del slot de cuenta provoca salto visual al resolver la sesión. | Placeholder del mismo ancho y alto que el botón del nav. |
| Supabase CLI no está instalado globalmente en Windows. | Se instala como devDependency y se usa con `npx supabase`. |
| `SUPABASE_DB_PASSWORD` acaba en el bundle o en git. | Sin prefijo `NEXT_PUBLIC_`, nunca leída desde código de la app, `.env.local` ignorado. Criterio dedicado. |

---

## Lo que **no** entra en esta spec

- Realtime y Edge Functions.
- Cliente de navegador de Supabase.
- OAuth (Google, GitHub) y modo invitado.
- Recuperación y cambio de contraseña.
- Perfil de usuario y edición del alias.
- Rutas protegidas y parámetro `next`.
- Puntuaciones, Salón de la Fama y créditos reales.
- Tipos generados, secret key y cliente admin.
- SMTP propio, rate limiting o captcha propios.
- Tests.

Cada uno de estos, si llega, va en su propia spec.
