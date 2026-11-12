# SPEC 02 — Home (landing) de Arcade Vault

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-11-11
> **Objective:** Portar la landing de `references/resources/templates/home-about/home.jsx` a `/`, mover la Biblioteca a `/biblioteca` y actualizar el nav al de `home-about/nav.jsx`, dejando fuera la vista Acerca de.

---

## Por qué existe esta spec

El template `home-about` introduce una landing separada de la Biblioteca. En SPEC 01 la Biblioteca ocupa `/`, así que esta spec reorganiza las rutas. También corrige los botones que hoy apuntan a `/` pensando en el catálogo. El CSS nuevo (`home-about/styles.css`) es un superconjunto del tema actual: las primeras 929 líneas son idénticas a las ya portadas en `app/globals.css`.

---

## Scope

**In:**

- `/` → Home con las siete secciones del template, en este orden:
  - Hero: siluetas flotantes, eyebrow `▸ INSERTA UNA MONEDA_`, título de tres líneas, subtítulo, CTAs `▶  EXPLORAR JUEGOS` y `✦  CREAR CUENTA`, indicador `DESLIZA ▼`.
  - `// 01 ¿POR QUÉ ARCADE VAULT?`: cuatro feature cards con iconos pixel SVG.
  - `// 02 JUEGOS DISPONIBLES AHORA`: rail con los 6 primeros `GAMES` y botón `VER TODOS LOS JUEGOS →`.
  - Stats: `12+ JUEGOS`, `MILES DE PARTIDAS`, `GLOBAL RANKING` (texto fijo).
  - `// 03 ACTIVIDAD EN VIVO`: ticker de 7 puntuaciones y top 5 jugadores con link `VER SALÓN →`.
  - `// 04 PRECIOS`: tarjeta "JUGADOR VAULT" con lista, botón `EMPEZAR GRATIS →`, sello `FREE PLAY` y tres FAQ.
  - CTA final `¿LISTO PARA JUGAR?` con botón `INSERTAR MONEDA →`.
- Efecto `.reveal` con `IntersectionObserver` (threshold `0.12`), idéntico al template.
- `/biblioteca` → la Biblioteca actual de SPEC 01, movida sin cambios de contenido.
- Nav con cuatro links en desktop y en el panel móvil: Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon`) y Acerca de (`/acerca-de`).
- El link Acerca de lleva a `/acerca-de`, que no existe y muestra la 404 por defecto de `app/not-found.tsx`.
- Botones que hoy van a `/` y pasan a `/biblioteca`:
  - `app/juegos/[id]/page.tsx` → `VOLVER AL VAULT`.
  - `components/game-player.tsx` → `VOLVER AL VAULT` del modal.
  - `components/hall-of-fame.tsx` → `VOLVER A LA BIBLIOTECA`.
  - `app/not-found.tsx` → `VOLVER AL VAULT`.
- El logo y el link Inicio del nav siguen yendo a `/`.
- Navegación de la home:
  - `EXPLORAR JUEGOS`, `VER TODOS LOS JUEGOS →` e `INSERTAR MONEDA →` → `/biblioteca`.
  - `CREAR CUENTA` y `EMPEZAR GRATIS →` → `/auth` (abre en el tab "Iniciar sesión", sin parámetros).
  - Cada mini-card → `/juegos/[id]`.
  - `VER SALÓN →` → `/salon`.
- Portar a `app/globals.css` todos los bloques nuevos de `home-about/styles.css`: HOME PAGE, ABOUT PAGE, GAMEPAD, ACTIVITY y PRICING.
- Datos mock nuevos tipados en `lib/data.ts`.

**Out of scope (para specs futuras):**

- La vista Acerca de (`about.jsx`) y su ruta `/acerca-de`. Su CSS sí se porta, pero no se usa.
- El gamepad. Su CSS se porta, pero ningún componente lo usa.
- Actividad en vivo real: el ticker y el top 5 son mocks fijos, sin polling ni tiempo real.
- Contadores de stats reales (`12+` es texto fijo, aunque hoy haya 8 juegos).
- Abrir `/auth` directamente en el tab "Crear cuenta".
- Respetar `prefers-reduced-motion` en `.reveal` u otras animaciones.
- Cualquier cambio de contenido o estilo en Biblioteca, Detalle, Reproductor, Auth o Salón, salvo el destino de los botones listados.
- Autenticación, persistencia, créditos funcionales y tests (siguen fuera, como en SPEC 01).

---

## Modelo de datos

Se añade a `lib/data.ts`, con los valores exactos de `home-about/home.jsx`. Reutiliza `GameColor` y `GAMES` de SPEC 01.

```ts
export type FeatureIcon = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export interface HomeFeature {
  icon: FeatureIcon;
  title: string;   // "JUEGOS CLÁSICOS"
  desc: string;
  color: GameColor;
}

