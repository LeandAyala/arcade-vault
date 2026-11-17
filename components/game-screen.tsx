"use client";

import { Fragment, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import type { GameEngine, GamePhase, GameSnapshot, RealGameDef } from "@/lib/games/types";

interface GameScreenProps {
  def: RealGameDef;
  /** El padre controla el motor (pausa, FIN, reinicio) a través de esta ref. */
  engineRef: RefObject<GameEngine | null>;
  onChange: (snapshot: GameSnapshot) => void;
  phase: GamePhase;
  /** `false` con el modal de FIN abierto: el teclado es del modal. */
  inputEnabled: boolean;
}

/** Sin teclado: solo puntero grueso (táctil) y ningún puntero fino. */
const NO_KEYBOARD_QUERY = "(pointer: coarse) and (not (any-pointer: fine))";

function subscribeNoKeyboard(callback: () => void) {
  const mql = window.matchMedia(NO_KEYBOARD_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
const getNoKeyboard = () => window.matchMedia(NO_KEYBOARD_QUERY).matches;
const getNoKeyboardServer = () => false;

/** Ajusta la resolución del canvas al devicePixelRatio; el mundo lógico no cambia. */
function fitCanvas(canvas: HTMLCanvasElement, world: RealGameDef["world"]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.round(world.width * dpr);
  const height = Math.round(world.height * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

/**
 * Canvas de un juego real dentro del `.crt-screen` (4:3) más su pantalla de inicio. Un mundo con
 * otra proporción se ve con letterbox (`object-fit: contain`).
 */
export function GameScreen({ def, engineRef, onChange, phase, inputEnabled }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  const noKeyboard = useSyncExternalStore(subscribeNoKeyboard, getNoKeyboard, getNoKeyboardServer);
  const { create, world } = def;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Un motor por montaje. El cleanup lo destruye (también en el doble montaje de StrictMode).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fitCanvas(canvas, world);
    const engine = create(canvas, { onChange: (s) => onChangeRef.current(s) });
    engineRef.current = engine;

    // El zoom del navegador cambia el devicePixelRatio y dispara `resize`.
    const onResize = () => fitCanvas(canvas, world);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [engineRef, create, world]);

  useEffect(() => {
    engineRef.current?.setInputEnabled(inputEnabled);
  }, [engineRef, inputEnabled]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={world.width}
        height={world.height}
        aria-label={`Partida de ${def.startTitle}`}
        role="img"
      />
      {phase === "ready" && (
        // Click en cualquier parte de la pantalla de inicio = empezar (salvo sin teclado).
        <div className="crt-content game-start" onClick={noKeyboard ? undefined : () => engineRef.current?.start()}>
          <div>
            <div className="game-start-title">{def.startTitle}</div>
            <ul className="game-keys" aria-label="Controles">
              {def.controls.map((c) => (
                <li key={c.label}>
                  {c.keys.map((k) => (
                    <Fragment key={k}>
                      <kbd>{k}</kbd>{" "}
                    </Fragment>
                  ))}
                  {c.label}
                </li>
              ))}
            </ul>
            {noKeyboard ? (
              <div className="game-prompt game-prompt-warn">REQUIERE TECLADO</div>
            ) : (
              <button type="button" className="game-prompt">
                PULSA ESPACIO PARA EMPEZAR
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
