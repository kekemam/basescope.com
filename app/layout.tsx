import type { Metadata } from "next";
import { Martian_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-martian-mono",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

export const metadata: Metadata = {
  title: "Basescope",
  description: "A tua app feita com IA está a expor a base de dados?",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // O ThemeScript pode mudar data-theme para "light" antes da hidratação
    // (ver components/theme/theme-script.tsx) — suppressHydrationWarning
    // evita o aviso de mismatch nesse único atributo, controlado por design.
    <html lang="pt-PT" data-theme="dark" suppressHydrationWarning>
      <body
        className={`${martianMono.variable} ${ibmPlexMono.variable} ${ibmPlexSans.variable} font-prosa`}
      >
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
