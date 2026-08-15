"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminProfile } from "../../../../hooks/useAdminSession";
import { supabase } from "../../../../supabaseClient";
import { formatAppDateTime, normalizeUtcValue } from "../../../../lib/time";
import { tokens } from "../../../../styles/tokens";
import { SectionHeader, Panel, EmptyState, LoadingSpinner } from "../../../../components/ui";

/*
  Time & Attendance -> Exceptions. Locked v1 scope (see the B3 audit):
  three zero-inference "Needs Attention" types computed purely from
  clock_logs (no schedules matching — no durable schedule<->clock_logs
  relationship exists in the schema), plus a bounded, informational-only
  "Recent Admin Corrections" table. No mutation, no realtime — a slower
  60s poll only, matching Admin Home's monitoring-not-live-clock cadence.

  Deliberately NOT implemented (schema can't reliably support them):
  missing scheduled clock-in, late arrival, early departure,
  scheduled-but-never-clocked-in, clocked-in-without-schedule,
  outside-geofence, mileage omission, daily-log omission. Missing
  location is NOT a standalone exception either — it's shown as a
  secondary column on Admin Corrections only, since a missing-location
  row is already, in practice, an admin-entered row (real employee
  clock-ins always carry GPS by construction of /employee/clock).
*/

const MISSED_CLOCK_OUT_THRESHOLD_HOURS = 12;
const ADMIN_CORRECTIONS_WINDOW_DAYS = 30;
const POLL_INTERVAL_MS = 60000;

type EmployeeLite = { id: string; name: string };
type ClockLogLite = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
  latitude: number | null;
  longitude: number | null;
  entered_by_admin: boolean | null;
};

type IssueType = "invalid" | "overlap" | "long-open";

type NeedsAttentionIssue = {
  key: string;
  type: IssueType;
  employeeId: string;
  employeeName: string;
  description: string;
  sortValue: number;
};

const TYPE_LABEL: Record<IssueType, string> = {
  invalid: "Invalid Time Record",
  overlap: "Overlapping Sessions",
  "long-open": "Long Open Shift",
};

const TYPE_PRIORITY: Record<IssueType, number> = {
  invalid: 0,
  overlap: 1,
  "long-open": 2,
};

function parseTimestamp(value: string): Date {
  return new Date(normalizeUtcValue(value) ?? value);
}

