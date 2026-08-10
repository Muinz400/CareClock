"use client";

import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { tokens } from "../../styles/tokens";

export function CaregiverShell({ children }: { children: ReactNode }) {
  return (
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
  );
}

export default CaregiverShell;
