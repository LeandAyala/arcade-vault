"use server";

import { CONTACT_LIMITS, validateContact, type ContactState } from "@/lib/contact";
import { sendContactEmail } from "@/lib/resend";

const SEND_ERRORS = {
  CONFIG: "Servicio de correo no configurado.",
  SEND: "El servidor de correo no respondió.",
} as const;

/**
 * Acción del formulario de contacto de /acerca-de (para `useActionState`).
 * Cualquiera con el ID de la acción puede invocarla sin pasar por el form: por eso se valida todo aquí.
 */
export async function sendContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const id = Date.now();
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  };

  // Honeypot: un bot rellenó el campo oculto. Se responde éxito sin enviar nada.
  const honeypot = formData.get("hp_token");
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, CONTACT_LIMITS.name) : "";
    return { status: "success", name, id };
  }

  const result = validateContact(raw);
  if (!result.ok) {
    return { status: "error", code: "VALIDATION", message: `Datos inválidos: ${result.message}`, id };
  }

  const sent = await sendContactEmail(result.data);
  if (!sent.ok) {
    return { status: "error", code: sent.code, message: SEND_ERRORS[sent.code], id };
  }
  return { status: "success", name: result.data.name, id };
}
