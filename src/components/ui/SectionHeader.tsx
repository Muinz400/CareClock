"use client";

import { HTMLAttributes, ReactNode } from "react";
import { tokens } from "../../styles/tokens";

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  action?: ReactNode;
  tone?: "paper" | "shell";
}

/**
 * Operations Deck section label — mono, uppercase, sparse signal color.
 * Graduated from the repeated ad-hoc eyebrow markup already appearing
 * across the shell/landing-page work; kept small and single-purpose
 * rather than absorbing per-section layout concerns.
 */
export function SectionHeader({ children, action, tone = "paper", style, ...rest }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing[3],
        marginBottom: tokens.spacing[3],
        ...style,
      }}
      {...rest}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: tokens.fontFamilyOpsDeck.mono,
          fontSize: 11,
          fontWeight: tokens.typography.weight.bold,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: tone === "shell" ? tokens.signal.base : tokens.signal.strong,
        }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

export default SectionHeader;
