"use client";

import { HTMLAttributes, ReactNode } from "react";
import { tokens } from "../../styles/tokens";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Foundation component only — not yet adopted by any existing page.
 * Generalizes the best-in-class empty state found in the app
 * (scheduling/page.tsx's dashed-border pattern) into something reusable
 * everywhere, including the two screens the audit found with no empty
 * state at all.
 */
export function EmptyState({ title, description, icon, style, ...rest }: EmptyStateProps) {
  return (
    <div
      style={{
        border: `1px dashed ${tokens.colors.borderStrong}`,
        borderRadius: tokens.radius.xl,
        padding: tokens.spacing[7],
        textAlign: "center",
        background: tokens.colors.surfaceMuted,
        fontFamily: tokens.typography.fontFamily,
        ...style,
      }}
      {...rest}
    >
      {icon && (
        <div style={{ marginBottom: tokens.spacing[2], fontSize: tokens.typography.size["3xl"] }}>
          {icon}
        </div>
      )}
      <p
        style={{
          margin: 0,
          fontWeight: tokens.typography.weight.semibold,
          color: tokens.colors.ink,
          fontSize: tokens.typography.size.base,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            margin: 0,
            marginTop: tokens.spacing[1],
            color: tokens.colors.inkMuted,
            fontSize: tokens.typography.size.sm,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export default EmptyState;
