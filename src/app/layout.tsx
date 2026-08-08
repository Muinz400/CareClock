import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { LegacyChromeGate } from "../components/legacy/LegacyChromeGate";

export const metadata: Metadata = {
  title: "CareClock",
  description: "A simple GPS-Verified timesheet for home care agencies",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <LegacyChromeGate>{children}</LegacyChromeGate>
      </body>
    </html>
  );
}
