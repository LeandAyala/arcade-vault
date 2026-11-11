# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por la mayor cantidad de puntos. El repositorio está en su estado inicial (scaffold de `create-next-app`); la funcionalidad se construye con Spec Driven Design usando las skills `/spec` y `/spec-impl` de [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (`npx skills@latest add Klerith/fernando-skills`). La carpeta `references/` está pensada para material de referencia de las specs.

## Comandos

```bash
npm run dev     # servidor de desarrollo (http://localhost:3000)
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # ESLint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit  # chequeo de tipos
```

No hay framework de tests configurado todavía.

## Stack y particularidades

- **Next.js 16.4 (App Router) + React 19.3 + TypeScript strict.** Las APIs difieren de versiones anteriores: consultar `node_modules/next/dist/docs/` (`01-app/`) antes de escribir código.
- **`next.config.ts` activa features que cambian el modelo de rendering/caching:**
  - `cacheComponents: true` — Cache Components / PPR: el data fetching dinámico debe ir dentro de `<Suspense>` o cachearse con `"use cache"`. Ver `01-app/01-getting-started/08-caching.md`.
  - `partialPrefetching: true` — ver `01-app/02-guides/adopting-partial-prefetching.md`.
  - `experimental.agentFeedback: true` — ver `01-app/02-guides/ai-agents.md`.
- **Tailwind CSS v4** cargado vía la regla de Turbopack `@tailwindcss/turbopack` (no hay `postcss.config` ni `tailwind.config`). Los tokens de tema se definen con `@theme inline` en `app/globals.css`.
- Tipos globales de rutas generados por Next (p. ej. `LayoutProps<"/">` en `app/layout.tsx`) sin import explícito.
- Alias de imports: `@/*` → raíz del repo.
