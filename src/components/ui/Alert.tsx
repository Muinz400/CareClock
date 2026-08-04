"use client";

import { HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string }> = {
  info: { bg: tokens.colors.infoSoft, border: tokens.colors.info, text: tokens.colors.info },
  success: {
    bg: tokens.colors.successSoft,
    border: tokens.colors.success,
    text: tokens.colors.successInk,
  },
  warning: {
    bg: tokens.colors.warningSoft,
    border: tokens.colors.warning,
    text: tokens.colors.warning,
  },
  danger: {
    bg: tokens.colors.dangerSoft,
    border: tokens.colors.danger,
    text: tokens.colors.dangerInk,
  },
};

/**
 * Foundation component only — not yet adopted by any existing page.
 * Generalizes the one properly styled error banner found in the app
 * (scheduling/page.tsx's errorCard) into something reusable everywhere.
 * Accessible default: role="alert" so screen readers announce it when it
 * appears, unlike most error text in the app today.
 */
export function Alert({ variant = "info", title, style, children, ...rest }: AlertProps) {
  const v = variantStyles[variant];

  return (
    <div
      role="alert"
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        color: v.text,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing[4],
        fontFamily: tokens.typography.fontFamily,
        fontSize: tokens.typography.size.base,
        ...style,
      }}
      {...rest}
    >
      {title && (
        <p
          style={{
            margin: 0,
            marginBottom: tokens.spacing[1],
            fontWeight: tokens.typography.weight.semibold,
          }}
        >
          {title}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

export default Alert;
