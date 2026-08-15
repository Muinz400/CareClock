"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAdminProfile } from "../../../hooks/useAdminSession";
import { supabase } from "../../../supabaseClient";
import { tokens } from "../../../styles/tokens";
import { SectionHeader, StatusDot, EmptyState, LoadingSpinner } from "../../../components/ui";

/*
  People -> directory (People A, extended in People C). Org-scoped
  employee registry with clock-in status, reusing /time/live's exact
  fetch/derive pattern (org-scoped employees, one batched clock_logs
  query, reduced to each employee's latest row). No polling/realtime
  here — this is a directory, not a live monitoring surface, so a single
  load is honest and sufficient.

  Manage routes to /people/{id} (People B). Add Employee routes to
  /people/new (People C) — Admin Home's own "+ Add Employee" Quick
  Action still points at legacy /admin/dashboard until that link flips
  in its own later follow-up, per the same canonical-link discipline
  already used throughout this migration.

  ?invited=1 drives a one-off success banner after a successful invite
  from /people/new — sourced directly from the URL, not persisted state,
  so it naturally stops showing once the admin navigates elsewhere.
*/

type EmployeeLite = { id: string; name: string; email: string; hourly_rate: number | null };
type ClockLogLite = { id: string; employee_id: string; clock_in: string | null; clock_out: string | null };

type AttendanceStatus = "clocked-in" | "clocked-out" | "no-activity";

type PersonRow = {
  employeeId: string;
  name: string;
  email: string;
  hourlyRate: number | null;
  status: AttendanceStatus;
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  "clocked-in": "Clocked In",
  "clocked-out": "Clocked Out",
  "no-activity": "No Activity",
};

function formatHourlyRate(rate: number | null): string {
  return rate != null ? `$${rate.toFixed(2)}/hr` : "—";
}

export default function PeoplePage() {
  const { org_id: orgId } = useAdminProfile();
  const searchParams = useSearchParams();
  const showInvitedSuccess = searchParams.get("invited") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPeople() {
      setLoading(true);
      setError(null);

      try {
        const { data: employeeRows, error: employeesError } = await supabase
          .from("employees")
          .select("id, name, email, hourly_rate")
          .eq("org_id", orgId)
          .order("name");

        if (employeesError) throw employeesError;
        if (cancelled) return;

        const employees = (employeeRows ?? []) as EmployeeLite[];
        const employeeIds = employees.map((e) => e.id);

        if (employeeIds.length === 0) {
          setPeople([]);
          return;
        }

        const { data: logRows, error: logsError } = await supabase
          .from("clock_logs")
          .select("id, employee_id, clock_in, clock_out")
          .in("employee_id", employeeIds)
          .order("clock_in", { ascending: false });

        if (logsError) throw logsError;
        if (cancelled) return;

        const logs = (logRows ?? []) as ClockLogLite[];

        const latestByEmployee = new Map<string, ClockLogLite>();
        for (const log of logs) {
          if (!latestByEmployee.has(log.employee_id)) {
            latestByEmployee.set(log.employee_id, log);
          }
        }

        const rows: PersonRow[] = employees.map((employee) => {
          const latest = latestByEmployee.get(employee.id);
          const status: AttendanceStatus = !latest ? "no-activity" : latest.clock_out ? "clocked-out" : "clocked-in";

          return {
            employeeId: employee.id,
            name: employee.name,
            email: employee.email,
            hourlyRate: employee.hourly_rate,
            status,
          };
        });

        setPeople(rows);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError("Couldn't load the people directory. Showing the last known state.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPeople();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const filteredPeople = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return people;
    return people.filter(
      (person) => person.name.toLowerCase().includes(query) || person.email.toLowerCase().includes(query)
    );
  }, [people, searchQuery]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading People..." />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: tokens.spacing[3],
          flexWrap: "wrap",
          marginBottom: tokens.spacing[7],
        }}
      >
        <div>
          <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
            People
          </h1>
          <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
            {people.length} employee{people.length === 1 ? "" : "s"} in your organization
          </p>
        </div>

        <Link
          href="/people/new"
          className="cc-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            minHeight: 44,
            borderRadius: tokens.radius.structural,
            border: "none",
            background: tokens.signal.base,
            color: "#1a1305",
            fontSize: tokens.typography.size.sm,
            fontWeight: tokens.typography.weight.bold,
            textDecoration: "none",
          }}
        >
          + Add Employee
        </Link>
      </div>

      {showInvitedSuccess && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            marginBottom: tokens.spacing[5],
            padding: tokens.spacing[3],
            border: `1px solid ${tokens.colors.success}`,
            borderRadius: tokens.radius.structural,
            color: tokens.colors.successInk,
            background: tokens.colors.successSoft,
            fontSize: tokens.typography.size.sm,
          }}
        >
          Employee invitation sent successfully.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: tokens.spacing[5],
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

      <section>
        <SectionHeader>Directory</SectionHeader>

        {people.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Employees will appear here once they're added."
            style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
          />
        ) : (
          <>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search people by name or email"
              style={{
                minHeight: 44,
                width: "100%",
                maxWidth: 360,
                marginBottom: tokens.spacing[4],
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                borderRadius: tokens.radius.structural,
                border: `1px solid ${tokens.paper.borderStrong}`,
                background: tokens.paper.surface,
                color: tokens.paper.ink,
                fontSize: tokens.typography.size.sm,
              }}
            />

            {filteredPeople.length === 0 ? (
              <EmptyState
                title="No matches"
                description={`No employees match "${searchQuery}".`}
                style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
              />
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  border: `1px solid ${tokens.paper.border}`,
                  borderRadius: tokens.radius.structural,
                  background: tokens.paper.surface,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={thStyle}>
                        Name
                      </th>
                      <th scope="col" style={thStyle}>
                        Email
                      </th>
                      <th scope="col" style={thStyle}>
                        Status
                      </th>
                      <th scope="col" style={thStyle}>
                        Hourly Rate
                      </th>
                      <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => (
                      <tr key={person.employeeId}>
                        <td style={{ ...tdStyle, fontWeight: tokens.typography.weight.semibold }}>{person.name}</td>
                        <td style={tdStyle}>{person.email}</td>
                        <td style={tdStyle}>
                          <StatusDot active={person.status === "clocked-in"} label={STATUS_LABEL[person.status]} />
                        </td>
                        <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                          {formatHourlyRate(person.hourlyRate)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <Link
                            href={`/people/${person.employeeId}`}
                            className="cc-btn"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                              minHeight: 36,
                              borderRadius: tokens.radius.structural,
                              border: `1px solid ${tokens.paper.borderStrong}`,
                              fontSize: tokens.typography.size.sm,
                              fontWeight: tokens.typography.weight.semibold,
                              color: tokens.paper.ink,
                              textDecoration: "none",
                            }}
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: `1px solid ${tokens.paper.borderStrong}`,
  fontFamily: tokens.fontFamilyOpsDeck.mono,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: tokens.paper.inkMuted,
};

const tdStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderBottom: `1px solid ${tokens.paper.border}`,
  fontSize: tokens.typography.size.sm,
};
