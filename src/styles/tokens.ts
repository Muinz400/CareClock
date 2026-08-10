// Single source of truth for these values lives in src/app/globals.css as
// CSS custom properties (--cc-*). This module only references them via
// var(...) so there is never a second, drifting copy of a literal value.

export const colors = {
  ink: "var(--cc-color-ink)",
  inkMuted: "var(--cc-color-ink-muted)",
  inkFaint: "var(--cc-color-ink-faint)",
  surface: "var(--cc-color-surface)",
  surfaceMuted: "var(--cc-color-surface-muted)",
  border: "var(--cc-color-border)",
  borderMuted: "var(--cc-color-border-muted)",
  borderStrong: "var(--cc-color-border-strong)",
  accent: "var(--cc-color-accent)",
  accentHover: "var(--cc-color-accent-hover)",
  accentSoft: "var(--cc-color-accent-soft)",
  success: "var(--cc-color-success)",
  successSoft: "var(--cc-color-success-soft)",
  successInk: "var(--cc-color-success-ink)",
  warning: "var(--cc-color-warning)",
  warningSoft: "var(--cc-color-warning-soft)",
  danger: "var(--cc-color-danger)",
  dangerSoft: "var(--cc-color-danger-soft)",
  dangerInk: "var(--cc-color-danger-ink)",
  info: "var(--cc-color-info)",
  infoSoft: "var(--cc-color-info-soft)",
} as const;

export const spacing = {
  1: "var(--cc-space-1)",
  2: "var(--cc-space-2)",
  3: "var(--cc-space-3)",
  4: "var(--cc-space-4)",
  5: "var(--cc-space-5)",
  6: "var(--cc-space-6)",
  7: "var(--cc-space-7)",
  8: "var(--cc-space-8)",
  9: "var(--cc-space-9)",
  10: "var(--cc-space-10)",
} as const;

export const typography = {
  fontFamily: "var(--cc-font-family)",
  size: {
    xs: "var(--cc-font-size-xs)",
    sm: "var(--cc-font-size-sm)",
    base: "var(--cc-font-size-base)",
    md: "var(--cc-font-size-md)",
    lg: "var(--cc-font-size-lg)",
    xl: "var(--cc-font-size-xl)",
    "2xl": "var(--cc-font-size-2xl)",
    "3xl": "var(--cc-font-size-3xl)",
    "4xl": "var(--cc-font-size-4xl)",
    "5xl": "var(--cc-font-size-5xl)",
  },
  weight: {
    regular: "var(--cc-font-weight-regular)",
    medium: "var(--cc-font-weight-medium)",
    semibold: "var(--cc-font-weight-semibold)",
    bold: "var(--cc-font-weight-bold)",
  },
} as const;

export const radius = {
  sm: "var(--cc-radius-sm)",
  md: "var(--cc-radius-md)",
  lg: "var(--cc-radius-lg)",
  xl: "var(--cc-radius-xl)",
  full: "var(--cc-radius-full)",
  structural: "var(--cc-radius-structural)",
  overlay: "var(--cc-radius-overlay)",
  action: "var(--cc-radius-action)",
} as const;

// ---- Operations Deck tokens (additive) ----
// Fixed dark/light material identity — see globals.css for why these are
// not prefers-color-scheme responsive. Not yet referenced by any existing
// page or component; only the new shell components use these.

export const shell = {
  bg: "var(--cc-shell-bg)",
  bg2: "var(--cc-shell-bg-2)",
  bg3: "var(--cc-shell-bg-3)",
  border: "var(--cc-shell-border)",
  ink: "var(--cc-shell-ink)",
  inkMuted: "var(--cc-shell-ink-muted)",
  inkFaint: "var(--cc-shell-ink-faint)",
} as const;

export const paper = {
  bg: "var(--cc-paper)",
  surface: "var(--cc-paper-surface)",
  surface2: "var(--cc-paper-surface-2)",
  border: "var(--cc-paper-border)",
  borderStrong: "var(--cc-paper-border-strong)",
  ink: "var(--cc-paper-ink)",
  inkMuted: "var(--cc-paper-ink-muted)",
  inkFaint: "var(--cc-paper-ink-faint)",
} as const;

export const signal = {
  base: "var(--cc-signal)",
  strong: "var(--cc-signal-strong)",
  softPaper: "var(--cc-signal-soft-paper)",
  softShell: "var(--cc-signal-soft-shell)",
} as const;

export const action = {
  off: "var(--cc-action-off)",
  offStrong: "var(--cc-action-off-strong)",
  on: "var(--cc-action-on)",
  onStrong: "var(--cc-action-on-strong)",
} as const;

export const fontFamilyOpsDeck = {
  sans: "var(--cc-font-family-sans)",
  mono: "var(--cc-font-family-mono)",
} as const;

export const shadow = {
  sm: "var(--cc-shadow-sm)",
  md: "var(--cc-shadow-md)",
  lg: "var(--cc-shadow-lg)",
} as const;

export const transition = {
  fast: "var(--cc-transition-fast)",
  base: "var(--cc-transition-base)",
  slow: "var(--cc-transition-slow)",
} as const;

export const container = {
  sm: "var(--cc-container-sm)",
  md: "var(--cc-container-md)",
  lg: "var(--cc-container-lg)",
  app: "var(--cc-container-app)",
  xl: "var(--cc-container-xl)",
} as const;

export const tokens = {
  colors,
  spacing,
  typography,
  radius,
  shadow,
  transition,
  container,
  shell,
  paper,
  signal,
  action,
  fontFamilyOpsDeck,
} as const;

export default tokens;