export interface HomeStat {
  value: string;   // "12+"
  unit: string;    // "JUEGOS"
  sub: string;     // "Y CONTANDO"
}

export interface RecentScore {
  player: string;  // "NEONFOX"
  game: string;    // "Caída" (texto libre, como en el template)
  score: number;   // 184220
  ago: string;     // "hace 2 min"
  color: GameColor;
}

export interface TopPlayer {
  rank: number;    // 1..5
  player: string;
  score: number;
}

export interface FaqItem {
  q: string;       // "¿REALMENTE ES GRATIS?"
  a: string;
}

export const HOME_FEATURES: HomeFeature[];   // 4 elementos
export const HOME_STATS: HomeStat[];         // 3 elementos
export const RECENT_SCORES: RecentScore[];   // 7 elementos
export const TOP_PLAYERS_TODAY: TopPlayer[]; // 5 elementos
export const PRICING_FAQ: FaqItem[];         // 3 elementos
```

Convenciones:

- La lista de beneficios de la tarjeta de precios (`✔ Acceso a todos los juegos`, etc.) queda como marcado estático en la página, no en `lib/data.ts`.
- Números formateados con `toLocaleString("es-ES")`, siempre en Server Components.
- El ancho de la barra del top 5 se calcula como `100 - i * 16` %, como en el template.
- Los delays escalonados se conservan: features `i * 80` ms, stats `i * 90` ms, ticker `i * 60` ms.

No hay persistencia: ningún dato se lee ni se escribe entre sesiones.

---

## Estructura de archivos

```
app/
  globals.css                (modificar: añadir bloques nuevos del CSS)
  page.tsx                   (reemplazar: Home)
  biblioteca/page.tsx        (nuevo: contenido actual de app/page.tsx)
  not-found.tsx              (modificar: botón a /biblioteca)
  juegos/[id]/page.tsx       (modificar: botón a /biblioteca)
components/
  nav.tsx                    (modificar: links Inicio, Biblioteca, Salón, Acerca de)
  game-player.tsx            (modificar: botón del modal a /biblioteca)
  hall-of-fame.tsx           (modificar: botón a /biblioteca)
  reveal-observer.tsx        (nuevo, "use client": useEffect con IntersectionObserver, renderiza null)
  floating-silhouettes.tsx   (nuevo, server: 8 SVG decorativos)
  feature-icon.tsx           (nuevo, server: iconos GAMEPAD/FREE/TROPHY/ROCKET)
  mini-card.tsx              (nuevo, server: <Link> a /juegos/[id])
lib/
  data.ts                    (modificar: tipos y constantes de la home)
