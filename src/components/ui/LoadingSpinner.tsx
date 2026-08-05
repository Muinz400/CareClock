"use client";

import { HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export type LoadingSpinnerSize = "sm" | "md" | "lg";

export interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: LoadingSpinnerSize;
  label?: string;
}

const sizeMap: Record<LoadingSpinnerSize, string> = {
  sm: "16px",
  md: "24px",
  lg: "32px",
};

/**
 * Foundation component only — not yet adopted by any existing page.
 * Replaces the "text only, no spinner anywhere in the app" pattern found in
 * the audit. Accessible default: role="status" announces the loading state
 * to screen readers; the spinning circle itself is aria-hidden since it's
 * purely decorative — the announcement comes from the label text.
 */
export function LoadingSpinner({
  size = "md",
  label = "Loading...",
  style,
  ...rest
}: LoadingSpinnerProps) {
  const dimension = sizeMap[size];

  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacing[2],
        fontFamily: tokens.typography.fontFamily,
        fontSize: tokens.typography.size.sm,
        color: tokens.colors.inkMuted,
        ...style,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: dimension,
          height: dimension,
          border: `2px solid ${tokens.colors.border}`,
          borderTopColor: tokens.colors.accent,
          borderRadius: "50%",
          animation: "cc-spin 0.8s linear infinite",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

export default LoadingSpinner;
