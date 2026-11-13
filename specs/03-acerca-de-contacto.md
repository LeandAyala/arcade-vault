# SPEC 03 — Acerca de y formulario de contacto con Resend

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-11
> **Objective:** Portar la vista Acerca de de `references/resources/templates/home-about/about.jsx` a `/acerca-de` y hacer que su formulario de contacto envíe un correo real al equipo mediante una Server Action con Resend.

---

## Por qué existe esta spec

SPEC 02 dejó el link "Acerca de" del nav apuntando a `/acerca-de`, que hoy devuelve la 404. También portó todo el CSS de `ABOUT PAGE` a `app/globals.css`, pero ningún componente lo usa. El template solo simula el envío: valida en cliente y muestra una terminal de éxito. Esta spec añade el primer código de servidor con efectos externos del proyecto (envío de correo), y con él variables de entorno, estados de error y una protección anti-spam mínima.

---

## Scope

**In:**

- `/acerca-de` → vista Acerca de con las secciones del template, en este orden:
  - Hero: kicker `▸ ACERCA DE`, título `ACERCA DE ARCADE VAULT`, párrafo de misión y tres highlights con iconos pixel SVG (`HEART`, `BROWSER`, `PLANT`).
  - Divider decorativo `.about-divider` con 24 píxeles animados.
  - Contacto: kicker `▸ CONTACTO`, título `CONTÁCTANOS`, subtítulo, tres tips y el formulario.
- Contenedor raíz `<div className="about fade-in">`, como en el template.
- Efecto `.reveal` reutilizando `components/reveal-observer.tsx` de SPEC 02.
- Formulario con campos `NOMBRE`, `CORREO ELECTRÓNICO` y `MENSAJE`, y botón `▶  ENVIAR MENSAJE`.
- Validación en cliente igual al template: si algún campo queda vacío tras `trim`, el form hace shake 400 ms y no se envía nada.
- Server Action `sendContactMessage` que valida en servidor y envía el correo con Resend.
- Un único correo por mensaje, al buzón del equipo (`CONTACT_TO_EMAIL`), con `replyTo` = email del usuario.
- Plantilla del correo con React Email (`emails/contact-message.tsx`) más versión `text` explícita.
- Asunto: `[ARCADE VAULT] Mensaje de {nombre}`.
- Estados del formulario:
  - Pendiente: botón deshabilitado con texto `TRANSMITIENDO…` y el `.spinner` existente.
  - Éxito: terminal `.terminal-success` idéntica al template, con `ENVIAR OTRO MENSAJE`.
  - Error: la misma terminal en variante de error, con líneas `[ERR]` en magenta y botón `REINTENTAR`.
- `REINTENTAR` vuelve al form conservando lo escrito. `ENVIAR OTRO MENSAJE` vuelve al form vacío.
- Honeypot: campo oculto `hp_token`. Si llega relleno, se responde éxito sin enviar correo.
- Variables de entorno `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL`, documentadas en `.env.example` y en el README.
- Nav: "Acerca de" se marca activo en `/acerca-de`, en desktop y en el panel móvil.
- CSS nuevo mínimo en `app/globals.css`: variante de error de la terminal y clase del honeypot.

**Out of scope (para specs futuras):**

- Correo de acuse de recibo al usuario (requiere dominio verificado en Resend).
- Rate limiting por IP, captcha o cualquier anti-spam más allá del honeypot.
- Persistir los mensajes (base de datos, log, panel de administración).
- Servidor de preview de plantillas (`email dev` / paquete `react-email`).
- Zod u otra librería de validación.
- Un endpoint HTTP público (`app/api/...`) para el contacto.
- Respetar `prefers-reduced-motion` (sigue fuera, como en SPEC 02).
- Cambios de contenido o estilo en las pantallas de SPEC 01 y SPEC 02, salvo el estado activo del nav.
- Autenticación, créditos funcionales y tests.

---

## Modelo de datos

Tipos y validación en `lib/contact.ts` (sin `"use server"`, importable desde servidor y cliente).

