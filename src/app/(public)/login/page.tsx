import Link from "next/link";
import { tokens } from "../../../styles/tokens";

export default function LoginHubPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "100px auto",
        padding: tokens.spacing[5],
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: tokens.spacing[2], fontSize: tokens.typography.size["2xl"] }}>
        Sign in to CareClock
      </h1>
      <p style={{ textAlign: "center", color: tokens.colors.inkMuted, marginBottom: tokens.spacing[7] }}>
        Choose how you&rsquo;d like to sign in.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: tokens.spacing[5],
        }}
      >
        <Link
          href="/login/admin"
          style={{
            display: "block",
            padding: tokens.spacing[6],
            border: `1px solid ${tokens.paper.border}`,
            borderRadius: tokens.radius.structural,
            background: tokens.paper.surface,
            textDecoration: "none",
            color: tokens.paper.ink,
          }}
        >
          <div
            style={{
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tokens.signal.strong,
              marginBottom: tokens.spacing[2],
            }}
          >
            Admin / Owner
          </div>
          <div style={{ fontSize: tokens.typography.size.lg, fontWeight: tokens.typography.weight.bold, marginBottom: tokens.spacing[1] }}>
            Manage your organization
          </div>
          <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
            Scheduling, timesheets, payroll, and workforce visibility.
          </p>
        </Link>

        <Link
          href="/login/employee"
          style={{
            display: "block",
            padding: tokens.spacing[6],
            border: `1px solid ${tokens.shell.border}`,
            borderRadius: tokens.radius.structural,
            background: tokens.shell.bg,
            textDecoration: "none",
            color: tokens.shell.ink,
          }}
        >
          <div
            style={{
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: tokens.shell.inkFaint,
              marginBottom: tokens.spacing[2],
            }}
          >
            Employee / Caregiver
          </div>
          <div style={{ fontSize: tokens.typography.size.lg, fontWeight: tokens.typography.weight.bold, marginBottom: tokens.spacing[1] }}>
            Clock in, view shifts, and manage your workday
          </div>
          <p style={{ margin: 0, color: tokens.shell.inkMuted, fontSize: tokens.typography.size.sm }}>
            Clock in/out, shifts, and timesheets.
          </p>
        </Link>
      </div>
    </main>
  );
}
