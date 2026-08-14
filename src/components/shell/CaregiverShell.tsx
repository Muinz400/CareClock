"use client";

import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { tokens } from "../../styles/tokens";
import { CaregiverSessionContext, useCaregiverSessionState } from "../../hooks/useCaregiverSession";
import { LoadingSpinner } from "../ui/LoadingSpinner";

export function CaregiverShell({ children }: { children: ReactNode }) {
  const session = useCaregiverSessionState();

  if (session.status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.shell.bg,
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
          background: tokens.shell.bg,
          color: tokens.shell.ink,
          padding: tokens.spacing[5],
          textAlign: "center",
        }}
      >
        <p style={{ maxWidth: 360 }}>{session.message}</p>
      </div>
    );
  }

  return (
    <CaregiverSessionContext.Provider value={session.value}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: tokens.shell.bg,
          color: tokens.shell.ink,
          fontFamily: tokens.fontFamilyOpsDeck.sans,
        }}
      >
        <main
          style={{
            flex: 1,
            padding: `${tokens.spacing[5]} ${tokens.spacing[5]} ${tokens.spacing[6]}`,
            paddingTop: `max(${tokens.spacing[5]}, env(safe-area-inset-top))`,
          }}
        >
          {children}
        </main>

        <BottomNav />
      </div>
    </CaregiverSessionContext.Provider>
  );
}

export default CaregiverShell;