```ts
export const CONTACT_LIMITS = { name: 60, email: 254, message: 2000 } as const;

export interface ContactInput {
  name: string;     // tras trim, 1..60
  email: string;    // tras trim, 1..254, regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  message: string;  // tras trim, 1..2000
}

export type ContactErrorCode = "VALIDATION" | "CONFIG" | "SEND";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string; id: number }
  | { status: "error"; code: ContactErrorCode; message: string; id: number };

export function validateContact(
  raw: { name: unknown; email: unknown; message: unknown },
): { ok: true; data: ContactInput } | { ok: false; message: string };
```

- `id` es `Date.now()` en el servidor. El cliente lo usa para saber qué resultado ya descartó y volver al form sin recargar.
- `message` de error es texto en español apto para mostrarse al usuario. Nunca incluye el error crudo de Resend.

Mensajes de la terminal de error por código:

| `code` | Línea `[ERR]` |
| --- | --- |
| `VALIDATION` | `[ERR] Datos inválidos: {detalle de validateContact}` |
| `CONFIG` | `[ERR] Servicio de correo no configurado.` |
| `SEND` | `[ERR] El servidor de correo no respondió.` |

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`):

```bash
RESEND_API_KEY=          # obligatoria; sin ella → error CONFIG
CONTACT_TO_EMAIL=        # obligatoria; buzón del equipo; sin ella → error CONFIG
CONTACT_FROM_EMAIL=      # opcional; por defecto "Arcade Vault <onboarding@resend.dev>"
```

Props de la plantilla `emails/contact-message.tsx`:

```ts
interface ContactMessageEmailProps {
  name: string;
  email: string;
  message: string;
}
```

No hay persistencia: ningún mensaje se guarda en el proyecto.

---

## Estructura de archivos

```
app/
  acerca-de/
    page.tsx               (nuevo, server: vista Acerca de, metadata "Acerca de · Arcade Vault")
    actions.ts             (nuevo, "use server": sendContactMessage)
  globals.css              (modificar: .terminal-success.error, .term-body .error, .hp-field)
components/
  highlight-icon.tsx       (nuevo, server: iconos HEART/BROWSER/PLANT copiados del template)
  contact-form.tsx         (nuevo, "use client": form + useActionState + terminales)
  nav.tsx                  (modificar: "acerca-de" → about activo)
emails/
  contact-message.tsx      (nuevo: plantilla React Email)
lib/
  contact.ts               (nuevo: tipos, CONTACT_LIMITS, validateContact)
  resend.ts                (nuevo, import "server-only": sendContactEmail)
.env.example               (nuevo: las tres claves vacías)
.gitignore                 (modificar: añadir !.env.example)
README.md                  (modificar: sección de variables de entorno)
package.json               (modificar: resend, @react-email/components)
```

La página es un Server Component. La única isla cliente nueva es `contact-form.tsx`, más `RevealObserver` ya existente.

---

## Plan de implementación

1. Instalar dependencias: `npm install resend @react-email/components`. Verificar: `npm run build` sigue pasando.
2. Crear `.env.example`, añadir `!.env.example` a `.gitignore` y documentar las tres variables en el README. Verificar: `git status` muestra `.env.example` como archivo nuevo y no muestra `.env.local`.
3. Crear `app/acerca-de/page.tsx` y `components/highlight-icon.tsx` con hero, highlights, divider y la columna `contact-intro`, sin formulario. Montar `RevealObserver`. Verificar: `/acerca-de` responde 200 y se ve igual que el template.
4. Actualizar `components/nav.tsx`: `sectionFor("acerca-de")` → `"about"` y ajustar el comentario que dice que nunca se marca activo. Verificar: "Acerca de" activo en `/acerca-de` y en ninguna otra ruta.
5. Crear `components/contact-form.tsx` con el marcado del template, inputs controlados, validación de vacíos con shake y terminal de éxito local (todavía sin servidor). Inputs con `maxLength` según `CONTACT_LIMITS`. Incluir el honeypot `hp_token` dentro de `<div className="hp-field" aria-hidden="true">` con `tabIndex={-1}` y `autoComplete="off"`.
6. Crear `lib/contact.ts` con tipos, límites y `validateContact`. Verificar: `npx tsc --noEmit` pasa.
7. Crear `emails/contact-message.tsx`: fondo `#0a0a0f`, título cian, nombre, email y mensaje con saltos de línea preservados.
8. Crear `lib/resend.ts` con `sendContactEmail(input: ContactInput)`:
   - lee las variables de entorno en cada llamada;
   - instancia `new Resend(key)` dentro de la función, nunca a nivel de módulo;
   - llama a `resend.emails.send({ from, to, replyTo, subject, react, text })`;
   - devuelve `{ ok: true }` o `{ ok: false, code: "CONFIG" | "SEND" }` y registra el detalle con `console.error`.
