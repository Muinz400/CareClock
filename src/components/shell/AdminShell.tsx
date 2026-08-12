"use client";

import { useState } from "react";
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { tokens } from "../../styles/tokens";
import { AdminSessionContext, useAdminSessionState } from "../../hooks/useAdminSession";
import { LoadingSpinner } from "../ui/LoadingSpinner";

export function AdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = useAdminSessionState();

  if (session.status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.paper.bg,
        }}
      >
        <LoadingSpinner size="lg" label="Loading your session..." />
      </div>
    );
  }

  if (session.status === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.paper.bg,
          color: tokens.paper.ink,
          padding: tokens.spacing[5],
          textAlign: "center",
        }}
      >
        <p style={{ maxWidth: 360 }}>{session.message}</p>
      </div>
    );
  }

  return (
    <AdminSessionContext.Provider value={session.profile}>
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
          <TopBar onOpenMobileNav={() => setMobileOpen(true)} adminName={session.profile.full_name} />
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
    </AdminSessionContext.Provider>
  );
}

export default AdminShell;
