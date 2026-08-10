"use client";

import { useState } from "react";
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { tokens } from "../../styles/tokens";

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="cc-admin-shell" style={{ background: tokens.paper.bg }}>
      <div
        aria-hidden="true"
        className={`cc-admin-sidebar-backdrop${mobileOpen ? " show" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <div className={`cc-admin-shell-sidebar${mobileOpen ? " mobile-open" : ""}`}>
        <Sidebar />
      </div>

      <div className="cc-admin-shell-topbar">
        <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
      </div>

      <main
        className="cc-admin-shell-main"
        style={{
          padding: `${tokens.spacing[6]} ${tokens.spacing[6]} ${tokens.spacing[9]}`,
          color: tokens.paper.ink,
          fontFamily: tokens.fontFamilyOpsDeck.sans,
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
