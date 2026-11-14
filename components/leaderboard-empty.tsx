import Link from "next/link";

/** Ranking sin puntuaciones: invita a jugar. Lo usan el detalle (compacto) y el Salón. */
export function LeaderboardEmpty({ gameId, compact = false }: { gameId: string; compact?: boolean }) {
  return (
    <div className={"lb-empty" + (compact ? " compact" : "")}>
      <div className="lb-empty-scan" aria-hidden="true">
        {"#01 ---------- 000000"}
        <br />
        {"#02 ---------- 000000"}
        <br />
        {"#03 ---------- 000000"}
      </div>
      <p className="lb-empty-title">
        SIN PUNTUACIONES TODAVÍA<span className="blink">_</span>
      </p>
      <p className="lb-empty-sub">SÉ EL PRIMERO</p>
      <Link href={`/juegos/${gameId}/jugar`} className="btn yellow">
        ▶ JUGAR
      </Link>
    </div>
  );
}
