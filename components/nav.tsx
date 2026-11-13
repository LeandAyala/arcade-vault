"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";

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

export function Nav() {
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
        <Link href="/auth" className="btn auth-btn" onClick={close}>
          Iniciar Sesión
        </Link>
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
        <Link href="/auth" className={cls("auth")} onClick={close}>
          Iniciar Sesión
        </Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
