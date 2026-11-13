"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { sendContactMessage } from "@/app/acerca-de/actions";
import { CONTACT_LIMITS, type ContactState } from "@/lib/contact";

const EMPTY = { name: "", email: "", message: "" };
const IDLE: ContactState = { status: "idle" };

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(sendContactMessage, IDLE);
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);
  // `id` del último resultado que el usuario descartó: el form vuelve a verse sin recargar.
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  // Bloqueo síncrono: un doble click llega antes de que `isPending` se pinte y deshabilite el botón.
  const inFlight = useRef(false);
  useEffect(() => {
    if (!isPending) inFlight.current = false;
  }, [isPending]);

  const result = state.status !== "idle" && state.id !== dismissedId ? state : null;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Siempre se previene el submit nativo: la acción se lanza a mano para que React no resetee el form.
    e.preventDefault();
    if (isPending || inFlight.current) return;
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const data = new FormData(e.currentTarget);
    inFlight.current = true;
    startTransition(() => formAction(data));
  };

  const dismiss = () => {
    if (result) setDismissedId(result.id);
  };

  /** REINTENTAR: vuelve al form conservando lo escrito. */
  const retry = dismiss;

  /** ENVIAR OTRO MENSAJE: vuelve al form vacío. */
  const sendAnother = () => {
    dismiss();
    setForm(EMPTY);
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      {result === null ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              maxLength={CONTACT_LIMITS.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              maxLength={CONTACT_LIMITS.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-message">MENSAJE</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={form.message}
              maxLength={CONTACT_LIMITS.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
            ></textarea>
          </div>
          {/* Honeypot: invisible para personas; si llega relleno, el servidor descarta el mensaje. */}
          <div className="hp-field" aria-hidden="true">
            <input type="text" name="hp_token" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <button
            className="btn xl press"
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            style={{ width: "100%" }}
          >
            {isPending ? (
              <>
                <span className="spinner" aria-hidden="true" style={{ marginRight: 12, verticalAlign: "middle" }}></span>
                TRANSMITIENDO…
              </>
            ) : (
              "▶  ENVIAR MENSAJE"
            )}
          </button>
        </>
      ) : (
        <div className={"terminal-success" + (result.status === "error" ? " error" : "")} role="status">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            {result.status === "success" ? (
              <>
                <div className="line dim">[OK] Conectando con servidor…</div>
                <div className="line dim">[OK] Validando contenido…</div>
                <div className="line dim">[OK] Transmitiendo paquete…</div>
                <div className="line success">
                  &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {result.name.toUpperCase()}.
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="btn ghost" type="button" onClick={sendAnother}>
                    ENVIAR OTRO MENSAJE
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="line error">
                  [ERR] {result.message}
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button className="btn ghost" type="button" onClick={retry}>
                    REINTENTAR
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
