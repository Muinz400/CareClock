"use client";

import { ButtonHTMLAttributes, useEffect, useState } from "react";
import { tokens } from "../../styles/tokens";

export type ClockActionStatus = "clocked-in" | "clocked-out";

export interface ClockActionProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className"> {
  status: ClockActionStatus;
  loading?: boolean;
  /** Formatted elapsed duration (e.g. "01:24:07"), shown only while clocked in. */
  elapsedLabel?: string;
  onClick: () => void;
}

const SIZE = 220;

/**
 * Purely presentational — a real <button>, no Supabase/business logic
 * inside. Color and label are driven entirely by `status`; the caller
 * decides when that status actually changes. Detects its own transitions
 * to trigger one restrained pulse (never a looping/idle animation), and
 * inherits the app's global prefers-reduced-motion rule automatically.
 */
export function ClockAction({
  status,
  loading = false,
  disabled = false,
  elapsedLabel,
  onClick,
  style,
  ...rest
}: ClockActionProps) {
  const [pulseClass, setPulseClass] = useState("");
  const [previousStatus, setPreviousStatus] = useState(status);

  // Adjusting state during render (React's documented pattern for "derive
  // a one-shot value from a prop change") rather than in an effect body —
  // this branch only ever runs on the render where status actually
  // changes, so it doesn't loop.
  if (status !== previousStatus) {
    setPreviousStatus(status);
    setPulseClass(status === "clocked-in" ? "cc-clock-action-pulse-on" : "cc-clock-action-pulse-off");
  }

  // The effect itself never calls setState synchronously in its body —
  // only inside the timer's callback, once the timer actually fires.
  useEffect(() => {
    if (!pulseClass) return;
    const timeout = setTimeout(() => setPulseClass(""), 950);
    return () => clearTimeout(timeout);
  }, [pulseClass]);

  const isClockedIn = status === "clocked-in";
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      aria-pressed={isClockedIn}
      disabled={isDisabled}
      onClick={onClick}
      className={["cc-clock-action", pulseClass].filter(Boolean).join(" ")}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        border: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        margin: "0 auto",
        background: isClockedIn ? tokens.action.on : tokens.action.off,
        color: "#fff",
        fontFamily: tokens.fontFamilyOpsDeck.sans,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: disabled && !loading ? 0.6 : 1,
        transition: "background 250ms cubic-bezier(0.2,0.8,0.2,1)",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          opacity: 0.85,
        }}
      >
        {loading ? "Working…" : isClockedIn ? "Clock Out" : "Clock In"}
      </span>
      <span
        style={{
          fontFamily: tokens.fontFamilyOpsDeck.mono,
          fontSize: 26,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {isClockedIn ? elapsedLabel ?? "00:00:00" : "Tap to begin"}
      </span>
    </button>
  );
}

export default ClockAction;
