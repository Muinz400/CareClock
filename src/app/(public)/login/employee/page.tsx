"use client";

import Link from "next/link";
import { useLoginForm } from "../../../../hooks/useLoginForm";
import { tokens } from "../../../../styles/tokens";

export default function EmployeeLoginPage() {
  const { email, setEmail, password, setPassword, loading, handleSubmit } = useLoginForm();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: tokens.shell.bg,
        color: tokens.shell.ink,
        padding: tokens.spacing[5],
      }}
    >
      <div style={{ width: "100%", maxWidth: 360, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: tokens.spacing[6] }}>
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: tokens.radius.structural,
              background: tokens.signal.base,
              color: "#1a1305",
              fontWeight: 800,
              fontSize: 16,
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: tokens.spacing[3],
            }}
          >
            C
          </span>
          <h1 style={{ margin: `0 0 ${tokens.spacing[1]}`, fontSize: tokens.typography.size.lg }}>
            Employee Sign In
          </h1>
          <p style={{ margin: 0, color: tokens.shell.inkMuted, fontSize: tokens.typography.size.sm }}>
            Clock in, view your shifts, and manage your workday.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "14px",
              minHeight: 48,
              border: `1px solid ${tokens.shell.border}`,
              borderRadius: tokens.radius.md,
              background: tokens.shell.bg2,
              color: tokens.shell.ink,
              fontSize: tokens.typography.size.md,
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "14px",
              minHeight: 48,
              border: `1px solid ${tokens.shell.border}`,
              borderRadius: tokens.radius.md,
              background: tokens.shell.bg2,
              color: tokens.shell.ink,
              fontSize: tokens.typography.size.md,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            className="cc-btn"
            style={{
              padding: "14px",
              minHeight: 48,
              background: tokens.shell.ink,
              color: tokens.shell.bg,
              border: "none",
              borderRadius: tokens.radius.md,
              fontWeight: tokens.typography.weight.semibold,
              fontSize: tokens.typography.size.md,
              marginTop: tokens.spacing[2],
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div
          style={{
            marginTop: tokens.spacing[6],
            display: "flex",
            justifyContent: "space-between",
            fontSize: tokens.typography.size.sm,
          }}
        >
          <Link href="/login" style={{ color: tokens.shell.inkFaint, textDecoration: "underline" }}>
            ← Back
          </Link>
          <Link href="/login/admin" style={{ color: tokens.shell.inkFaint, textDecoration: "underline" }}>
            Admin sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
