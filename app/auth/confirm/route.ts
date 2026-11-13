import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Enlace del correo "Confirm signup":
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * Verifica el token, abre la sesión (cookies) y redirige a /biblioteca.
 * Si el enlace es inválido, ya se usó o expiró → /auth?error=confirm.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const fail = () => NextResponse.redirect(new URL("/auth?error=confirm", request.url));

  if (!tokenHash || !isOtpType(type)) return fail();

  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] /auth/confirm sin NEXT_PUBLIC_SUPABASE_*.");
    return fail();
  }

  try {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error("[auth] verifyOtp:", { code: error.code, status: error.status, message: error.message });
      return fail();
    }
  } catch (err) {
    console.error("[auth] Error inesperado en verifyOtp:", err);
    return fail();
  }

  return NextResponse.redirect(new URL("/biblioteca", request.url));
}
