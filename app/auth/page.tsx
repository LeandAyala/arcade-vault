import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Iniciar sesión · Arcade Vault",
};

/**
 * `AuthForm` lee `?error=confirm` con `useSearchParams()` (dato de petición), así que va dentro
 * de `<Suspense>`. El fallback es el mismo formulario sin ese error: el shell estático ya
 * muestra la tarjeta completa.
 */
export default function AuthPage() {
  return (
    <Suspense fallback={<AuthCard />}>
      <AuthForm />
    </Suspense>
  );
}
