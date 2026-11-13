"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AsteroidsScreen } from "@/components/asteroids-screen";
import type { Game } from "@/lib/data";
import { formatScore, type AsteroidsGame, type AsteroidsSnapshot } from "@/lib/games/asteroids/engine";

type PlayerGame = Pick<Game, "id" | "title">;

/** Id del único juego real por ahora; el resto usa la simulación de SPEC 01. */
const ASTEROIDS_ID = "asteroides";

export function GamePlayer({ game, playerName }: { game: PlayerGame; playerName: string }) {
  return game.id === ASTEROIDS_ID ? (
    <AsteroidsPlayer game={game} playerName={playerName} />
  ) : (
    <SimulatedPlayer game={game} />
  );
}

// ── Piezas compartidas ───────────────────────────────────────────────────────

interface HudProps {
  game: PlayerGame;
  name: string;
  score: number;
  lives: number;
  level: number;
  paused: boolean;
  canPause: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

/** Quita el foco del botón tras el click: así Espacio vuelve a ser del juego. */
const blurAfter = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.blur();
  fn();
};

function PlayerHud({ game, name, score, lives, level, paused, canPause, onTogglePause, onEnd }: HudProps) {
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
          <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
        </div>
        <div className="hud-stat level">
          <div className="l">Nivel</div>
          <div className="v">{String(level).padStart(2, "0")}</div>
        </div>
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
  score: number;
  name: string;
  onNameChange: (name: string) => void;
  saved: boolean;
  onSave: () => void;
  onRestart: () => void;
}

function GameOverModal({ score, name, onNameChange, saved, onSave, onRestart }: GameOverModalProps) {
  return (
    <div className="modal-bd">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Fin del juego">
        <h2>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{formatScore(score)}</div>
        {!saved ? (
          <div className="input-row">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="TUS INICIALES"
              aria-label="Tus iniciales"
            />
            {/* Sin persistencia todavía: solo muestra el toast. */}
            <button type="button" className="btn yellow" onClick={onSave}>
              GUARDAR PUNTUACIÓN
            </button>
          </div>
        ) : (
          <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
        )}
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

// ── ASTEROIDES (juego real) ──────────────────────────────────────────────────

const INITIAL_SNAPSHOT: AsteroidsSnapshot = { phase: "ready", paused: false, score: 0, lives: 3, level: 1 };

function AsteroidsPlayer({ game, playerName }: { game: PlayerGame; playerName: string }) {
  const gameRef = useRef<AsteroidsGame | null>(null);
  const [snapshot, setSnapshot] = useState<AsteroidsSnapshot>(INITIAL_SNAPSHOT);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(playerName);
  const [saved, setSaved] = useState(false);

  const onChange = useCallback((s: AsteroidsSnapshot) => setSnapshot(s), []);
  const canPause = !over && (snapshot.phase === "playing" || snapshot.phase === "dead");

  const endGame = () => {
    gameRef.current?.pause();
    setOver(true);
  };

  const restart = () => {
    gameRef.current?.restart();
    setOver(false);
    setSaved(false);
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        game={game}
        name={playerName}
        score={snapshot.score}
        lives={snapshot.lives}
        level={snapshot.level}
        paused={snapshot.paused}
        canPause={canPause}
        onTogglePause={() => gameRef.current?.togglePause()}
        onEnd={endGame}
      />

      <Crt title={game.title}>
        <AsteroidsScreen gameRef={gameRef} onChange={onChange} phase={snapshot.phase} inputEnabled={!over} />
        {snapshot.paused && !over && <PauseOverlay hint="PULSA REANUDAR, P O ESC PARA CONTINUAR" />}
      </Crt>

      {over && (
        <GameOverModal
          score={snapshot.score}
          name={name}
          onNameChange={setName}
          saved={saved}
          onSave={() => setSaved(true)}
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

function SimulatedPlayer({ game }: { game: PlayerGame }) {
  const [run, setRun] = useState<Run>(INITIAL_RUN);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        game={game}
        name={name}
        score={score}
        lives={lives}
        level={level}
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
          score={score}
          name={name}
          onNameChange={setName}
          saved={saved}
          onSave={() => setSaved(true)}
          onRestart={restart}
        />
      )}
    </div>
  );
}
