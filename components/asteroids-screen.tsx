"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { H, W } from "@/lib/games/asteroids/constants";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsPhase,
  type AsteroidsSnapshot,
} from "@/lib/games/asteroids/engine";

interface AsteroidsScreenProps {
  /** El padre controla el motor (pausa, FIN, reinicio) a través de esta ref. */
  gameRef: RefObject<AsteroidsGame | null>;
  onChange: (snapshot: AsteroidsSnapshot) => void;
  phase: AsteroidsPhase;
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

/** Ajusta la resolución del canvas al devicePixelRatio; el mundo sigue siendo 800×600. */
function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.round(W * dpr);
  const height = Math.round(H * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

export function AsteroidsScreen({ gameRef, onChange, phase, inputEnabled }: AsteroidsScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  const noKeyboard = useSyncExternalStore(subscribeNoKeyboard, getNoKeyboard, getNoKeyboardServer);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Un motor por montaje. El cleanup lo destruye (también en el doble montaje de StrictMode).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fitCanvas(canvas);
    const game = createAsteroidsGame(canvas, { onChange: (s) => onChangeRef.current(s) });
    gameRef.current = game;

    // El zoom del navegador cambia el devicePixelRatio y dispara `resize`.
    const onResize = () => fitCanvas(canvas);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [gameRef]);

  useEffect(() => {
    gameRef.current?.setInputEnabled(inputEnabled);
  }, [gameRef, inputEnabled]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="asteroids-canvas"
        width={W}
        height={H}
        aria-label="Partida de ASTEROIDES"
        role="img"
      />
      {phase === "ready" && (
        // Click en cualquier parte de la pantalla de inicio = empezar (salvo sin teclado).
        <div className="crt-content ast-start" onClick={noKeyboard ? undefined : () => gameRef.current?.start()}>
          <div>
            <div className="ast-title">ASTEROIDES</div>
            <ul className="ast-keys" aria-label="Controles">
              <li>
                <kbd>←</kbd>
                <kbd>→</kbd> rotar
              </li>
              <li>
                <kbd>↑</kbd> propulsar
              </li>
              <li>
                <kbd>ESPACIO</kbd> disparar
              </li>
              <li>
                <kbd>P</kbd> pausa
              </li>
            </ul>
            {noKeyboard ? (
              <div className="ast-prompt ast-prompt-warn">REQUIERE TECLADO</div>
            ) : (
              <button type="button" className="ast-prompt">
                PULSA ESPACIO PARA EMPEZAR
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
