import type { Metadata } from "next";
import { Martian_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
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
  weight: ["400"],
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
    <html lang="pt-PT" className="dark">
      <body
        className={`${martianMono.variable} ${ibmPlexMono.variable} ${ibmPlexSans.variable} font-prosa`}
      >
        {children}
      </body>
    </html>
  );
}
