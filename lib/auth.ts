// Tipos y validación del formulario de /auth. Sin "use server": importable desde servidor y cliente.

export const AUTH_LIMITS = { username: { min: 3, max: 16 }, email: 254, password: { min: 8, max: 72 } } as const;
export const USERNAME_RE = /^[a-z0-9_]{3,16}$/;

export interface SignInInput {
  email: string; // tras trim, 1..254, regex EMAIL_RE
  password: string; // sin trim, 8..72
}
export interface SignUpInput extends SignInInput {
  username: string; // ya en minúsculas, USERNAME_RE
}

export type AuthErrorCode =
  | "VALIDATION"
  | "CONFIG"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "USERNAME_TAKEN"
  | "RATE_LIMIT"
  | "AUTH";

export type AuthState =
  | { status: "idle" }
  | { status: "signup-sent"; email: string; id: number }
  | { status: "error"; code: AuthErrorCode; message: string; id: number };

/** Mensajes al usuario (sin el prefijo `[ERR]`, que añade la UI). `VALIDATION` lleva el detalle aparte. */
export const AUTH_ERROR_MESSAGES: Record<Exclude<AuthErrorCode, "VALIDATION">, string> = {
  CONFIG: "Servicio de autenticación no configurado.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  EMAIL_NOT_CONFIRMED: "Confirma tu correo antes de entrar.",
  USERNAME_TAKEN: "Ese usuario ya está en uso.",
  RATE_LIMIT: "Demasiados intentos. Espera unos minutos.",
  AUTH: "El servidor de autenticación no respondió.",
};

/** Error de `/auth?error=confirm` (enlace de confirmación inválido o expirado). */
export const CONFIRM_ERROR_MESSAGE = "El enlace de confirmación no es válido o expiró.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Check = { ok: true; value: string } | { ok: false; message: string };

function checkEmail(value: unknown): Check {
  if (typeof value !== "string") return { ok: false, message: "falta el correo." };
  const email = value.trim();
  if (email.length === 0) return { ok: false, message: "el correo está vacío." };
  if (email.length > AUTH_LIMITS.email) {
    return { ok: false, message: `el correo supera los ${AUTH_LIMITS.email} caracteres.` };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, message: "el correo no tiene un formato válido." };
  return { ok: true, value: email };
}

/** La contraseña no se recorta: los espacios forman parte de ella. */
function checkPassword(value: unknown): Check {
  const { min, max } = AUTH_LIMITS.password;
  if (typeof value !== "string" || value.length === 0) return { ok: false, message: "falta la contraseña." };
  if (value.length < min) return { ok: false, message: `la contraseña debe tener al menos ${min} caracteres.` };
  if (value.length > max) return { ok: false, message: `la contraseña supera los ${max} caracteres.` };
  return { ok: true, value };
}

/** El alias se recorta y se pasa a minúsculas antes de validarlo. */
function checkUsername(value: unknown): Check {
  const { min, max } = AUTH_LIMITS.username;
  if (typeof value !== "string") return { ok: false, message: "falta el usuario." };
  const username = value.trim().toLowerCase();
  if (username.length === 0) return { ok: false, message: "el usuario está vacío." };
  if (username.length < min || username.length > max) {
    return { ok: false, message: `el usuario debe tener entre ${min} y ${max} caracteres.` };
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, message: "el usuario solo admite letras, números y guion bajo (_)." };
  }
  return { ok: true, value: username };
}

export function validateSignIn(raw: {
  email: unknown;
  password: unknown;
}): { ok: true; data: SignInInput } | { ok: false; message: string } {
  const email = checkEmail(raw.email);
  if (!email.ok) return email;
  const password = checkPassword(raw.password);
  if (!password.ok) return password;
  return { ok: true, data: { email: email.value, password: password.value } };
}

export function validateSignUp(raw: {
  username: unknown;
  email: unknown;
  password: unknown;
}): { ok: true; data: SignUpInput } | { ok: false; message: string } {
  const username = checkUsername(raw.username);
  if (!username.ok) return username;
  const rest = validateSignIn(raw);
  if (!rest.ok) return rest;
  return { ok: true, data: { username: username.value, ...rest.data } };
}