```

La Home (`app/page.tsx`) es un Server Component. La única isla cliente es `reveal-observer.tsx`. Los botones de navegación del template (`onClick={navigate}`) se convierten en `<Link className="btn ...">`, como ya hace el nav.

---

## Plan de implementación

1. Portar el CSS a `app/globals.css`. Añadir al final, copiados 1:1 desde `home-about/styles.css`:
   - el rango que va desde `/* ===== HOME PAGE ===== */` hasta la regla `.divider` de `/* misc */`, sin incluirla;
   - el rango que va desde `/* ===== GAMEPAD ===== */` hasta las reglas `.fade-in` / `.slide-in`, sin incluirlas.

   No duplicar `misc`, `tweaks` ni `spinner`, que ya existen. No tocar el encabezado Tailwind ni las variables de fuentes. Verificar: `npm run dev` y las pantallas de SPEC 01 se ven igual que antes.
2. Mover la Biblioteca: crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (metadata `Biblioteca · Arcade Vault`). Dejar `app/page.tsx` como placeholder mínimo. Verificar: `/biblioteca` muestra las 8 tarjetas.
3. Actualizar `components/nav.tsx`:
   - links Inicio, Biblioteca, Salón de la Fama y Acerca de, en desktop y panel móvil;
   - `sectionFor`: segmento `null` → inicio; `"biblioteca"` o `"juegos"` → biblioteca; `"salon"` → salon; `"auth"` → auth;
   - Acerca de nunca se marca activo.

   Verificar: el activo cambia al navegar entre `/`, `/biblioteca`, `/juegos/caida` y `/salon`.
4. Cambiar a `/biblioteca` los cuatro botones listados en el Scope. Verificar: cada botón lleva a `/biblioteca`.
5. Añadir a `lib/data.ts` los tipos y las constantes del Modelo de datos. Verificar: `npx tsc --noEmit` pasa.
6. Crear `components/floating-silhouettes.tsx`, `components/feature-icon.tsx` y `components/mini-card.tsx` copiando el marcado SVG y JSX del template sin reestructurarlo.
7. Reemplazar `app/page.tsx` por la Home: hero, `// 01`, `// 02` y stats. Metadata `Inicio · Arcade Vault`. Verificar: `/` muestra el hero y el rail de 6 mini-cards.
8. Completar `app/page.tsx` con `// 03` (ticker + top 5), `// 04` (precios + FAQ) y el CTA final.
9. Crear `components/reveal-observer.tsx` y montarlo en la Home. Verificar: las secciones aparecen al hacer scroll y quedan visibles.
10. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni avisos de "uncached data accessed outside of `<Suspense>`".
- [ ] `npm run lint` y `npx tsc --noEmit` pasan sin errores.
- [ ] `/` muestra la Home con las siete secciones en el orden del Scope y sin errores en consola.
- [ ] `/biblioteca` muestra la Biblioteca de SPEC 01; el chip "SHOOTER" deja exactamente INVASORES y ROCAS.
- [ ] El rail `// 02` muestra exactamente 6 mini-cards: los 6 primeros elementos de `GAMES`.
- [ ] Click en una mini-card lleva a `/juegos/[id]` del juego correspondiente.
- [ ] `EXPLORAR JUEGOS`, `VER TODOS LOS JUEGOS →` e `INSERTAR MONEDA →` llevan a `/biblioteca`.
- [ ] `CREAR CUENTA` y `EMPEZAR GRATIS →` llevan a `/auth` con el tab "Iniciar sesión" activo.
- [ ] `VER SALÓN →` lleva a `/salon`.
- [ ] El ticker muestra 7 filas y el top 5 muestra 5 filas, con números en formato `es-ES` (p. ej. `184.220`).
- [ ] Las secciones `.reveal` empiezan ocultas y obtienen la clase `in` al entrar en el viewport.
- [ ] Tras recargar `/` con el scroll al final, al subir todas las secciones `.reveal` quedan visibles.
- [ ] El nav muestra Inicio, Biblioteca, Salón de la Fama y Acerca de, en desktop y en el panel móvil.
- [ ] Inicio está activo en `/`; Biblioteca en `/biblioteca` y `/juegos/*`; Salón en `/salon`.
- [ ] `/acerca-de` muestra `app/not-found.tsx` con status 404, y ningún link del nav aparece activo.
- [ ] El logo del nav lleva a `/`.
- [ ] Los botones de Detalle, modal del Reproductor, Salón y 404 llevan a `/biblioteca`.
- [ ] `/juegos/no-existe` sigue mostrando la 404 con status 404.
- [ ] Las pantallas de SPEC 01 (Biblioteca, Detalle, Reproductor, Auth, Salón) se ven igual que antes del cambio de CSS.
- [ ] `app/globals.css` contiene una sola definición de `.spinner`, `.tw-section` y `.divider`.
- [ ] Comparada lado a lado con `home-about/arcade-vault-standalone.html`, la Home usa las mismas clases CSS y textos.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Home en `/`, Biblioteca en `/biblioteca` | Biblioteca en `/`, Home en `/inicio` | Igual que el template: la landing es la portada del sitio. |
| Link Acerca de visible, apuntando a la 404 | Ocultarlo / mostrarlo deshabilitado | Decisión explícita del usuario: el nav queda igual al template. |
| URL `/acerca-de` | `/about` | En español, coherente con `/juegos` y `/salon`. |
| Botones "volver" a `/biblioteca` | Dejarlos en `/` | Mantienen su sentido actual: volver al catálogo. |
| Portar todo el CSS nuevo (incluye About y Gamepad) | Solo HOME + ACTIVITY + PRICING | Decisión explícita del usuario: deja listos los estilos de futuras specs. |
| No duplicar `misc`, `tweaks` y `spinner` | Copiar el archivo entero | Esas reglas ya existen en `globals.css`; duplicarlas no aporta nada. |
| Mocks tipados en `lib/data.ts` | Constantes dentro de la página | Mismo patrón que `GAMES`; punto único a reemplazar por una API. |
| `.reveal` tal cual el template | Añadir `prefers-reduced-motion` | Fidelidad 1:1; la accesibilidad de animaciones irá en otra spec si hace falta. |
| CTAs de cuenta solo navegan a `/auth` | `/auth?tab=registro` | No toca `auth-form.tsx` ni obliga a leer `searchParams` bajo `<Suspense>`. |
| Home como Server Component + una isla cliente | Home entera `"use client"` | Aprovecha el prerender estático de `cacheComponents`. |
| Botones del template como `<Link className="btn">` | `<button>` + `router.push` | Prefetch y navegación accesible sin JavaScript extra. |
| Texto `12+ JUEGOS` fijo | Calcular desde `GAMES.length` | Fidelidad al template; los stats reales son de otra spec. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El CSS nuevo pisa reglas existentes y cambia las pantallas de SPEC 01. | Las primeras 929 líneas de `home-about/styles.css` son idénticas al tema ya portado; solo se añaden bloques nuevos. Revisar las cinco pantallas tras el paso 1. |
| En la 404, `useSelectedLayoutSegment()` puede devolver `null` y marcar Inicio como activo. | Verificar el valor del segmento en `/acerca-de` y `/juegos/no-existe` en el paso 3. Ajustar `sectionFor` según el resultado. |
| `.reveal` deja las secciones con `opacity: 0` si el observer no corre (navegación cliente o JS deshabilitado). | `reveal-observer.tsx` ejecuta el `useEffect` en cada montaje de la Home. Se acepta que sin JS las secciones queden ocultas, igual que en el template. |
| Hidratación inconsistente por `toLocaleString("es-ES")`. | Formatear solo en Server Components. |
| Algún link interno queda apuntando a `/` cuando debía ir al catálogo. | Buscar `href="/"` en `app/` y `components/` tras el paso 4: solo deben quedar el logo y el link Inicio del nav. |

---

## Lo que **no** entra en esta spec

- Vista Acerca de y ruta `/acerca-de`.
- Gamepad y cualquier componente que use su CSS.
- Actividad en vivo, stats o rankings reales.
- Tab "Crear cuenta" preseleccionado desde la Home.
- `prefers-reduced-motion`.
- Autenticación, persistencia, créditos funcionales y tests.

Cada uno de estos, si llega, va en su propia spec.
