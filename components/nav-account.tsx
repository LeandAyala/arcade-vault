import { signOut } from "@/app/auth/actions";
import { NavAuthLink, SignOutButton } from "@/components/nav";
import { getSessionProfile } from "@/lib/session";

type Variant = "desktop" | "mobile";

/**
 * Área de cuenta del nav (Server Component). Lee la sesión, así que siempre va dentro de
 * `<Suspense>` con `<NavAccountPlaceholder>` del mismo tamaño como fallback.
 * Con sesión: ficha de jugador `1P` + alias en mayúsculas + SALIR. Sin sesión: "Iniciar Sesión".
 */
export async function NavAccount({ variant }: { variant: Variant }) {
  const profile = await getSessionProfile();
  if (!profile) return <NavAuthLink variant={variant} />;

  const alias = profile.username.toUpperCase();

  return (
    <div className={variant === "desktop" ? "av-account" : "av-mobile-account"}>
      <span className="player-tag" title={`Sesión iniciada como ${alias}`}>
        <span className="p1" aria-hidden="true">
          1P
        </span>
        <span className="alias">{alias}</span>
      </span>
      <form action={signOut}>
        <SignOutButton />
      </form>
    </div>
  );
}

/** Mismo tamaño que el botón / link "Iniciar Sesión", invisible: evita el salto al resolver la sesión. */
export function NavAccountPlaceholder({ variant }: { variant: Variant }) {
  if (variant === "desktop") {
    return (
      <span className="btn auth-btn nav-account-placeholder" aria-hidden="true">
        Iniciar Sesión
      </span>
    );
  }
  return (
    <a className="nav-account-placeholder" aria-hidden="true" tabIndex={-1}>
      Iniciar Sesión
    </a>
  );
}
