"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  AUTH_ERROR_MESSAGES,
  validateSignIn,
  validateSignUp,
  type AuthErrorCode,
  type AuthState,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ServerErrorCode = Exclude<AuthErrorCode, "VALIDATION">;

function fail(code: ServerErrorCode, id: number): AuthState {
  return { status: "error", code, message: AUTH_ERROR_MESSAGES[code], id };
}

function invalid(detail: string, id: number): AuthState {
  return { status: "error", code: "VALIDATION", message: `Datos inválidos: ${detail}`, id };
}

/**
 * Traduce un error de Supabase Auth a un código propio. El detalle solo va a la consola del servidor.
 * Si el trigger `handle_new_user` falla (alias repetido en una carrera entre dos registros),
 * Auth responde "Database error saving new user": se trata como `USERNAME_TAKEN`.
 */
function mapAuthError(error: AuthError, context: string): ServerErrorCode {
  console.error(`[auth] ${context}:`, { code: error.code, status: error.status, message: error.message });
  switch (error.code) {
    case "invalid_credentials":
      return "INVALID_CREDENTIALS";
    case "email_not_confirmed":
      return "EMAIL_NOT_CONFIRMED";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "RATE_LIMIT";
  }
  if (/database error saving new user/i.test(error.message)) return "USERNAME_TAKEN";
  return "AUTH";
}

/**
 * Registro (para `useActionState`). Cualquiera con el ID de la acción puede invocarla sin pasar
 * por el form: por eso se valida todo aquí.
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const id = Date.now();
  const result = validateSignUp({
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!result.ok) return invalid(result.message, id);
  const { username, email, password } = result.data;

  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] Servicio de autenticación no configurado: faltan NEXT_PUBLIC_SUPABASE_*.");
    return fail("CONFIG", id);
  }

  try {
    // Pre-chequeo para dar un mensaje claro; el unique + trigger cubren la carrera.
    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (lookupError) {
      console.error("[auth] No se pudo comprobar el alias:", lookupError);
      return fail("AUTH", id);
    }
    if (existing) return fail("USERNAME_TAKEN", id);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return fail(mapAuthError(error, "signUp"), id);
  } catch (err) {
    console.error("[auth] Error inesperado en signUp:", err);
    return fail("AUTH", id);
  }

  // Con "Confirm email" activo, un correo ya registrado también llega aquí (anti-enumeración).
  return { status: "signup-sent", email, id };
}

/** Inicio de sesión (para `useActionState`). Si va bien, redirige a /biblioteca. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const id = Date.now();
  const result = validateSignIn({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!result.ok) return invalid(result.message, id);

  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] Servicio de autenticación no configurado: faltan NEXT_PUBLIC_SUPABASE_*.");
    return fail("CONFIG", id);
  }

  try {
    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error) return fail(mapAuthError(error, "signIn"), id);
  } catch (err) {
    console.error("[auth] Error inesperado en signIn:", err);
    return fail("AUTH", id);
  }

  // Fuera del try: redirect() lanza una excepción que Next debe recibir.
  redirect("/biblioteca");
}

/** Cierre de sesión (acción de `<form>` del nav). Siempre redirige a /. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[auth] signOut:", { code: error.code, message: error.message });
    } catch (err) {
      console.error("[auth] Error inesperado en signOut:", err);
    }
  }
  redirect("/");
}
