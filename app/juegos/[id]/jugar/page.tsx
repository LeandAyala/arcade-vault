import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { getGame, getGameParams } from "@/lib/catalog";
import { getSessionProfile } from "@/lib/session";

export function generateStaticParams() {
  return getGameParams();
}

export async function generateMetadata({ params }: PageProps<"/juegos/[id]/jugar">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
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
  const game = await getGame(id);
  if (!game) notFound();

  // Alias de sesión (SPEC 04) en mayúsculas, o INVITADO. Lee cookies: va dentro del <Suspense>.
  const profile = await getSessionProfile();
  const playerName = profile ? profile.username.toUpperCase() : "INVITADO";

  return <GamePlayer game={{ id: game.id, title: game.title }} playerName={playerName} hasSession={profile !== null} />;
}
