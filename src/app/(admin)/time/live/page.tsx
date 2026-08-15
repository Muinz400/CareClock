"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminProfile } from "../../../../hooks/useAdminSession";
import { supabase } from "../../../../supabaseClient";
import { APP_TIMEZONE, formatAppDateTime, getAppTodayISODate, normalizeUtcValue } from "../../../../lib/time";
import { tokens } from "../../../../styles/tokens";
import { SectionHeader, StatusBand, StatusDot, EmptyState, LoadingSpinner } from "../../../../components/ui";

/*
  Time & Attendance -> Live. Rebuilds legacy /admin/dashboard's live board
  on real, org-scoped data only. Two things legacy displayed that were
  never real are deliberately dropped, not carried forward:
    - "House" was a hardcoded "Main House" string on every row, not
      derived from any table — omitted entirely here.
    - Raw lat/lng columns are replaced with a compact "Location recorded"
      indicator; full coordinates remain reachable via Review, which
      routes into the existing /admin/employees/[id] correction surface
      (this page never mutates clock_logs itself).

  Realtime + a slower polling fallback (30s, vs legacy's 10s) — realtime
  is the primary freshness mechanism here, polling only guards against a
  silently dropped WebSocket. The postgres_changes subscription itself
  can't be filtered by a joined org_id (same coarse granularity legacy's
  channel already has); every refresh re-runs the org-scoped fetch below
  regardless of what triggered it, so what's displayed always stays
  correctly scoped even though the trigger isn't.
*/

const POLL_INTERVAL_MS = 30000;

type EmployeeLite = { id: string; name: string };
type ClockLogLite = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
  latitude: number | null;
  longitude: number | null;
};

type AttendanceStatus = "clocked-in" | "clocked-out" | "no-activity";

type LiveRow = {
  employeeId: string;
  employeeName: string;
  status: AttendanceStatus;
  lastClockInIso: string | null;
  lastClockOutIso: string | null;
  hasLocation: boolean;
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  "clocked-in": "Clocked In",
  "clocked-out": "Clocked Out",
  "no-activity": "No Activity",
};

const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
  "clocked-in": 0,
  "clocked-out": 1,
  "no-activity": 2,
};

function parseTimestamp(value: string): Date {
  return new Date(normalizeUtcValue(value) ?? value);
}

function toAppDateKey(iso: string): string {
  const normalized = normalizeUtcValue(iso) ?? iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(normalized));
}

function formatOpenDuration(clockInIso: string, now: Date): string {
  const ms = now.getTime() - parseTimestamp(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function TimeLivePage() {
  const { org_id: orgId } = useAdminProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rows, setRows] = useState<LiveRow[]>([]);

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
          .eq("org_id", orgId)
          .order("name");

        if (employeesError) throw employeesError;

        const employees = (employeeRows ?? []) as EmployeeLite[];
        const employeeIds = employees.map((e) => e.id);

        if (employeeIds.length === 0) {
          setRows([]);
          setLastUpdated(new Date());
          setError(null);
          return;
        }

        const { data: logRows, error: logsError } = await supabase
          .from("clock_logs")
          .select("id, employee_id, clock_in, clock_out, latitude, longitude")
          .in("employee_id", employeeIds)
          .order("clock_in", { ascending: false });

        if (logsError) throw logsError;

        const logs = (logRows ?? []) as ClockLogLite[];

        // Ordered desc by clock_in, so the first row encountered per
        // employee is their latest — no separate per-employee query needed.
        const latestByEmployee = new Map<string, ClockLogLite>();
        for (const log of logs) {
          if (!latestByEmployee.has(log.employee_id)) {
            latestByEmployee.set(log.employee_id, log);
          }
        }

        const nextRows: LiveRow[] = employees.map((employee) => {
          const latest = latestByEmployee.get(employee.id);

          if (!latest) {
            return {
              employeeId: employee.id,
              employeeName: employee.name,
              status: "no-activity",
              lastClockInIso: null,
              lastClockOutIso: null,
              hasLocation: false,
            };
          }

          const status: AttendanceStatus = latest.clock_out ? "clocked-out" : "clocked-in";

          return {
            employeeId: employee.id,
            employeeName: employee.name,
            status,
            lastClockInIso: latest.clock_in,
            lastClockOutIso: latest.clock_out,
            hasLocation: latest.latitude != null && latest.longitude != null,
          };
        });

        nextRows.sort((a, b) => {
          const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
          if (priorityDiff !== 0) return priorityDiff;
          return a.employeeName.localeCompare(b.employeeName);
        });

        setRows(nextRows);
        setLastUpdated(new Date());
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

    const channel = supabase
      .channel("time-live-clock-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "clock_logs" }, () => {
        void loadData(false);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading Live..." />
      </div>
    );
  }

  const now = new Date();
  const todayKey = getAppTodayISODate();

  const currentlyClockedIn = rows.filter((r) => r.status === "clocked-in").length;
  const clockedOutToday = rows.filter(
    (r) => r.status === "clocked-out" && r.lastClockOutIso && toAppDateKey(r.lastClockOutIso) === todayKey
  ).length;
  const noActivity = rows.filter((r) => r.status === "no-activity").length;

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
                {lastUpdated.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: APP_TIMEZONE,
                })}
              </span>
            )
          }
        >
          Right Now
        </SectionHeader>
        <StatusBand
          items={[
            { label: "Currently clocked in", value: currentlyClockedIn },
            { label: "Clocked out today", value: clockedOutToday },
            { label: "No activity", value: noActivity },
          ]}
        />
      </section>

      <section>
        <SectionHeader>Workforce Ledger</SectionHeader>
        {rows.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Employees will appear here once they're added."
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
                    Status
                  </th>
                  <th scope="col" style={thStyle}>
                    Last Clock In
                  </th>
                  <th scope="col" style={thStyle}>
                    Last Clock Out
                  </th>
                  <th scope="col" style={thStyle}>
                    Duration
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
                {rows.map((row) => (
                  <tr key={row.employeeId}>
                    <td style={{ ...tdStyle, fontWeight: tokens.typography.weight.semibold }}>{row.employeeName}</td>
                    <td style={tdStyle}>
                      <StatusDot active={row.status === "clocked-in"} label={STATUS_LABEL[row.status]} />
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {row.lastClockInIso ? formatAppDateTime(row.lastClockInIso) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {row.lastClockOutIso ? formatAppDateTime(row.lastClockOutIso) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {row.status === "clocked-in" && row.lastClockInIso ? formatOpenDuration(row.lastClockInIso, now) : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: row.hasLocation ? tokens.paper.ink : tokens.paper.inkFaint }}>
                      {row.hasLocation ? "Location recorded" : "No location"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <Link
                        href={`/people/${row.employeeId}`}
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
