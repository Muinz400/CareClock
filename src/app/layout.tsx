import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { LegacyChromeGate } from "../components/legacy/LegacyChromeGate";

// Self-hosted at build time (confirmed working in this environment).
// Only defines the --cc-font-plex-*-loaded CSS variables below — inert
// until an Operations Deck component's font-family references them via
// --cc-font-family-sans/-mono (see globals.css). No existing page or
// component uses these yet, so this has no visual effect on its own.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--cc-font-plex-sans-loaded",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--cc-font-plex-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CareClock",
  description: "A simple GPS-Verified timesheet for home care agencies",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <LegacyChromeGate>{children}</LegacyChromeGate>
      </body>
    </html>
  );
}
