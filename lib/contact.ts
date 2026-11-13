// Tipos y validación del formulario de contacto. Sin "use server": importable desde servidor y cliente.

export const CONTACT_LIMITS = { name: 60, email: 254, message: 2000 } as const;

export interface ContactInput {
  name: string;     // tras trim, 1..60
  email: string;    // tras trim, 1..254, regex EMAIL_RE
  message: string;  // tras trim, 1..2000
}

export type ContactErrorCode = "VALIDATION" | "CONFIG" | "SEND";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string; id: number }
  | { status: "error"; code: ContactErrorCode; message: string; id: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_LABELS = { name: "el nombre", email: "el correo", message: "el mensaje" } as const;

type Field = keyof typeof CONTACT_LIMITS;

/** Devuelve el valor recortado o un mensaje de error en español apto para el usuario. */
function checkField(field: Field, value: unknown): { ok: true; value: string } | { ok: false; message: string } {
  const label = FIELD_LABELS[field];
  if (typeof value !== "string") return { ok: false, message: `falta ${label}.` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, message: `${label} está vacío.` };
  if (trimmed.length > CONTACT_LIMITS[field]) {
    return { ok: false, message: `${label} supera los ${CONTACT_LIMITS[field]} caracteres.` };
  }
  return { ok: true, value: trimmed };
}

export function validateContact(
  raw: { name: unknown; email: unknown; message: unknown },
): { ok: true; data: ContactInput } | { ok: false; message: string } {
  const name = checkField("name", raw.name);
  if (!name.ok) return name;

  const email = checkField("email", raw.email);
  if (!email.ok) return email;
  if (!EMAIL_RE.test(email.value)) return { ok: false, message: "el correo no tiene un formato válido." };

  const message = checkField("message", raw.message);
  if (!message.ok) return message;

  return { ok: true, data: { name: name.value, email: email.value, message: message.value } };
}
