"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokens } from "../../styles/tokens";

interface NavItem {
  label: string;
  href: string;
  /** Real routes are clickable Links; everything else is a visible,
   * clearly non-interactive placeholder — never a fake href="#" link. */
  available: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home", available: true },
  { label: "Schedule", href: "/schedule", available: false },
  { label: "Time", href: "/time", available: true },
  { label: "People", href: "/people", available: true },
  { label: "Payroll", href: "/payroll", available: false },
  { label: "Places", href: "/places", available: false },
  { label: "Clients", href: "/clients", available: false },
  { label: "Settings", href: "/settings", available: false },
];

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: `${tokens.spacing[3]} ${tokens.spacing[2]}`,
        background: tokens.shell.bg,
        borderRight: `1px solid ${tokens.shell.border}`,
        height: "100%",
        overflow: "hidden",
        fontFamily: tokens.fontFamilyOpsDeck.sans,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: `${tokens.spacing[2]} ${tokens.spacing[2]} ${tokens.spacing[4]}`,
          whiteSpace: "nowrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            flex: "none",
            borderRadius: tokens.radius.structural,
            background: tokens.signal.base,
            color: "#1a1305",
            fontWeight: 800,
            fontSize: 11,
            fontFamily: tokens.fontFamilyOpsDeck.mono,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          C
        </span>
        {!collapsed && (
          <span style={{ fontWeight: 700, fontSize: 13.5, color: tokens.shell.ink }}>
            CareClock
          </span>
        )}
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.available && (pathname === item.href || pathname.startsWith(`${item.href}/`));

          if (!item.available) {
            return (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "space-between",
                    gap: 10,
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    borderRadius: tokens.radius.structural,
                    fontSize: tokens.typography.size.sm,
                    color: tokens.shell.inkFaint,
                    minHeight: 40,
                  }}
                >
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && (
                    <span
                      style={{
                        fontFamily: tokens.fontFamilyOpsDeck.mono,
                        fontSize: 9.5,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        border: `1px solid ${tokens.shell.border}`,
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      Soon
                    </span>
                  )}
                </span>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: 10,
                  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                  borderRadius: tokens.radius.structural,
                  fontSize: tokens.typography.size.sm,
                  fontWeight: isActive ? tokens.typography.weight.semibold : tokens.typography.weight.regular,
                  color: isActive ? tokens.signal.base : tokens.shell.inkMuted,
                  background: isActive ? tokens.signal.softShell : "transparent",
                  minHeight: 40,
                  textDecoration: "none",
                }}
              >
                {!collapsed && item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Sidebar;
