# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-11-10
> **Objective:** Portar a Next.js App Router las cinco pantallas de `references/resources/templates/` (Biblioteca, Detalle, Reproductor, Auth y Salón de la Fama) como interfaz puramente visual con datos mock, sin juegos reales ni persistencia.

---

## Por qué existe esta spec

El template de referencia es un prototipo HTML con React UMD, Babel en el navegador y un router por hash. Esta spec define cómo se traduce a la arquitectura real del proyecto (Next.js 16 + `cacheComponents`) sin perder fidelidad visual. El tema CSS ya está portado 1:1 en `app/globals.css` (commit `a3105b3`), así que el trabajo es de estructura y componentes, no de estilos.

---

## Scope

**In:**

- Rutas reales del App Router:
  - `/` → Biblioteca (hero, buscador, chips de categoría, grilla de tarjetas con efecto tilt, estado "NO HAY RESULTADOS").
  - `/juegos/[id]` → Detalle (portada, tags, descripción larga, stat-strip, acciones, leaderboard de 10 filas).
  - `/juegos/[id]/jugar` → Reproductor (HUD, arena CRT simulada, pausa, FIN, modal de fin de juego).
  - `/auth` → Auth (tabs Iniciar sesión / Crear cuenta, campos, botones invitado y sociales).
  - `/salon` → Salón de la Fama (tabs por juego, podio top 3, tabla de 12 filas).
- Nav (logo, links con estado activo, contador "CRÉDITOS · 03", botón "Iniciar Sesión", menú hamburguesa con panel móvil) y footer, compartidos en `app/layout.tsx`.
- Datos mock tipados en `lib/data.ts`: `GAMES`, `CATS`, `seededScores`.
- Simulación del reproductor idéntica al template: la puntuación sube sola cada 220 ms, el nivel sube cada ~2500 puntos, pausa/reanudar, botón FIN, modal con puntuación final, input de iniciales, "JUGAR DE NUEVO" y "VOLVER AL VAULT".
- "GUARDAR PUNTUACIÓN" muestra el toast `▸ PUNTUACIÓN GUARDADA_` sin persistir nada.
- Página 404 temática en `app/not-found.tsx`, usada cuando `/juegos/[id]` o `/juegos/[id]/jugar` reciben un id inexistente.

**Out of scope (para specs futuras):**

- Cualquier lógica de juego real (Bloque Buster, Caída, Serpentina, etc.).
- Autenticación real o mock: no hay sesión, ni `av_user`, ni cambio del nav tras "login".
- Persistencia de puntuaciones (`av_scores`, base de datos o API).
- La fila "TU MEJOR MARCA" del Salón de la Fama (requiere usuario).
- Botón de usuario con nombre (`{user.name} ▾`) y cierre de sesión en el nav.
- Login social (Google / GitHub).
- Sistema de créditos funcional (el contador es texto fijo).
- Framework de tests.

---

## Modelo de datos

Todo vive en `lib/data.ts`, migrado desde `references/resources/templates/data.jsx` con los mismos valores.

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CategoryFilter = "TODOS" | Category;
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;          // slug usado en la URL: "bloque-buster"
  title: string;       // "BLOQUE BUSTER"
  short: string;       // descripción corta de la tarjeta
  long: string;        // descripción larga del detalle
  cat: Category;
  cover: string;       // clase CSS de portada: "cover-bricks"
  color: GameColor;    // color del botón JUGAR
  best: number;        // mejor puntuación global
  plays: string;       // "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;        // "dd/mm/2026"
}

