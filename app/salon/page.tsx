import type { Metadata } from "next";
import { HallOfFame } from "@/components/hall-of-fame";
import { getGames } from "@/lib/catalog";
import { LEADERBOARD_SIZE, getAllLeaderboards } from "@/lib/scores";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
};

export default async function SalonPage() {
  // Una sola query para todos los rankings: las pestañas cambian en cliente sin esperas.
  const [games, leaderboards] = await Promise.all([getGames(), getAllLeaderboards(LEADERBOARD_SIZE.salon)]);
  return (
    <HallOfFame
      games={games.map((g) => ({ id: g.id, title: g.title }))}
      leaderboards={leaderboards}
    />
  );
}
