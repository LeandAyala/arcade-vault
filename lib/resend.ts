import "server-only";

import { createElement } from "react";
import { Resend } from "resend";
import { ContactMessageEmail } from "@/emails/contact-message";
import type { ContactErrorCode, ContactInput } from "@/lib/contact";

const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";

export type SendContactResult = { ok: true } | { ok: false; code: Exclude<ContactErrorCode, "VALIDATION"> };

/** Una variable vacía (como quedan al copiar `.env.example`) cuenta como no definida. */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Versión en texto plano del correo, para clientes que no muestran HTML. */
function toText({ name, email, message }: ContactInput): string {
  return [
    "ARCADE VAULT — NUEVO MENSAJE DE CONTACTO",
    "",
    `Nombre: ${name}`,
    `Correo: ${email}`,
    "",
    "Mensaje:",
    message,
    "",
    "---",
    `Responde a este correo para contestar directamente a ${name}.`,
  ].join("\n");
}

/**
 * Envía el mensaje de contacto al buzón del equipo.
 * Las variables de entorno se leen en cada llamada y el cliente se crea aquí dentro (nunca a nivel
 * de módulo): sin `RESEND_API_KEY` el constructor falla, y el build no debe depender del `.env`.
 * El detalle de cualquier error solo va a la consola del servidor.
 */
export async function sendContactEmail(input: ContactInput): Promise<SendContactResult> {
  const key = env("RESEND_API_KEY");
  const to = env("CONTACT_TO_EMAIL");
  const from = env("CONTACT_FROM_EMAIL") ?? DEFAULT_FROM;

  if (!key || !to) {
    const missing = [!key && "RESEND_API_KEY", !to && "CONTACT_TO_EMAIL"].filter(Boolean).join(", ");
    console.error(`[contacto] Servicio de correo no configurado: falta ${missing}.`);
    return { ok: false, code: "CONFIG" };
  }

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: input.email,
      subject: `[ARCADE VAULT] Mensaje de ${input.name}`,
      react: createElement(ContactMessageEmail, input),
      text: toText(input),
    });

    if (error) {
      console.error("[contacto] Resend rechazó el envío:", error);
      return { ok: false, code: "SEND" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[contacto] Error inesperado al enviar con Resend:", err);
    return { ok: false, code: "SEND" };
  }
}
