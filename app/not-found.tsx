import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Juego no encontrado · Arcade Vault",
};

export default function NotFound() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">404</h1>
        <div className="sub">
          ESTE CARTUCHO NO ESTÁ EN EL VAULT <span className="blink">_</span>
        </div>
      </section>

      <div style={{ textAlign: "center", padding: "0 24px 80px", color: "var(--ink-faint)" }}>
        <div className="pixel" style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}>
          JUEGO NO ENCONTRADO
        </div>
        <p style={{ marginBottom: 28 }}>Revisa la dirección o elige otro juego de la biblioteca.</p>
        <Link href="/biblioteca" className="btn">
          VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}