function formatOpenDuration(clockInIso: string, now: Date): string {
  const ms = now.getTime() - parseTimestamp(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m open`;
}

/*
  Builds the Needs Attention list for one employee's full clock_logs
  history. Overlap is detected by sorting sessions by clock_in and
  comparing each adjacent pair's effective range — an open session's
  effective end is treated as "now" for this comparison, which is what
  naturally makes two simultaneously-open sessions for the same employee
  surface as an Overlapping Sessions pair rather than needing a separate
  "duplicate open session" category.

  Dedup policy per record:
  - Invalid Time Record is always shown once per qualifying row.
  - A row involved in a detected overlap is always shown once per pair,
    under Overlapping Sessions.
  - Long Open Shift is shown for a qualifying row ONLY if that row isn't
    already covered by an Overlapping Sessions pair (avoids two entries
    describing the same open session). Invalid + Overlap CAN co-occur for
    the same row, since they're independent, both-true claims.
*/
function buildEmployeeIssues(
  employeeId: string,
  employeeName: string,
  logs: ClockLogLite[],
  now: Date
): NeedsAttentionIssue[] {
  const sorted = [...logs]
    .filter((log) => Boolean(log.clock_in))
    .sort((a, b) => parseTimestamp(a.clock_in as string).getTime() - parseTimestamp(b.clock_in as string).getTime());

  const issues: NeedsAttentionIssue[] = [];
  const overlapRowIds = new Set<string>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentEnd = current.clock_out ? parseTimestamp(current.clock_out).getTime() : now.getTime();
    const nextStart = parseTimestamp(next.clock_in as string).getTime();

    if (nextStart < currentEnd) {
      overlapRowIds.add(current.id);
      overlapRowIds.add(next.id);

      issues.push({
        key: `overlap-${current.id}-${next.id}`,
        type: "overlap",
        employeeId,
        employeeName,
        description: `${formatAppDateTime(current.clock_in)} – ${
          current.clock_out ? formatAppDateTime(current.clock_out) : "open"
        } overlaps ${formatAppDateTime(next.clock_in)} – ${next.clock_out ? formatAppDateTime(next.clock_out) : "open"}`,
        sortValue: nextStart,
      });
    }
  }

  for (const log of sorted) {
    if (!log.clock_in) continue;

    if (log.clock_out) {
      const start = parseTimestamp(log.clock_in).getTime();
      const end = parseTimestamp(log.clock_out).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
        issues.push({
          key: `invalid-${log.id}`,
          type: "invalid",
          employeeId,
          employeeName,
          description: `Clock out (${formatAppDateTime(log.clock_out)}) is not after clock in (${formatAppDateTime(log.clock_in)})`,
          sortValue: start,
        });
      }
      continue;
    }

    if (overlapRowIds.has(log.id)) continue;

    const hoursOpen = (now.getTime() - parseTimestamp(log.clock_in).getTime()) / (1000 * 60 * 60);
    if (hoursOpen >= MISSED_CLOCK_OUT_THRESHOLD_HOURS) {
      issues.push({
        key: `long-open-${log.id}`,
        type: "long-open",
        employeeId,
        employeeName,
        description: formatOpenDuration(log.clock_in, now),
        sortValue: hoursOpen,
      });
    }
  }

  return issues;
}

export default function TimeExceptionsPage() {
  const { org_id: orgId } = useAdminProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [issues, setIssues] = useState<NeedsAttentionIssue[]>([]);
  const [corrections, setCorrections] = useState<(ClockLogLite & { employeeName: string })[]>([]);

  const inFlightRef = useRef(false);

  const loadData = useCallback(
    async (isInitial: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (isInitial) setLoading(true);

      try {
        const { data: employeeRows, error: employeesError } = await supabase
          .from("employees")
          .select("id, name")
          .eq("org_id", orgId);

        if (employeesError) throw employeesError;

        const employees = (employeeRows ?? []) as EmployeeLite[];
        const employeeIds = employees.map((e) => e.id);
        const nameById = new Map(employees.map((e) => [e.id, e.name]));

        if (employeeIds.length === 0) {
          setIssues([]);
          setCorrections([]);
          setLastUpdated(new Date());
          setError(null);
          return;
        }

        const { data: logRows, error: logsError } = await supabase
          .from("clock_logs")
          .select("id, employee_id, clock_in, clock_out, latitude, longitude, entered_by_admin")
          .in("employee_id", employeeIds);

        if (logsError) throw logsError;

        const logs = (logRows ?? []) as ClockLogLite[];
        const now = new Date();

        const logsByEmployee = new Map<string, ClockLogLite[]>();
        for (const log of logs) {
          const existing = logsByEmployee.get(log.employee_id);
          if (existing) {
            existing.push(log);
          } else {
            logsByEmployee.set(log.employee_id, [log]);
          }
        }

        const allIssues: NeedsAttentionIssue[] = [];
        for (const employee of employees) {
          const employeeLogs = logsByEmployee.get(employee.id) ?? [];
          allIssues.push(...buildEmployeeIssues(employee.id, employee.name, employeeLogs, now));
        }

        allIssues.sort((a, b) => {
          const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
          if (typeDiff !== 0) return typeDiff;
          return b.sortValue - a.sortValue;
        });

        const windowStart = now.getTime() - ADMIN_CORRECTIONS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const recentCorrections = logs
          .filter((log) => log.entered_by_admin && log.clock_in && parseTimestamp(log.clock_in).getTime() >= windowStart)
          .map((log) => ({ ...log, employeeName: nameById.get(log.employee_id) ?? "Unknown employee" }))
          .sort((a, b) => parseTimestamp(b.clock_in as string).getTime() - parseTimestamp(a.clock_in as string).getTime());

        setIssues(allIssues);
        setCorrections(recentCorrections);
        setLastUpdated(now);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Couldn't load the latest data. Showing the last known state.");
      } finally {
        inFlightRef.current = false;
        if (isInitial) setLoading(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    void loadData(true);
    const interval = setInterval(() => {
      void loadData(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading Exceptions..." />
      </div>
    );
  }

  return (
    <div>
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

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader
          action={
            lastUpdated && (
              <span style={{ fontSize: 11, color: tokens.paper.inkFaint, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                Updated{" "}
                {lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )
          }
        >
          Needs Attention
        </SectionHeader>
        {issues.length === 0 ? (
          <EmptyState
            title="Nothing needs attention right now"
            style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
          />
        ) : (
          <Panel padding="sm">
            {issues.map((issue, i) => (
              <div
                key={issue.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: tokens.spacing[3],
                  padding: `${tokens.spacing[3]} ${tokens.spacing[2]}`,
                  borderTop: i > 0 ? `1px solid ${tokens.paper.border}` : "none",
                  borderLeft: `3px solid ${tokens.signal.base}`,
                  paddingLeft: tokens.spacing[3],
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 9, minWidth: 0 }}>
                  <svg
                    aria-hidden="true"
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke={tokens.signal.strong}
                    strokeWidth="1.6"
                    style={{ marginTop: 3, flex: "none" }}
                  >
                    <path d="M8 2.5 L14.5 13.5 L1.5 13.5 Z" strokeLinejoin="round" />
                    <line x1="8" y1="6.5" x2="8" y2="10" strokeLinecap="round" />
                    <circle cx="8" cy="11.8" r="0.6" fill={tokens.signal.strong} stroke="none" />
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: tokens.fontFamilyOpsDeck.mono,
                        fontSize: 9.5,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: tokens.signal.strong,
                        marginBottom: 2,
                      }}
                    >
                      {TYPE_LABEL[issue.type]}
                    </div>
                    <div style={{ fontWeight: tokens.typography.weight.semibold, fontSize: tokens.typography.size.base }}>
                      {issue.employeeName}
                    </div>
                    <div style={{ fontFamily: tokens.fontFamilyOpsDeck.mono, fontSize: 11, color: tokens.paper.inkFaint }}>
                      {issue.description}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/people/${issue.employeeId}`}
                  className="cc-btn"
                  style={{
                    flex: "none",
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    minHeight: 36,
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: tokens.radius.structural,
                    border: `1px solid ${tokens.paper.borderStrong}`,
                    fontSize: tokens.typography.size.sm,
                    fontWeight: tokens.typography.weight.semibold,
                    color: tokens.paper.ink,
                    textDecoration: "none",
                  }}
                >
                  Review
                </Link>
              </div>
            ))}
          </Panel>
        )}
      </section>

      <section>
        <SectionHeader>Recent Admin Corrections</SectionHeader>
        {corrections.length === 0 ? (
          <EmptyState
            title={`No admin-entered or corrected records in the last ${ADMIN_CORRECTIONS_WINDOW_DAYS} days`}
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
                    Employee
                  </th>
                  <th scope="col" style={thStyle}>
                    Clock In
                  </th>
                  <th scope="col" style={thStyle}>
                    Clock Out
                  </th>
                  <th scope="col" style={thStyle}>
                    Location
                  </th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                    <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((log) => (
                  <tr key={log.id}>
                    <td style={{ ...tdStyle, fontWeight: tokens.typography.weight.semibold }}>{log.employeeName}</td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {log.clock_in ? formatAppDateTime(log.clock_in) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {log.clock_out ? formatAppDateTime(log.clock_out) : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: log.latitude != null && log.longitude != null ? tokens.paper.ink : tokens.paper.inkFaint }}>
                      {log.latitude != null && log.longitude != null ? "Location recorded" : "No location"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <Link
                        href={`/people/${log.employee_id}`}
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
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
