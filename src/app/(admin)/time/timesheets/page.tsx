"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAdminProfile } from "../../../../hooks/useAdminSession";
import { supabase } from "../../../../supabaseClient";
import { APP_TIMEZONE, formatAppDate, normalizeUtcValue } from "../../../../lib/time";
import { tokens } from "../../../../styles/tokens";
import { SectionHeader, StatusBand, EmptyState, LoadingSpinner } from "../../../../components/ui";

/*
  Time & Attendance -> Timesheets. A faithful, restyled port of legacy
  /admin/dashboard/timesheets — same real shape (one employee's entire
  clock_logs history at a time, read-only, no period/approval concept,
  "completed-only" hours total), not a reshaped period/bulk-review
  experience the schema doesn't support. See the B2 audit for why: no
  approval or period field exists anywhere, and inventing one here would
  imply a workflow that isn't real.

  Raw lat/lng columns are dropped in favor of the "Location recorded" /
  "No location" indicator, matching the pattern already shipped on Live.
  The redundant per-row Date column is dropped too — day-group headers
  already carry that.
*/

type EmployeeLite = { id: string; name: string; email: string };
type ClockLogLite = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
  latitude: number | null;
  longitude: number | null;
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

function formatTimeOnly(iso: string): string {
  const normalized = normalizeUtcValue(iso) ?? iso;
  return new Date(normalized).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}

function isCompletedSession(log: ClockLogLite): boolean {
  if (!log.clock_in || !log.clock_out) return false;
  const start = parseTimestamp(log.clock_in).getTime();
  const end = parseTimestamp(log.clock_out).getTime();
  return !Number.isNaN(start) && !Number.isNaN(end) && end > start;
}

function formatHours(log: ClockLogLite): string {
  if (!log.clock_in) return "—";
  if (!log.clock_out) return "Active";
  if (!isCompletedSession(log)) return "—";

  const start = parseTimestamp(log.clock_in).getTime();
  const end = parseTimestamp(log.clock_out).getTime();
  return `${((end - start) / (1000 * 60 * 60)).toFixed(2)} hrs`;
}

export default function TimeTimesheetsPage() {
  const { org_id: orgId } = useAdminProfile();

  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [logs, setLogs] = useState<ClockLogLite[]>([]);

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async (employeeId: string) => {
    setLoadingLogs(true);
    setError(null);

    const { data, error: logsError } = await supabase
      .from("clock_logs")
      .select("id, employee_id, clock_in, clock_out, latitude, longitude")
      .eq("employee_id", employeeId)
      .order("clock_in", { ascending: false });

    if (logsError) {
      setError("Couldn't load this employee's time records.");
      setLoadingLogs(false);
      return;
    }

    setLogs((data ?? []) as ClockLogLite[]);
    setLoadingLogs(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      setLoadingEmployees(true);
      setError(null);

      const { data, error: employeesError } = await supabase
        .from("employees")
        .select("id, name, email")
        .eq("org_id", orgId)
        .order("name");

      if (cancelled) return;

      if (employeesError) {
        setError("Couldn't load employees.");
        setLoadingEmployees(false);
        return;
      }

      const rows = (data ?? []) as EmployeeLite[];
      setEmployees(rows);
      setLoadingEmployees(false);

      if (rows.length > 0) {
        setSelectedEmployeeId(rows[0].id);
        await loadLogs(rows[0].id);
      }
    }

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [orgId, loadLogs]);

  function handleSelectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    void loadLogs(employeeId);
  }

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  const totalHours = useMemo(
    () =>
      logs.reduce((sum, log) => {
        if (!isCompletedSession(log)) return sum;
        const start = parseTimestamp(log.clock_in as string).getTime();
        const end = parseTimestamp(log.clock_out as string).getTime();
        return sum + (end - start) / (1000 * 60 * 60);
      }, 0),
    [logs]
  );

  const completedCount = useMemo(() => logs.filter(isCompletedSession).length, [logs]);
  const hasOpenShift = useMemo(() => logs.some((l) => l.clock_in && !l.clock_out), [logs]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, ClockLogLite[]>();
    for (const log of logs) {
      const key = log.clock_in ? toAppDateKey(log.clock_in) : "unknown";
      const existing = groups.get(key);
      if (existing) {
        existing.push(log);
      } else {
        groups.set(key, [log]);
      }
    }
    return Array.from(groups.entries());
  }, [logs]);

  if (loadingEmployees) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading Timesheets..." />
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

      {employees.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Employees will appear here once they're added."
          style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
        />
      ) : (
        <>
          <section style={{ marginBottom: tokens.spacing[6] }}>
            <SectionHeader>Employee</SectionHeader>
            <select
              value={selectedEmployeeId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              style={{
                minHeight: 44,
                minWidth: 260,
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                borderRadius: tokens.radius.structural,
                border: `1px solid ${tokens.paper.borderStrong}`,
                background: tokens.paper.surface,
                color: tokens.paper.ink,
                fontSize: tokens.typography.size.sm,
              }}
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </section>

          {selectedEmployee && (
            <section style={{ marginBottom: tokens.spacing[7] }}>
              <SectionHeader
                action={
                  <span style={{ fontSize: 11, color: tokens.paper.inkFaint, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                    {selectedEmployee.email}
                  </span>
                }
              >
                Summary
              </SectionHeader>
              <StatusBand
                items={[
                  { label: "Total Hours", value: totalHours.toFixed(2) },
                  { label: "Completed Sessions", value: completedCount },
                  { label: "Currently Open", value: hasOpenShift ? "Yes" : "No" },
                ]}
              />
            </section>
          )}

          <section>
            <SectionHeader>History</SectionHeader>
            {loadingLogs ? (
              <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[7] }}>
                <LoadingSpinner label="Loading history..." />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                title="No time records"
                description={selectedEmployee ? `${selectedEmployee.name} has no clock history yet.` : "No time records found yet."}
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
                        Clock In
                      </th>
                      <th scope="col" style={thStyle}>
                        Clock Out
                      </th>
                      <th scope="col" style={thStyle}>
                        Hours
                      </th>
                      <th scope="col" style={thStyle}>
                        Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedLogs.map(([dateKey, dayLogs]) => (
                      <Fragment key={dateKey}>
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              padding: "8px 12px",
                              background: tokens.paper.surface2,
                              borderBottom: `1px solid ${tokens.paper.border}`,
                              fontWeight: tokens.typography.weight.semibold,
                              fontSize: tokens.typography.size.sm,
                            }}
                          >
                            {dateKey === "unknown" ? "Unknown date" : formatAppDate(dateKey)}
                          </td>
                        </tr>
                        {dayLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                              {log.clock_in ? formatTimeOnly(log.clock_in) : "—"}
                            </td>
                            <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                              {log.clock_out ? formatTimeOnly(log.clock_out) : "—"}
                            </td>
                            <td style={tdStyle}>{formatHours(log)}</td>
                            <td style={{ ...tdStyle, color: log.latitude != null && log.longitude != null ? tokens.paper.ink : tokens.paper.inkFaint }}>
                              {log.latitude != null && log.longitude != null ? "Location recorded" : "No location"}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
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
