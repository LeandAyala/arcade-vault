"use client";

import Link from "next/link";
import { useState } from "react";
import { LeaderboardEmpty } from "@/components/leaderboard-empty";
import type { LeaderboardRow } from "@/lib/scores";

const topClass = (i: number) => (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");

interface HallGame {
  id: string;
  title: string;
}

interface HallOfFameProps {
  games: HallGame[];
  leaderboards: Record<string, LeaderboardRow[]>;
}

/** Un puesto del podio. Sin jugador muestra huecos `---`. */
function PodiumSlot({ row, place }: { row: LeaderboardRow | undefined; place: 1 | 2 | 3 }) {
  const medal = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  const isGold = place === 1;
  return (
    <div className={`podium-slot ${medal}` + (row ? "" : " empty")}>
      {isGold && (
        <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>
          CAMPEÓN
        </div>
      )}
      <div className="rank-num" style={isGold ? { fontSize: 36, marginTop: 4 } : undefined}>
        {String(place).padStart(2, "0")}
      </div>
      <div className="name">{row ? row.name : "---"}</div>
      <div className="score" style={isGold ? { fontSize: 20 } : undefined}>
        {row ? row.score.toLocaleString("es-ES") : "---"}
      </div>
      <div className="date">{row ? row.date : "--/--/----"}</div>
    </div>
  );
}

export function HallOfFame({ games, leaderboards }: HallOfFameProps) {
  const [tab, setTab] = useState(games[0]?.id ?? "");
  const rows = leaderboards[tab] ?? [];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        tab ? (
          <div className="hall-empty">
            <LeaderboardEmpty gameId={tab} />
          </div>
        ) : (
          <div className="hall-empty">
            <p className="lb-empty-title">CATÁLOGO NO DISPONIBLE</p>
          </div>
        )
      ) : (
        <>
          <div className="podium">
            <PodiumSlot row={rows[1]} place={2} />
            <PodiumSlot row={rows[0]} place={1} />
            <PodiumSlot row={rows[2]} place={3} />
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div key={r.name} className={"tr" + topClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
