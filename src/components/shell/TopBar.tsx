"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import { tokens } from "../../styles/tokens";

export interface TopBarProps {
  onOpenMobileNav: () => void;
  adminName: string | null;
}

export function TopBar({ onOpenMobileNav, adminName }: TopBarProps) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing[3],
        padding: `0 ${tokens.spacing[5]}`,
        height: 60,
        background: tokens.shell.bg,
        borderBottom: `1px solid ${tokens.shell.border}`,
        fontFamily: tokens.fontFamilyOpsDeck.sans,
      }}
    >
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="cc-admin-mobile-nav-trigger"
        style={{
          display: "none",
          width: 36,
          height: 36,
          border: `1px solid ${tokens.shell.border}`,
          background: tokens.shell.bg2,
          color: tokens.shell.inkMuted,
          borderRadius: tokens.radius.structural,
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="2" y1="4.5" x2="14" y2="4.5" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="11.5" x2="14" y2="11.5" />
        </svg>
      </button>

      {/* Real admin identity, resolved once by AdminShell's session guard */}
      <span
        style={{
          fontSize: tokens.typography.size.sm,
          fontWeight: tokens.typography.weight.semibold,
          color: tokens.shell.ink,
        }}
      >
        {adminName || "Admin"}
      </span>

      <button
        type="button"
        onClick={handleSignOut}
        className="cc-btn"
        style={{
          background: tokens.shell.bg2,
          color: tokens.shell.ink,
          border: `1px solid ${tokens.shell.border}`,
          borderRadius: tokens.radius.structural,
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          fontSize: tokens.typography.size.sm,
          fontWeight: tokens.typography.weight.semibold,
        }}
      >
        Sign Out
      </button>
    </header>
  );
}

export default TopBar;
