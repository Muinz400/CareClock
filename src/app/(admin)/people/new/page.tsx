"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminProfile } from "../../../../hooks/useAdminSession";
import { supabase } from "../../../../supabaseClient";
import { tokens } from "../../../../styles/tokens";
import { SectionHeader, Panel } from "../../../../components/ui";

/*
  People -> Add Employee (People C). A restyled front end for the exact
  same privileged flow legacy's /admin/dashboard form already uses —
  same validation order, same request contract, same
  /api/create-employee endpoint, same rollback/security behavior on the
  server. Nothing about employee creation itself changes here; only
  where the form lives and how failures are presented.

  Success has no employee id to route to: /api/create-employee's
  response is only { success, inviteSent } — employees.id is a separate
  generated primary key from the invited auth user's id, so it can't be
  derived client-side. Redirects to /people?invited=1 instead, per
  explicit product decision.
*/

export default function AddEmployeePage() {
  const { org_id: orgId } = useAdminProfile();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !hourlyRate.trim()) {
      setError("Please fill out all employee fields.");
      return;
    }

    const hourlyRateNumber = Number(hourlyRate);
    if (Number.isNaN(hourlyRateNumber) || hourlyRateNumber < 0) {
      setError("Hourly rate must be a valid non-negative number.");
      return;
    }

    setSubmitting(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      setError("Your session has expired. Please log in again.");
      setSubmitting(false);
      router.push("/login");
      return;
    }

    try {
      const response = await fetch("/api/create-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          hourlyRate: hourlyRateNumber,
          orgId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || "Failed to create employee.");
        setSubmitting(false);
        return;
      }

      router.push("/people?invited=1");
    } catch (err) {
      console.error(err);
      setError("Couldn't reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        href="/people"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: tokens.spacing[5],
          fontSize: tokens.typography.size.sm,
          fontWeight: tokens.typography.weight.semibold,
          color: tokens.paper.inkMuted,
          textDecoration: "none",
        }}
      >
        ← Back to People
      </Link>

      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          Add Employee
        </h1>
        <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          An invitation email will be sent to this address to set up their account.
        </p>
      </div>

      <section>
        <SectionHeader>Employee Details</SectionHeader>
        <Panel padding="md" style={{ maxWidth: 480 }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[4] }}>
            {error && (
              <div
                role="alert"
                style={{
                  padding: tokens.spacing[3],
                  border: `1px solid ${tokens.colors.danger}`,
                  borderRadius: tokens.radius.structural,
                  color: tokens.colors.dangerInk,
                  background: tokens.colors.dangerSoft,
                  fontSize: tokens.typography.size.sm,
                }}
              >
                {error}
              </div>
            )}

            <FormField label="Employee Name" id="employee-name">
              <input
                id="employee-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
                style={inputStyle}
              />
            </FormField>

            <FormField label="Email" id="employee-email">
              <input
                id="employee-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
                style={inputStyle}
              />
            </FormField>

            <FormField label="Hourly Rate" id="employee-rate">
              <input
                id="employee-rate"
                type="number"
                min={0}
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                disabled={submitting}
                required
                style={inputStyle}
              />
            </FormField>

            <button
              type="submit"
              disabled={submitting}
              className="cc-btn"
              style={{
                minHeight: 44,
                padding: `${tokens.spacing[3]} ${tokens.spacing[5]}`,
                borderRadius: tokens.radius.structural,
                border: "none",
                background: tokens.signal.base,
                color: "#1a1305",
                fontSize: tokens.typography.size.sm,
                fontWeight: tokens.typography.weight.bold,
                alignSelf: "flex-start",
              }}
            >
              {submitting ? "Sending invitation..." : "Send Invitation"}
            </button>
          </form>
        </Panel>
      </section>
    </div>
  );
}

function FormField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: tokens.typography.size.sm }}>
      <span style={{ fontWeight: tokens.typography.weight.medium, color: tokens.paper.inkMuted }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  borderRadius: tokens.radius.structural,
  border: `1px solid ${tokens.paper.borderStrong}`,
  background: tokens.paper.surface,
  color: tokens.paper.ink,
  fontSize: tokens.typography.size.sm,
};
