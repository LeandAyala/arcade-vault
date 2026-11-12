import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { GAMES, getGame } from "@/lib/data";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/juegos/[id]/jugar">): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  return game ? { title: `Jugando ${game.title} · Arcade Vault` } : {};
}

type Params = PageProps<"/juegos/[id]/jugar">["params"];

// `params` dentro de <Suspense> por Partial Prefetching (ver app/juegos/[id]/page.tsx).
export default function GamePlayerPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense fallback={null}>
      <GamePlayerScreen params={params} />
    </Suspense>
  );
}

async function GamePlayerScreen({ params }: { params: Params }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer game={{ id: game.id, title: game.title }} />;
}
