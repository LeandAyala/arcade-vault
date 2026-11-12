import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Iniciar sesión · Arcade Vault",
};

export default function AuthPage() {
  return <AuthForm />;
}
