import type { Metadata } from "next";
import { Library } from "@/components/library";
import { getGames } from "@/lib/catalog";
import { getGameStats } from "@/lib/scores";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
};

export default async function BibliotecaPage() {
  // Lecturas públicas cacheadas ("use cache"): la página sigue prerenderizándose.
  const [games, stats] = await Promise.all([getGames(), getGameStats()]);

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <Library games={games} stats={stats} />
    </div>
  );
}
