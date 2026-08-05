"use client";

import { InputHTMLAttributes, useId } from "react";
import { tokens } from "../../styles/tokens";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Always required — this component exists specifically to guarantee a
   * programmatically associated label on every field that uses it. */
  label: string;
  error?: string;
  /** Visually hides the label while keeping it in the accessibility tree. */
  hideLabel?: boolean;
}

const visuallyHiddenStyle = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/**
 * Foundation component only — not yet adopted by any existing page.
 * Accessible defaults: label is always paired via htmlFor/id (auto-generated
 * with React's useId when no id is supplied), and an error message is wired
 * up with aria-invalid/aria-describedby and announced via role="alert".
 */
export function Input({
  label,
  error,
  hideLabel = false,
  id,
  className,
  style,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[1] }}>
      <label
        htmlFor={inputId}
        style={{
          fontFamily: tokens.typography.fontFamily,
          fontSize: tokens.typography.size.sm,
          fontWeight: tokens.typography.weight.medium,
          color: tokens.colors.ink,
          ...(hideLabel ? visuallyHiddenStyle : {}),
        }}
      >
        {label}
      </label>
      <input
        id={inputId}
        className={["cc-input", className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        style={{
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          border: `1px solid ${error ? tokens.colors.danger : tokens.colors.border}`,
          borderRadius: tokens.radius.md,
          fontFamily: tokens.typography.fontFamily,
          fontSize: tokens.typography.size.base,
          ...style,
        }}
        {...rest}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            margin: 0,
            fontFamily: tokens.typography.fontFamily,
            fontSize: tokens.typography.size.xs,
            color: tokens.colors.danger,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default Input;
