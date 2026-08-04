"use client";

import { CSSProperties, HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  neutral: { background: tokens.colors.border, color: tokens.colors.ink },
  success: { background: tokens.colors.successSoft, color: tokens.colors.successInk },
  warning: { background: tokens.colors.warningSoft, color: tokens.colors.warning },
  danger: { background: tokens.colors.dangerSoft, color: tokens.colors.dangerInk },
  info: { background: tokens.colors.infoSoft, color: tokens.colors.info },
  accent: { background: tokens.colors.accentSoft, color: tokens.colors.accentHover },
};

/**
 * Foundation component only — not yet adopted by any existing page.
 * Targets the audit finding that identical status data (e.g. Clocked
 * In/Out/No Activity) currently renders three different ways across the app.
 */
export function Badge({ variant = "neutral", style, children, ...rest }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
        borderRadius: tokens.radius.full,
        fontFamily: tokens.typography.fontFamily,
        fontSize: tokens.typography.size.xs,
        fontWeight: tokens.typography.weight.semibold,
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Badge;
