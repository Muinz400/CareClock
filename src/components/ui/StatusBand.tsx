"use client";

import { HTMLAttributes } from "react";
import { tokens } from "../../styles/tokens";

export interface StatusBandItem {
  label: string;
  value: string | number;
  hint?: string;
}

export interface StatusBandProps extends HTMLAttributes<HTMLDivElement> {
  items: StatusBandItem[];
}

/**
 * Operations Deck continuous status strip — a single divided row rather
 * than separate stat cards, per the locked "no KPI-card wall" direction.
 * One call site today (Admin Home); kept generic (label/value/hint) since
 * the same pattern is the intended shape for future admin summary rows.
 */
export function StatusBand({ items, style, ...rest }: StatusBandProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        border: `1px solid ${tokens.paper.border}`,
        borderRadius: tokens.radius.structural,
        background: tokens.paper.surface,
        ...style,
      }}
      {...rest}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            flex: "1 1 160px",
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            borderLeft: i > 0 ? `1px solid ${tokens.paper.border}` : "none",
          }}
        >
          <div
            style={{
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              fontSize: tokens.typography.size.xl,
              fontWeight: tokens.typography.weight.bold,
              color: tokens.paper.ink,
            }}
          >
            {item.value}
          </div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: tokens.paper.inkFaint,
              marginTop: 2,
            }}
          >
            {item.label}
          </div>
          {item.hint && (
            <div style={{ fontSize: tokens.typography.size.xs, color: tokens.paper.inkFaint, marginTop: 2 }}>
              {item.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default StatusBand;
