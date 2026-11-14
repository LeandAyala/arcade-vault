import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { getGame, getGameParams } from "@/lib/catalog";
import { EMPTY_STATS, LEADERBOARD_SIZE, getGameStats, getLeaderboard } from "@/lib/scores";

export function generateStaticParams() {
  return getGameParams();
}

export async function generateMetadata({ params }: PageProps<"/juegos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  return game ? { title: `${game.title} · Arcade Vault`, description: game.short } : {};
}

type Params = PageProps<"/juegos/[id]">["params"];

/**
 * `params` se lee dentro de <Suspense>: con Partial Prefetching, la navegación en cliente usa
 * la carcasa genérica de /juegos/[id] (sin params) y leerlos fuera de un límite la bloquearía.
 * Los ids de generateStaticParams se prerenderizan completos, así que el fallback solo se ve
 * en navegaciones aún no prefetcheadas.
 */
export default function GameDetailPage({ params }: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={null}>
      <GameDetail params={params} />
    </Suspense>
  );
}

async function GameDetail({ params }: { params: Params }) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  // Lecturas públicas cacheadas; saveScore las invalida con updateTag("scores").
  const [scores, allStats] = await Promise.all([getLeaderboard(id, LEADERBOARD_SIZE.detail), getGameStats()]);
  const stats = allStats[id] ?? EMPTY_STATS;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{stats.plays.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v" style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>
                {stats.best === null ? "—" : stats.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">
              ▶  JUGAR AHORA
            </Link>
            <Link href="/biblioteca" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard scores={scores} gameId={game.id} />
      </aside>
    </div>
  );
}