export const GAMES: Game[];             // los 8 juegos del template
export const CATS: CategoryFilter[];    // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]
export function seededScores(seed: number, count?: number): ScoreRow[];
export function getGame(id: string): Game | undefined;
```

Convenciones:

- `seededScores` es determinista (mismo seed → mismas filas), por lo que puede ejecutarse en servidor sin romper la hidratación.
- Semillas idénticas al template: Detalle usa `id.length * 17 + 3` con 10 filas; Salón usa `id.length * 23 + 7` con 12 filas.
- Números formateados con `toLocaleString("es-ES")`.

No hay persistencia: ningún dato sobrevive ni se escribe entre sesiones.

---

## Estructura de archivos

```
app/
  layout.tsx                 (modificar: añadir <Nav />, <main className="av-main">, <Footer />)
  page.tsx                   (reemplazar: Biblioteca)
  not-found.tsx              (nuevo)
  auth/page.tsx              (nuevo)
  salon/page.tsx             (nuevo)
  juegos/[id]/page.tsx       (nuevo: Detalle)
  juegos/[id]/jugar/page.tsx (nuevo: Reproductor)
components/
  nav.tsx                    ("use client": usePathname + menú móvil)
  footer.tsx
  library.tsx                ("use client": búsqueda + chips + grilla)
  game-card.tsx              ("use client": efecto tilt)
  leaderboard.tsx            (server)
  game-player.tsx            ("use client": simulación + modal)
  auth-form.tsx              ("use client": tabs + campos controlados)
  hall-of-fame.tsx           ("use client": tabs por juego)
lib/
  data.ts
