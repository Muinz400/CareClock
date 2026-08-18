"use client";

import { usePathname } from "next/navigation";
import { LegacyHeader } from "./LegacyHeader";

/*
  Temporary transitional mechanism only — see the Operations Deck migration
  plan, Step 1. Grows by exactly one entry per migration step as each route
  moves into its own (public)/(admin)/(caregiver) route-group layout (which
  provides its own real chrome). Deleted in its entirety, along with the
  single import of this file in src/app/layout.tsx, once every route has
  migrated and this array covers the whole app.

  Deliberately does nothing besides: read the current pathname, check it
  against this list, and choose whether to render the legacy header. No
  auth, no role checks, no redirects, no Supabase calls, no org logic, no
  feature flags — that all stays where it already lives, on each page,
  until that page's own migration step centralizes it into a real shell.
*/
const MIGRATED_PREFIXES: string[] = ["/", "/login", "/accept-invite", "/home", "/today", "/time", "/people", "/payroll"];

// "/" only ever matches the exact root path here. For any other pathname,
// the startsWith check becomes pathname.startsWith("//") — which no real
// Next.js route ever starts with — so "/" cannot accidentally swallow
// every route the way a naive prefix check might.
function isMigrated(pathname: string | null): boolean {
  if (!pathname) return false;
  return MIGRATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function LegacyChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isMigrated(pathname)) {
    return <>{children}</>;
  }

  return <LegacyHeader>{children}</LegacyHeader>;
}

export default LegacyChromeGate;
