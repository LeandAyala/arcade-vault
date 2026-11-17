"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { saveScore, type SaveScoreState } from "@/app/juegos/[id]/jugar/actions";
import { GameScreen } from "@/components/game-screen";
import type { Game } from "@/lib/catalog";
import { REAL_GAMES } from "@/lib/games/registry";
import { formatScore, type GameEngine, type GameSnapshot, type RealGameDef } from "@/lib/games/types";

type PlayerGame = Pick<Game, "id" | "title">;

interface GamePlayerProps {
  game: PlayerGame;
  playerName: string; // alias en mayúsculas o INVITADO
  hasSession: boolean;
}

/** Juegos del registro → motor real; el resto usa la simulación de SPEC 01. */
export function GamePlayer(props: GamePlayerProps) {
  const def = REAL_GAMES[props.game.id];
  return def ? <RealGamePlayer {...props} def={def} /> : <SimulatedPlayer {...props} />;
}

// ── Piezas compartidas ───────────────────────────────────────────────────────

interface HudProps {
  game: PlayerGame;
  name: string;
  score: number;
  lives: number | null; // null = el juego no tiene vidas
  level: number;
  /** Casillas propias del juego tras `Nivel` (p. ej. `Líneas`). */
  extras: HudExtraValue[];
  paused: boolean;
  canPause: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

interface HudExtraValue {
  key: string;
  label: string;
  value: number;
}

const NO_EXTRAS: HudExtraValue[] = [];

/** Une las casillas declaradas por el juego con los valores del snapshot (0 si aún no llegan). */
function hudExtrasOf(def: RealGameDef, snapshot: GameSnapshot): HudExtraValue[] {
  if (!def.hudExtras) return NO_EXTRAS;
  return def.hudExtras.map(({ key, label }) => ({ key, label, value: snapshot.extra?.[key] ?? 0 }));
}

/** Quita el foco del botón tras el click: así Espacio vuelve a ser del juego. */
const blurAfter = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.blur();
  fn();
};

function PlayerHud({ game, name, score, lives, level, extras, paused, canPause, onTogglePause, onEnd }: HudProps) {
  return (
    <div className="player-hud">
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div className="hud-stat">
          <div className="l">Jugador</div>
          <div className="v" style={{ color: "var(--ink)" }}>{name}</div>
        </div>
        <div className="hud-stat">
          <div className="l">Puntuación</div>
          <div className="v">{formatScore(score)}</div>
        </div>
        <div className="hud-stat lives">
          <div className="l">Vidas</div>
          <div className="v">{lives === null ? "—" : "♥ ".repeat(lives).trim() || "—"}</div>
        </div>
        <div className="hud-stat level">
          <div className="l">Nivel</div>
          <div className="v">{String(level).padStart(2, "0")}</div>
        </div>
        {extras.map((x) => (
          <div key={x.key} className="hud-stat extra">
            <div className="l">{x.label}</div>
            <div className="v">{formatScore(x.value)}</div>
          </div>
        ))}
      </div>
      <div className="hud-actions">
        <button type="button" className="btn yellow" onClick={blurAfter(onTogglePause)} disabled={!canPause}>
          {paused ? "REANUDAR" : "PAUSA"}
        </button>
        <button type="button" className="btn magenta" onClick={blurAfter(onEnd)}>
          FIN
        </button>
        <Link href={`/juegos/${game.id}`} className="btn ghost">
          SALIR
        </Link>
      </div>
    </div>
  );
}

function PauseOverlay({ hint }: { hint: string }) {
  return (
    <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
      <div>
        <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
          EN PAUSA
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.16em" }}>
          {hint}
        </div>
      </div>
    </div>
  );
}

