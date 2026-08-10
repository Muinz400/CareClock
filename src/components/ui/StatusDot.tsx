"use client";

import { HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  label: string;
  onShell?: boolean;
}

/**
 * Operations Deck status indicator — color plus text, never color alone.
 * Foundation component only; not wired to any real data source yet (no
 * page in this step has real status to show).
 */
export function StatusDot({ active = true, label, onShell = false, style, ...rest }: StatusDotProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacing[2],
        fontSize: tokens.typography.size.sm,
        fontFamily: tokens.fontFamilyOpsDeck.mono,
        color: onShell ? tokens.shell.inkMuted : tokens.paper.inkMuted,
        ...style,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active ? tokens.action.on : tokens.shell.inkFaint,
          flex: "none",
        }}
      />
      {label}
    </span>
  );
}

export default StatusDot;
