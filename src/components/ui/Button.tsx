"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";
import { tokens } from "../../styles/tokens";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: tokens.colors.accent,
    color: "#ffffff",
    border: "none",
  },
  secondary: {
    background: tokens.colors.border,
    color: tokens.colors.ink,
    border: "none",
  },
  danger: {
    background: tokens.colors.danger,
    color: "#ffffff",
    border: "none",
  },
  ghost: {
    background: "transparent",
    color: tokens.colors.ink,
    border: `1px solid ${tokens.colors.border}`,
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    fontSize: tokens.typography.size.sm,
  },
  md: {
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.size.base,
  },
};

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: tokens.spacing[2],
  fontFamily: tokens.typography.fontFamily,
  fontWeight: tokens.typography.weight.semibold,
  borderRadius: tokens.radius.sm,
  lineHeight: 1.2,
};

/**
 * Foundation component only — not yet adopted by any existing page.
 * Accessible defaults: real <button>, visible focus-visible ring (via .cc-btn
 * in globals.css), disabled state communicated both visually and via the
 * native `disabled` attribute.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, style, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={["cc-btn", className].filter(Boolean).join(" ")}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...rest}
    />
  );
});

export default Button;