9. Crear `app/acerca-de/actions.ts` con `sendContactMessage(prev: ContactState, formData: FormData): Promise<ContactState>`:
   - honeypot relleno → `success` sin llamar a Resend;
   - `validateContact` falla → `error` `VALIDATION`;
   - si no, llama a `sendContactEmail` y mapea el resultado.
10. Conectar `contact-form.tsx` a la acción con `useActionState`:
    - `isPending` → botón deshabilitado `TRANSMITIENDO…` + `.spinner`;
    - `success` → terminal del template con `GRACIAS, {NOMBRE}`;
    - `error` → terminal de error con `REINTENTAR`.

    Verificar a mano los tres estados (sin `RESEND_API_KEY` se obtiene `CONFIG`).
11. Añadir a `app/globals.css` las reglas `.terminal-success.error` (borde y glow magenta), `.term-body .error` (texto magenta) y `.hp-field` (fuera de pantalla, `position: absolute; left: -9999px`).
12. Correr `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build` termina sin errores, sin variables de entorno definidas y sin avisos de "uncached data accessed outside of `<Suspense>`".
- [x] `npm run lint` y `npx tsc --noEmit` pasan sin errores.
- [x] `/acerca-de` responde 200 y muestra hero, highlights, divider y contacto en ese orden, sin errores en consola.
- [x] Comparada lado a lado con `home-about/arcade-vault-standalone.html`, la vista usa las mismas clases CSS y textos.
- [x] El link "Acerca de" del nav está activo en `/acerca-de` (desktop y panel móvil) y no en `/`, `/biblioteca`, `/salon` ni `/auth`.
- [x] Enviar con algún campo vacío o solo con espacios hace shake del form y no genera ninguna petición de red.
- [x] Durante el envío, el botón muestra `TRANSMITIENDO…`, está deshabilitado y un segundo click no dispara otra petición.
- [x] Con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` válidas, un envío muestra la terminal de éxito con `GRACIAS, {NOMBRE}` en mayúsculas.
- [x] Ese envío llega a `CONTACT_TO_EMAIL` con asunto `[ARCADE VAULT] Mensaje de {nombre}`, `Reply-To` = email del formulario y el mensaje completo.
- [x] Sin `CONTACT_FROM_EMAIL`, el remitente es `Arcade Vault <onboarding@resend.dev>`.
- [x] Sin `RESEND_API_KEY`, el envío muestra la terminal de error con `[ERR] Servicio de correo no configurado.` y la app no se cae.
- [x] Con una `RESEND_API_KEY` inválida, el envío muestra `[ERR] El servidor de correo no respondió.` y el error real solo aparece en la consola del servidor.
- [x] `REINTENTAR` vuelve al form con nombre, email y mensaje intactos.
- [x] `ENVIAR OTRO MENSAJE` vuelve al form con los tres campos vacíos.
- [x] Un POST a la acción con `hp_token` relleno devuelve éxito y no envía correo (no aparece en el dashboard de Resend).
- [x] Un mensaje de más de 2000 caracteres enviado saltando el `maxLength` devuelve error `VALIDATION`.
- [x] Un mensaje con `<script>` o HTML llega al correo como texto literal, sin ejecutarse ni renderizarse.
- [x] `RESEND_API_KEY` no aparece en ningún archivo de `.next/static`.
- [x] `.env.example` está versionado y `.env.local` sigue ignorado.
- [x] Las pantallas de SPEC 01 y SPEC 02 se ven igual que antes.

---

## Decisiones tomadas y descartadas

| Decisión | Alternativa descartada | Motivo |
| --- | --- | --- |
| Server Action + `useActionState` | Route Handler `app/api/contacto/route.ts` | Patrón nativo de Next 16, sin endpoint público explícito y con estado pendiente integrado. |
| Remitente y destino por variables de entorno | Dominio verificado fijo en código | Funciona hoy con el sandbox `onboarding@resend.dev` y se migra a un dominio propio sin tocar código. |
| Solo correo al equipo, con `replyTo` | Equipo + acuse al usuario | El sandbox de Resend solo envía al dueño de la cuenta; el acuse requiere dominio verificado. |
| React Email + `text` explícito | Texto plano / HTML a mano | Decisión explícita del usuario; React Email escapa el contenido del usuario por defecto. |
| Validación manual en `lib/contact.ts` | Zod | Tres campos no justifican una dependencia nueva. |
| Doble validación: vacíos en cliente, todo en servidor | Solo cliente / solo servidor | El shake del template se conserva y el servidor no confía en el cliente. |
| Terminal de error con `REINTENTAR` | Mensaje bajo el botón | Coherente con la estética terminal del template. |
| Botón `TRANSMITIENDO…` + `.spinner` | Terminal animada durante el envío | Evita dobles envíos y reutiliza CSS existente. |
| Honeypot `hp_token` con éxito silencioso | Rate limit en memoria / captcha | Cero dependencias y sin estado; un Map en memoria no sirve en serverless multi-instancia. |
| Inputs controlados | Inputs no controlados de `<form action>` | React 19 resetea los no controlados tras la acción; `REINTENTAR` debe conservar lo escrito. |
| `new Resend()` dentro de la función | Cliente a nivel de módulo | El constructor falla sin API key; a nivel de módulo rompería el build sin `.env`. |
| `lib/resend.ts` con `server-only` | Lógica dentro de `actions.ts` | Aísla el proveedor y garantiza que la key nunca llega al bundle cliente. |
| Errores genéricos al usuario + `console.error` | Mostrar el error de Resend | No filtra detalles de configuración ni de la cuenta. |
| Nav marca "Acerca de" activo | Dejar el nav intacto | La ruta ya existe; el comportamiento queda igual al resto de links. |
| `.env.example` versionado con excepción en `.gitignore` | Solo README | Deja claro qué variables hacen falta al clonar el repo. |

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El sandbox `onboarding@resend.dev` solo entrega al email de la cuenta de Resend. | Documentar en README y `.env.example` que `CONTACT_TO_EMAIL` debe ser ese email hasta verificar un dominio. |
| `resend` necesita `@react-email/render` para la prop `react` y la versión instalada no lo trae. | Verificar en el paso 1 las peer dependencies; si falta, instalarlo y anotarlo en el README. |
| La Server Action es invocable por cualquiera con su ID, sin pasar por el form. | Validación completa en servidor, límites de longitud y honeypot. El rate limit queda para otra spec. |
| `cacheComponents` intenta prerenderizar algo que lee `process.env` en la página. | Las variables se leen solo dentro de `sendContactEmail`, en tiempo de petición, nunca en `page.tsx`. |
| `.reveal` deja ocultas las secciones si el observer no corre. | Se reutiliza `RevealObserver`, que corre en cada montaje. Mismo comportamiento aceptado en SPEC 02. |
| Un gestor de contraseñas o autofill rellena el honeypot y descarta mensajes reales. | `autoComplete="off"`, `tabIndex={-1}`, nombre `hp_token` sin label visible y contenedor `aria-hidden`. Se usó `hp_token` y no `website` porque en las pruebas un mensaje real se descartó como spam, con toda probabilidad por el autofill del navegador sobre `website`. |

---

## Lo que **no** entra en esta spec

- Correo de acuse al usuario.
- Rate limiting, captcha o anti-spam más allá del honeypot.
- Persistencia de mensajes o panel de administración.
- Preview de plantillas con `react-email`.
- Endpoint HTTP público de contacto.
- `prefers-reduced-motion`.
- Autenticación, créditos funcionales y tests.

Cada uno de estos, si llega, va en su propia spec.
