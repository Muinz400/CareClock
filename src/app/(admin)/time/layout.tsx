"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { tokens } from "../../../styles/tokens";

/*
  Shared chrome for every /time/* page. Only "Live" is real this round —
  Timesheets and Exceptions are shown as visible, non-interactive "Soon"
  placeholders (same pattern as Sidebar/BottomNav), not built yet. When
  B2/B3 land, their page.tsx files slot in under this same layout with no
  changes needed here beyond flipping `available: true`.
*/

interface TimeTab {
  label: string;
  href: string;
  available: boolean;
}

const TIME_TABS: TimeTab[] = [
  { label: "Live", href: "/time/live", available: true },
  { label: "Timesheets", href: "/time/timesheets", available: true },
  { label: "Exceptions", href: "/time/exceptions", available: false },
];

export default function TimeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h1
          style={{
            fontSize: tokens.typography.size["2xl"],
            fontWeight: tokens.typography.weight.bold,
            margin: "0 0 12px",
          }}
        >
          Time & Attendance
        </h1>

        <nav
          aria-label="Time & Attendance sections"
          style={{
            display: "flex",
            gap: tokens.spacing[1],
            borderBottom: `1px solid ${tokens.paper.border}`,
          }}
        >
          {TIME_TABS.map((tab) => {
            const isActive =
              tab.available && (pathname === tab.href || pathname.startsWith(`${tab.href}/`));

            if (!tab.available) {
              return (
                <span
                  key={tab.href}
                  aria-disabled="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    minHeight: 40,
                    fontSize: tokens.typography.size.sm,
                    color: tokens.paper.inkFaint,
                  }}
                >
                  {tab.label}
                  <span
                    style={{
                      fontFamily: tokens.fontFamilyOpsDeck.mono,
                      fontSize: 9,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      border: `1px solid ${tokens.paper.border}`,
                      borderRadius: 4,
                      padding: "1px 5px",
                    }}
                  >
                    Soon
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                  minHeight: 40,
                  fontSize: tokens.typography.size.sm,
                  fontWeight: isActive ? tokens.typography.weight.semibold : tokens.typography.weight.regular,
                  color: isActive ? tokens.paper.ink : tokens.paper.inkMuted,
                  borderBottom: isActive ? `2px solid ${tokens.signal.base}` : "2px solid transparent",
                  marginBottom: -1,
                  textDecoration: "none",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
