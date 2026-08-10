"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokens } from "../../styles/tokens";

interface TabItem {
  label: string;
  href: string;
  /** Real routes are clickable Links; everything else is a visible,
   * clearly non-interactive placeholder — never a fake href="#" link. */
  available: boolean;
}

const TAB_ITEMS: TabItem[] = [
  { label: "Today", href: "/today", available: true },
  { label: "Schedule", href: "/my/schedule", available: false },
  { label: "Timesheet", href: "/my/timesheet", available: false },
  { label: "Profile", href: "/my/profile", available: false },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="cc-caregiver-tabbar">
      {TAB_ITEMS.map((tab) => {
        const isActive = tab.available && (pathname === tab.href || pathname.startsWith(`${tab.href}/`));

        if (!tab.available) {
          return (
            <span
              key={tab.href}
              aria-disabled="true"
              className="cc-caregiver-tab"
              style={{ color: tokens.shell.inkFaint }}
            >
              {tab.label}
              <span
                style={{
                  fontFamily: tokens.fontFamilyOpsDeck.mono,
                  fontSize: 8.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
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
            className="cc-caregiver-tab"
            style={{
              color: isActive ? tokens.action.onStrong : tokens.shell.inkMuted,
              textDecoration: "none",
              fontWeight: isActive ? tokens.typography.weight.semibold : tokens.typography.weight.regular,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isActive ? tokens.action.on : "transparent",
              }}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
