"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { signIn, signUp } from "@/app/auth/actions";
import { AUTH_LIMITS, CONFIRM_ERROR_MESSAGE, validateSignIn, validateSignUp, type AuthState } from "@/lib/auth";

type Tab = "in" | "up";

const IDLE: AuthState = { status: "idle" };
const EMPTY = { username: "", email: "", password: "" };

/**
 * Lee `?error=confirm` (enlace de confirmación inválido o expirado). `useSearchParams()` es dato
 * de petición: `app/auth/page.tsx` envuelve este componente en `<Suspense>` con `<AuthCard />`
 * como fallback, que es el mismo formulario sin ese error.
 */
export function AuthForm() {
  const confirmError = useSearchParams().get("error") === "confirm";
  return <AuthCard confirmError={confirmError} />;
}

export function AuthCard({ confirmError = false }: { confirmError?: boolean }) {
  const [tab, setTab] = useState<Tab>("in");
  const [form, setForm] = useState(EMPTY);

  const [inState, inAction, inPending] = useActionState(signIn, IDLE);
  const [upState, upAction, upPending] = useActionState(signUp, IDLE);

  // Resultados que el usuario ya descartó (cambio de tab, VOLVER), por tab.
  const [dismissed, setDismissed] = useState<Record<Tab, number | null>>({ in: null, up: null });
  // Error de validación del cliente (mismas reglas que el servidor), sin petición.
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmDismissed, setConfirmDismissed] = useState(false);

  // Tras un error del servidor la contraseña se vacía (ajuste de estado durante el render).
  const [handled, setHandled] = useState<Record<Tab, number | null>>({ in: null, up: null });
  for (const [key, s] of [["in", inState], ["up", upState]] as const) {
    if (s.status === "error" && s.id !== handled[key]) {
      setHandled((h) => ({ ...h, [key]: s.id }));
      setForm((f) => ({ ...f, password: "" }));
    }
  }

  const isPending = tab === "in" ? inPending : upPending;
  const state = tab === "in" ? inState : upState;
  const result = state.status !== "idle" && state.id !== dismissed[tab] ? state : null;

  // Bloqueo síncrono: un doble click llega antes de que `isPending` se pinte y deshabilite el botón.
  const inFlight = useRef(false);
  useEffect(() => {
    if (!inPending && !upPending) inFlight.current = false;
  }, [inPending, upPending]);

  const errorMessage =
    localError ??
    (result?.status === "error" ? result.message : null) ??
    (confirmError && !confirmDismissed ? CONFIRM_ERROR_MESSAGE : null);

  /** Descarta el resultado visible de ambos tabs y los errores locales. */
  const clearNotices = () => {
    setDismissed({
      in: inState.status === "idle" ? null : inState.id,
      up: upState.status === "idle" ? null : upState.id,
    });
    setLocalError(null);
    setConfirmDismissed(true);
  };

  const switchTab = (next: Tab) => {
    if (next === tab || isPending) return;
    clearNotices();
    setTab(next);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Siempre se previene el submit nativo: la acción se lanza a mano para que React no resetee el form.
    e.preventDefault();
    if (isPending || inFlight.current) return;

    const check = tab === "in" ? validateSignIn(form) : validateSignUp(form);
    clearNotices();
    if (!check.ok) {
      setLocalError(`Datos inválidos: ${check.message}`);
      setForm((f) => ({ ...f, password: "" }));
      return;
    }

    const data = new FormData(e.currentTarget);
    inFlight.current = true;
    startTransition(() => (tab === "in" ? inAction(data) : upAction(data)));
  };

  /** Desde la terminal de registro: vuelve al login con el correo ya escrito. */
  const backToSignIn = () => {
    clearNotices();
    setForm((f) => ({ ...f, username: "", password: "" }));
    setTab("in");
  };

  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button type="button" className={tab === "in" ? "on" : ""} onClick={() => switchTab("in")}>
            INICIAR SESIÓN
          </button>
          <button type="button" className={tab === "up" ? "on" : ""} onClick={() => switchTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        {result?.status === "signup-sent" ? (
          <div className="terminal-success auth-terminal" role="status">
            <div className="term-bar">
              <span className="dot r"></span>
              <span className="dot y"></span>
              <span className="dot g"></span>
              <span className="term-title">VAULT-OS // TERMINAL</span>
            </div>
            <div className="term-body">
              <div className="line">
                <span className="prompt">vault@arcade:~$</span> ./create_player
              </div>
              <div className="line dim">[OK] Reservando alias…</div>
              <div className="line dim">[OK] Enviando enlace de activación…</div>
              <div className="line success">
                &gt; REVISA TU CORREO
                {"\n"}
                <span className="dim">Enviamos el enlace a</span> {result.email}
                <span className="caret">_</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <button className="btn ghost" type="button" onClick={backToSignIn}>
                  VOLVER A INICIAR SESIÓN
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {tab === "up" && (
              <div className="field slide-in">
                <label htmlFor="auth-user">Usuario</label>
                <input
                  id="auth-user"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={AUTH_LIMITS.username.max}
                  value={form.username}
                  onChange={set("username")}
                  placeholder="px_kai"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="auth-email">Correo electrónico</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={AUTH_LIMITS.email}
                value={form.email}
                onChange={set("email")}
                placeholder="jugador@vault.gg"
              />
            </div>
            <div className="field">
              <label htmlFor="auth-pass">Contraseña</label>
              <input
                id="auth-pass"
                name="password"
                type="password"
                autoComplete={tab === "in" ? "current-password" : "new-password"}
                maxLength={AUTH_LIMITS.password.max}
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
              />
            </div>

            {errorMessage && (
              <div className="auth-error" role="alert">
                [ERR] {errorMessage}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              style={{ width: "100%", marginTop: 8 }}
            >
              {isPending ? (
                <>
                  <span className="spinner" aria-hidden="true" style={{ marginRight: 12, verticalAlign: "middle" }}></span>
                  CONECTANDO…
                </>
              ) : tab === "in" ? (
                "ENTRAR AL VAULT"
              ) : (
                "CREAR Y JUGAR"
              )}
            </button>
          </form>
        )}

        <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 10 }}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆  GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣  GITHUB
          </button>
        </div>

        <div
          style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
