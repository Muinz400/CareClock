"use client";

import Link from "next/link";
import { useLoginForm } from "../../../../hooks/useLoginForm";
import { tokens } from "../../../../styles/tokens";

export default function AdminLoginPage() {
  const { email, setEmail, password, setPassword, loading, handleSubmit } = useLoginForm();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: tokens.paper.bg,
        padding: tokens.spacing[5],
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: tokens.paper.surface,
          border: `1px solid ${tokens.paper.border}`,
          borderRadius: tokens.radius.structural,
          padding: tokens.spacing[6],
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: tokens.spacing[2],
            marginBottom: tokens.spacing[5],
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 26,
              height: 26,
              flex: "none",
              borderRadius: tokens.radius.structural,
              background: tokens.shell.bg,
              color: tokens.signal.base,
              fontWeight: 800,
              fontSize: 12,
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            C
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, color: tokens.paper.ink }}>CareClock</span>
        </div>

        <h1 style={{ margin: `0 0 ${tokens.spacing[1]}`, fontSize: tokens.typography.size.xl }}>
          Admin / Owner Sign In
        </h1>
        <p style={{ margin: `0 0 ${tokens.spacing[5]}`, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          Manage scheduling, timesheets, and payroll for your organization.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              border: `1px solid ${tokens.paper.border}`,
              borderRadius: tokens.radius.md,
              background: tokens.paper.surface,
              color: tokens.paper.ink,
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "12px",
              border: `1px solid ${tokens.paper.border}`,
              borderRadius: tokens.radius.md,
              background: tokens.paper.surface,
              color: tokens.paper.ink,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            className="cc-btn"
            style={{
              padding: "12px",
              background: tokens.signal.base,
              color: "#1a1305",
              border: "none",
              borderRadius: tokens.radius.md,
              fontWeight: tokens.typography.weight.semibold,
              marginTop: tokens.spacing[2],
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            marginTop: tokens.spacing[5],
            display: "flex",
            justifyContent: "space-between",
            fontSize: tokens.typography.size.sm,
          }}
        >
          <Link href="/login" style={{ color: tokens.paper.inkMuted, textDecoration: "underline" }}>
            ← Back
          </Link>
          <Link href="/login/employee" style={{ color: tokens.paper.inkMuted, textDecoration: "underline" }}>
            Employee sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
