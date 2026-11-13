"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type Section = "inicio" | "biblioteca" | "salon" | "about" | "auth";

/**
 * Se usa el segmento activo (árbol de rutas que envía el servidor) en vez de `usePathname()`:
 * cuando `proxy.ts` reescribe un id inexistente a la 404, la URL del navegador no coincide con
 * la ruta renderizada y `usePathname()` provocaría un desajuste de hidratación.
 */
function sectionFor(segment: string | null): Section | null {
  if (segment === null) return "inicio"; // "/"
  if (segment === "biblioteca" || segment === "juegos") return "biblioteca"; // "/biblioteca" y "/juegos/*"
  if (segment === "salon") return "salon";
  if (segment === "acerca-de") return "about";
  if (segment === "auth") return "auth";
  return null;
}

const LINKS: { href: string; label: string; section: Section }[] = [
  { href: "/", label: "Inicio", section: "inicio" },
  { href: "/biblioteca", label: "Biblioteca", section: "biblioteca" },
  { href: "/salon", label: "Salón de la Fama", section: "salon" },
  { href: "/acerca-de", label: "Acerca de", section: "about" },
];

/** "Iniciar Sesión" sin sesión. En el panel móvil se marca activo en /auth. */
export function NavAuthLink({ variant }: { variant: "desktop" | "mobile" }) {
  const segment = useSelectedLayoutSegment();
  if (variant === "desktop") {
    return (
      <Link href="/auth" className="btn auth-btn">
        Iniciar Sesión
      </Link>
    );
  }
  return (
    <Link href="/auth" className={sectionFor(segment) === "auth" ? "active" : ""}>
      Iniciar Sesión
    </Link>
  );
}

/** Botón SALIR del `<form action={signOut}>`: deshabilitado mientras la acción está en curso. */
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn ghost signout-btn" disabled={pending} aria-busy={pending}>
      {pending ? "SALIENDO…" : "SALIR"}
    </button>
  );
}

/**
 * `account` y `mobileAccount` son slots de servidor (`<NavAccount>` dentro de `<Suspense>`), que
 * el layout pasa ya resueltos: el Nav sigue siendo cliente y el shell, estático.
 */
export function Nav({ account, mobileAccount }: { account: ReactNode; mobileAccount: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const [open, setOpen] = useState(false);
  const current = sectionFor(segment);
  const cls = (name: Section) => (current === name ? "active" : "");
  const close = () => setOpen(false);

  const links = LINKS.map((l) => (
    <Link key={l.href} href={l.href} className={cls(l.section)} onClick={close}>
      {l.label}
    </Link>
  ));

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">{links}</div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        <div className="av-account-slot" onClick={close}>
          {account}
        </div>
        <button
          type="button"
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
        >
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        {links}
        <div className="av-account-slot" onClick={close}>
          {mobileAccount}
        </div>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