function Crt({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="crt">
      <div className="crt-screen">{children}</div>
      <div className="crt-bottom">
        <span className="led">SEÑAL OK</span>
        <span>{title} · CRT-83 · 60 HZ</span>
        <span>CARGA · 1MB</span>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  gameId: string;
  score: number;
  playerName: string;
  hasSession: boolean;
  onRestart: () => void;
}

const IDLE: SaveScoreState = { status: "idle" };

/** Texto del toast; sin puesto (no se pudo leer) queda el mensaje corto. */
function savedText(rank: number): string {
  return rank > 0
    ? `▸ PUNTUACIÓN GUARDADA · PUESTO #${String(rank).padStart(2, "0")}_`
    : "▸ PUNTUACIÓN GUARDADA_";
}

/**
 * Modal FIN DEL JUEGO. Se monta al terminar cada partida y se desmonta al reiniciar, así que el
 * estado de guardado (una vez por partida) se reinicia solo.
 */
function GameOverModal({ gameId, score, playerName, hasSession, onRestart }: GameOverModalProps) {
  const [state, formAction, isPending] = useActionState(saveScore, IDLE);
  const canSave = score > 0;

  let saveArea: ReactNode;
  if (!hasSession) {
    saveArea = (
      <div className="save-locked">
        <Link href="/auth" className="save-locked-link">
          INICIA SESIÓN PARA GUARDAR
        </Link>
        <p>Tu alias aparecerá en el Salón de la Fama.</p>
      </div>
    );
  } else if (state.status === "saved") {
    const text = savedText(state.rank);
    saveArea = (
      <div className="toast-saved" role="status" style={{ "--chars": text.length } as CSSProperties}>
        {text}
      </div>
    );
  } else {
    saveArea = (
      <form action={formAction}>
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="score" value={score} />
        <div className="input-row">
          <input value={playerName} readOnly aria-label="Tu alias" tabIndex={-1} />
          <button
            type="submit"
            className="btn yellow"
            disabled={!canSave || isPending}
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <span className="spinner" aria-hidden="true" style={{ marginRight: 10, verticalAlign: "middle" }}></span>
                GUARDANDO…
              </>
            ) : canSave ? (
              "GUARDAR PUNTUACIÓN"
            ) : (
              "SIN PUNTOS QUE GUARDAR"
            )}
          </button>
        </div>
        {state.status === "error" && !isPending && (
          <div className="auth-error modal-error" role="alert">
            [ERR] {state.message}
          </div>
        )}
      </form>
    );
  }

  return (
    <div className="modal-bd">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Fin del juego">
        <h2>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{formatScore(score)}</div>
        {saveArea}
        <div className="actions">
          <button type="button" className="btn" onClick={onRestart}>
            JUGAR DE NUEVO
          </button>
          <Link href="/biblioteca" className="btn magenta">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Juegos reales (lib/games/registry.ts) ────────────────────────────────────

function RealGamePlayer({ game, def, playerName, hasSession }: GamePlayerProps & { def: RealGameDef }) {
  const engineRef = useRef<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(def.initialSnapshot);
  const [over, setOver] = useState(false);

  // GAME OVER del motor abre el modal igual que FIN: el modal es el único camino para guardar.
  const onChange = useCallback((s: GameSnapshot) => {
    setSnapshot(s);
    if (s.phase === "gameover") setOver(true);
  }, []);
  const canPause = !over && (snapshot.phase === "playing" || snapshot.phase === "dead");

  const endGame = () => {
    engineRef.current?.pause();
    setOver(true);
  };

  const restart = () => {
    engineRef.current?.restart();
    setOver(false);
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        game={game}
        name={playerName}
        score={snapshot.score}
        lives={snapshot.lives}
        level={snapshot.level}
        extras={hudExtrasOf(def, snapshot)}
        paused={snapshot.paused}
        canPause={canPause}
        onTogglePause={() => engineRef.current?.togglePause()}
        onEnd={endGame}
      />

      <Crt title={game.title}>
        <GameScreen
          def={def}
          engineRef={engineRef}
          onChange={onChange}
          phase={snapshot.phase}
          inputEnabled={!over}
        />
        {snapshot.paused && !over && <PauseOverlay hint={def.pauseHint} />}
      </Crt>

      {over && (
        <GameOverModal
          gameId={game.id}
          score={snapshot.score}
          playerName={playerName}
          hasSession={hasSession}
          onRestart={restart}
        />
      )}
    </div>
  );
}

// ── Simulación (resto de juegos, igual que SPEC 01) ──────────────────────────

interface Run {
  score: number;
  level: number;
}

const INITIAL_RUN: Run = { score: 0, level: 1 };

/** Suma puntos al azar y sube de nivel cada ~2500 puntos (misma regla que el template). */
function tick(run: Run): Run {
  const score = run.score + Math.floor(10 + Math.random() * 90);
  const level = score > 0 && score % 2500 < 100 ? run.level + 1 : run.level;
  return { score, level };
}

function SimulatedPlayer({ game, playerName, hasSession }: GamePlayerProps) {
  const [run, setRun] = useState<Run>(INITIAL_RUN);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const { score, level } = run;

  useEffect(() => {
    if (over || paused) return;
    // Math.random() solo dentro del intervalo, nunca en el render inicial (evita desajustes de hidratación).
    const t = setInterval(() => setRun(tick), 220);
    return () => clearInterval(t);
  }, [over, paused]);

  const restart = () => {
    setRun(INITIAL_RUN);
    setLives(3);
    setPaused(false);
    setOver(false);
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        game={game}
        name={playerName}
        score={score}
        lives={lives}
        level={level}
        extras={NO_EXTRAS}
        paused={paused}
        canPause
        onTogglePause={() => setPaused((p) => !p)}
        onEnd={() => setOver(true)}
      />

      <Crt title={game.title}>
        <div className="game-arena">
          <div className="grid-floor"></div>
          <div className="enemy e1"></div>
          <div className="enemy e2"></div>
          <div className="enemy e3"></div>
          <div className="player-ship"></div>
        </div>
        {paused && <PauseOverlay hint="PULSA REANUDAR PARA CONTINUAR" />}
      </Crt>

      {over && (
        <GameOverModal
          gameId={game.id}
          score={score}
          playerName={playerName}
          hasSession={hasSession}
          onRestart={restart}
        />
      )}
    </div>
  );
}
