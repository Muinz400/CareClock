import { tokens } from "../../../styles/tokens";

/*
  Shell-preview placeholder only — proves CaregiverShell renders correctly.
  No real clock state, no shift data, no Supabase queries. Real content
  (clock in/out, shift details) migrates here in a later step.
*/
export default function TodayPage() {
  return (
    <div>
      <span
        style={{
          display: "inline-block",
          fontFamily: tokens.fontFamilyOpsDeck.mono,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tokens.shell.inkFaint,
          border: `1px solid ${tokens.shell.border}`,
          padding: "4px 10px",
          borderRadius: tokens.radius.structural,
          marginBottom: tokens.spacing[3],
        }}
      >
        Migration Preview — Not Final Content
      </span>

      <h1 style={{ fontSize: tokens.typography.size.xl, margin: `0 0 ${tokens.spacing[3]}`, fontWeight: tokens.typography.weight.bold }}>
        Today
      </h1>

      <p style={{ color: tokens.shell.inkMuted, fontSize: tokens.typography.size.base, lineHeight: 1.6, margin: 0 }}>
        This page confirms the Operations Deck caregiver shell — dark surface,
        bottom navigation — is wired up correctly. Clock in/out and shift
        details migrate here in a later step; nothing here is production data.
      </p>
    </div>
  );
}