```

---

## Plan de implementación

1. Crear `lib/data.ts` con los tipos, `GAMES`, `CATS`, `seededScores` y `getGame`. Verificar: `npx tsc --noEmit` pasa.
2. Crear `components/footer.tsx` y `components/nav.tsx`. El nav usa `<Link>` a `/`, `/salon` y `/auth`, y marca activo "Biblioteca" en `/` y `/juegos/*`, "Salón de la Fama" en `/salon`. Integrarlos en `app/layout.tsx` envolviendo `children` en `<main className="av-main">`. Verificar: `npm run dev`, el nav y el footer se ven en `/`.
3. Reemplazar `app/page.tsx` por la Biblioteca: hero server-side + `components/library.tsx` con filtros y `components/game-card.tsx`. Al hacer click en tarjeta o en JUGAR se navega a `/juegos/[id]`. Verificar: filtrar por "PUZZLE" deja solo CAÍDA; buscar "zzz" muestra "NO HAY RESULTADOS".
4. Crear `app/not-found.tsx` temático con botón a `/`.
5. Crear `app/juegos/[id]/page.tsx` y `components/leaderboard.tsx`. Usar `generateStaticParams` con los 8 ids; `params` es una `Promise` y se hace `await`; id desconocido → `notFound()`. "JUGAR AHORA" lleva a `/juegos/[id]/jugar` y "VOLVER AL VAULT" a `/`. Verificar: `/juegos/caida` muestra 10 filas; `/juegos/nada` muestra la 404 temática.
6. Crear `app/juegos/[id]/jugar/page.tsx` (server, resuelve el juego y hace `notFound()` si no existe) y `components/game-player.tsx` con la simulación. El nombre del jugador es "INVITADO". "SALIR" vuelve a `/juegos/[id]`. Verificar: la puntuación sube, PAUSA la detiene, FIN abre el modal, GUARDAR muestra el toast, JUGAR DE NUEVO reinicia a 0.
7. Crear `app/auth/page.tsx` con `components/auth-form.tsx`. El `submit` hace `preventDefault()` y no hace nada más; "JUGAR COMO INVITADO", GOOGLE y GITHUB no tienen efecto. Verificar: el tab "CREAR CUENTA" muestra el campo de correo y cambia el texto del botón a "CREAR Y JUGAR".
8. Crear `app/salon/page.tsx` con `components/hall-of-fame.tsx` (tab inicial = primer juego, podio, tabla de 12 filas con `animationDelay` escalonado, botón a `/`). Verificar: cambiar de tab cambia podio y tabla.
9. Ajustar `metadata` por página (título "Biblioteca · Arcade Vault", etc.) y correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [ ] `npm run lint` y `npx tsc --noEmit` pasan sin errores.
- [ ] Las rutas `/`, `/juegos/[id]` (8 ids), `/juegos/[id]/jugar`, `/auth` y `/salon` se renderizan sin errores en consola.
- [ ] `/juegos/no-existe` y `/juegos/no-existe/jugar` muestran `app/not-found.tsx` con status 404.
- [ ] La Biblioteca muestra 8 tarjetas; el chip "SHOOTER" deja exactamente INVASORES y ROCAS.
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] El link activo del nav corresponde a la ruta actual (Biblioteca en `/` y `/juegos/*`; Salón en `/salon`).
- [ ] Con ancho < breakpoint móvil del CSS, el botón ≡ abre el panel lateral y el backdrop lo cierra.
- [ ] El Detalle de un juego muestra exactamente 10 filas en el leaderboard, con las mismas puntuaciones en cada recarga.
- [ ] En el Reproductor, PAUSA detiene el contador y muestra "EN PAUSA"; REANUDAR lo continúa.
- [ ] FIN abre el modal con la puntuación final; GUARDAR muestra `▸ PUNTUACIÓN GUARDADA_`; JUGAR DE NUEVO deja puntuación 0, vidas 3 y nivel 01.
- [ ] Tras recargar cualquier página, `localStorage` no contiene claves `av_user` ni `av_scores`.
- [ ] Enviar el formulario de `/auth` no navega ni cambia el nav.
- [ ] El Salón de la Fama muestra podio (02 · 01 · 03) y 12 filas, y cambia al seleccionar otro juego.
- [ ] No queda ningún resto del scaffold de `create-next-app` en `app/page.tsx`.
- [ ] Comparadas lado a lado con `references/resources/templates/Arcade Vault.html`, las cinco pantallas usan las mismas clases CSS y textos.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Rutas reales del App Router | Router por hash del template | URLs compartibles y prerender por ruta. |
| Auth puramente visual (botones sin efecto) | Mock con `localStorage` / estado en memoria | El MVP es solo visual; la auth real merece su propia spec. |
| Submit de auth no hace nada | Redirigir a `/` | Decisión explícita del usuario: sin comportamiento simulado. |
| Toast de guardado sin persistir | Guardar en `av_scores` | Coherente con "sin persistencia". |
| Ocultar fila "TU MEJOR MARCA" | Mostrarla con usuario mock | No existe usuario en este MVP. |
| Replicar la simulación del reproductor | CRT estático "PRÓXIMAMENTE" | Mantiene fidelidad al template sin implementar juegos. |
| `lib/data.ts` tipado | JSON en `/data` | Tipos fuertes y punto único a reemplazar por una API. |
| Server Components + islas `"use client"` | Todo client | Aprovecha `cacheComponents` y prerender estático. |
| 404 temática en `app/not-found.tsx` | 404 por defecto de Next | Consistencia visual. |
| Reusar `app/globals.css` sin cambios | Reescribir estilos en utilidades Tailwind | El tema ya está portado 1:1; reescribirlo arriesga diferencias visuales. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `cacheComponents` exige `<Suspense>` para accesos dinámicos (`params`, `usePathname`) y rompe el build. | `generateStaticParams` en ambas rutas `[id]`; consultar `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`; envolver en `<Suspense>` si el build lo pide. |
| Hidratación inconsistente si la simulación usa `Math.random()` en el render. | `Math.random()` solo dentro del `setInterval` del `useEffect`, nunca en el render inicial. |
| APIs de Next 16 distintas a versiones previas (`params` como `Promise`, `PageProps`). | Leer la guía correspondiente en `node_modules/next/dist/docs/` antes de cada ruta. |
| Clases CSS del template (`.cover-*`, `.crt`, `.modal-bd`) dependen de estructura DOM exacta. | Copiar el marcado JSX del template sin reestructurarlo. |

---

## Lo que **no** entra en esta spec

- Juegos jugables reales.
- Autenticación (real o simulada) y menú de usuario.
- Persistencia de puntuaciones o sesión.
- Fila "TU MEJOR MARCA" en el Salón de la Fama.
- Login social y créditos funcionales.
- Tests automatizados.

Cada uno de estos, si llega, va en su propia spec.
