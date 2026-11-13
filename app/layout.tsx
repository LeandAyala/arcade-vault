import type { Metadata } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { Suspense, type CSSProperties } from "react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { NavAccount, NavAccountPlaceholder } from "@/components/nav-account";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start-2p",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

/**
 * next/font define cada variable como "<Fuente>, <Fuente> Fallback" (Arial ajustada).
 * Para que las pilas de fuentes sean idénticas a las del template, las variables se
 * redefinen solo con la fuente real. Así los glifos que las fuentes web no traen caen en el
 * mismo respaldo que en el template y no en Arial redimensionada:
 *   - mono  (JetBrains Mono → Courier Prime → Courier New): p. ej. el ▲ de .cover-rocas.
 *   - pixel (Press Start 2P → system-ui): p. ej. el ≡ del botón hamburguesa.
 * `adjustFontFallback: false` sería lo idiomático, pero Turbopack (Next 16.4.6) lo ignora.
 */
const primaryFamily = (fontFamily: string) => fontFamily.split(",")[0].trim();
const fontVars = {
  "--font-press-start-2p": primaryFamily(pressStart2P.style.fontFamily),
  "--font-jetbrains-mono": primaryFamily(jetBrainsMono.style.fontFamily),
  "--font-courier-prime": primaryFamily(courierPrime.style.fontFamily),
} as CSSProperties;

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description: "Juega online y compite por la mayor cantidad de puntos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${jetBrainsMono.variable} ${courierPrime.variable}`}
      style={fontVars}
    >
      <body>
        <div className="av-bg" aria-hidden="true" />
        <div className="av-noise" aria-hidden="true" />
        <div id="root">
          {/* La cuenta lee la sesión (cookies): se transmite detrás de <Suspense> y el resto del nav queda en el shell estático. */}
          <Nav
            account={
              <Suspense fallback={<NavAccountPlaceholder variant="desktop" />}>
                <NavAccount variant="desktop" />
              </Suspense>
            }
            mobileAccount={
              <Suspense fallback={<NavAccountPlaceholder variant="mobile" />}>
                <NavAccount variant="mobile" />
              </Suspense>
            }
          />
          <main className="av-main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
