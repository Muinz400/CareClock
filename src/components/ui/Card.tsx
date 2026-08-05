"use client";

import { CSSProperties, HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export type CardPadding = "sm" | "md" | "lg";
export type CardVariant = "flat" | "raised";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  variant?: CardVariant;
}

const paddingStyles: Record<CardPadding, string> = {
  sm: tokens.spacing[3],
  md: tokens.spacing[4],
  lg: tokens.spacing[5],
};

/**
 * Foundation component only — not yet adopted by any existing page.
 * `variant="flat"` matches the borders-only pattern used on employee-facing
 * screens today; `variant="raised"` matches the shadowed pattern used on
 * admin screens today — offered side by side so a future page migration can
 * choose deliberately rather than drift accidentally.
 */
export function Card({
  padding = "md",
  variant = "flat",
  style,
  children,
  ...rest
}: CardProps) {
  const variantStyle: CSSProperties =
    variant === "raised" ? { boxShadow: tokens.shadow.md } : {};

  return (
    <div
      style={{
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.lg,
        padding: paddingStyles[padding],
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
