"use client";

import { CSSProperties, HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export type PanelSurface = "paper" | "shell";
export type PanelPadding = "sm" | "md" | "lg";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  surface?: PanelSurface;
  padding?: PanelPadding;
}

const paddingStyles: Record<PanelPadding, string> = {
  sm: tokens.spacing[3],
  md: tokens.spacing[4],
  lg: tokens.spacing[5],
};

/**
 * Operations Deck structural surface. Deliberately near-square radius
 * (structural, not overlay/action) since a Panel holds data/sections, not
 * an interactive control — radius communicates purpose here, not decor.
 * Foundation component only — not yet adopted outside the new shell.
 */
export function Panel({
  surface = "paper",
  padding = "md",
  style,
  children,
  ...rest
}: PanelProps) {
  const surfaceStyle: CSSProperties =
    surface === "shell"
      ? {
          background: tokens.shell.bg2,
          border: `1px solid ${tokens.shell.border}`,
          color: tokens.shell.ink,
        }
      : {
          background: tokens.paper.surface,
          border: `1px solid ${tokens.paper.border}`,
          color: tokens.paper.ink,
        };

  return (
    <div
      style={{
        borderRadius: tokens.radius.structural,
        padding: paddingStyles[padding],
        fontFamily: tokens.fontFamilyOpsDeck.sans,
        ...surfaceStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Panel;
