"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdminProfile } from "../../../hooks/useAdminSession";
import { supabase } from "../../../supabaseClient";
import { APP_TIMEZONE, formatAppDateTime, getAppTodayISODate, normalizeUtcValue } from "../../../lib/time";
import { tokens } from "../../../styles/tokens";
import { Panel, SectionHeader, StatusBand, EmptyState, LoadingSpinner } from "../../../components/ui";

/*
  Admin Home v1 — a monitoring/triage surface, not a mutation surface.
  Every query here is scoped to the authenticated admin's org_id (either
  directly, for tables that have it, or via employee_id membership for
  clock_logs, which doesn't). No realtime subscription — a lightweight
  60s poll only; the full realtime+10s-polling live board stays exactly
  as-is in legacy /admin/dashboard until Time & Attendance migrates.
*/

const MISSED_CLOCK_OUT_THRESHOLD_HOURS = 12;
const POLL_INTERVAL_MS = 60000;
const RECENT_ACTIVITY_LIMIT = 10;
const RECENT_LOGS_FETCH_LIMIT = 25;

type EmployeeLite = { id: string; name: string };
type ClockLogLite = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
  entered_by_admin: boolean | null;
};
type ScheduleLite = { employee_id: string; house_name: string | null };

type NeedsAttentionItem = {
  clockLogId: string;
  employeeId: string;
  employeeName: string;
  clockInIso: string;
  hoursOpen: number;
};

type ActivityEvent = {
  key: string;
  employeeName: string;
  type: "in" | "out";
  timestampIso: string;
  enteredByAdmin: boolean;
};

const QUICK_ACTIONS = [
  { label: "+ Add Employee", href: "/people/new" },
  { label: "+ New Shift", href: "/scheduling" },
  { label: "Time & Attendance", href: "/time/live" },
  { label: "Payroll", href: "/payroll" },
];

function parseTimestamp(value: string): Date {
  return new Date(normalizeUtcValue(value) ?? value);
}

function formatDurationOpen(clockInIso: string, now: Date): string {
  const ms = now.getTime() - parseTimestamp(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m open`;
}

// Normalizes only for in-memory dedupe/counting — never rewrites stored data.
function normalizeHouseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function AdminHomePage() {
  const { org_id: orgId, full_name: adminName } = useAdminProfile();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
  const [currentlyClockedIn, setCurrentlyClockedIn] = useState(0);
  const [scheduledToday, setScheduledToday] = useState(0);
  const [housesToday, setHousesToday] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);

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
          setNeedsAttention([]);
          setCurrentlyClockedIn(0);
          setScheduledToday(0);
          setHousesToday(0);
          setRecentActivity([]);
          setLastUpdated(new Date());
          setError(null);
          return;
        }

        const [openShiftsResult, recentLogsResult, todaySchedulesResult] = await Promise.all([
          supabase
            .from("clock_logs")
            .select("id, employee_id, clock_in, clock_out, entered_by_admin")
            .in("employee_id", employeeIds)
            .is("clock_out", null),
          supabase
            .from("clock_logs")
            .select("id, employee_id, clock_in, clock_out, entered_by_admin")
            .in("employee_id", employeeIds)
            .order("clock_in", { ascending: false })
            .limit(RECENT_LOGS_FETCH_LIMIT),
          supabase
            .from("schedules")
            .select("employee_id, house_name")
            .eq("org_id", orgId)
            .eq("work_date", getAppTodayISODate()),
        ]);

        if (openShiftsResult.error) throw openShiftsResult.error;
        if (recentLogsResult.error) throw recentLogsResult.error;
        if (todaySchedulesResult.error) throw todaySchedulesResult.error;

        const openShifts = (openShiftsResult.data ?? []) as ClockLogLite[];
        const recentLogs = (recentLogsResult.data ?? []) as ClockLogLite[];
        const todaySchedules = (todaySchedulesResult.data ?? []) as ScheduleLite[];

        const now = new Date();

        const attention: NeedsAttentionItem[] = openShifts
          .filter((log): log is ClockLogLite & { clock_in: string } => Boolean(log.clock_in))
          .map((log) => ({
            clockLogId: log.id,
            employeeId: log.employee_id,
            employeeName: nameById.get(log.employee_id) ?? "Unknown employee",
            clockInIso: log.clock_in,
            hoursOpen: (now.getTime() - parseTimestamp(log.clock_in).getTime()) / (1000 * 60 * 60),
          }))
          .filter((item) => item.hoursOpen >= MISSED_CLOCK_OUT_THRESHOLD_HOURS)
          .sort((a, b) => b.hoursOpen - a.hoursOpen);

        const events: ActivityEvent[] = [];
        for (const log of recentLogs) {
          const employeeName = nameById.get(log.employee_id) ?? "Unknown employee";
          const enteredByAdmin = Boolean(log.entered_by_admin);

          if (log.clock_in) {
            events.push({ key: `${log.id}-in`, employeeName, type: "in", timestampIso: log.clock_in, enteredByAdmin });
          }
          if (log.clock_out) {
            events.push({ key: `${log.id}-out`, employeeName, type: "out", timestampIso: log.clock_out, enteredByAdmin });
          }
        }
        events.sort((a, b) => parseTimestamp(b.timestampIso).getTime() - parseTimestamp(a.timestampIso).getTime());

        const distinctHouses = new Set(
          todaySchedules
            .map((s) => s.house_name)
            .filter((name): name is string => Boolean(name && name.trim()))
            .map(normalizeHouseName)
        );

        setNeedsAttention(attention);
        setCurrentlyClockedIn(openShifts.length);
        setScheduledToday(new Set(todaySchedules.map((s) => s.employee_id)).size);
        setHousesToday(distinctHouses.size);
        setRecentActivity(events.slice(0, RECENT_ACTIVITY_LIMIT));
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
        <LoadingSpinner size="lg" label="Loading Admin Home..." />
      </div>
    );
  }

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  });

  return (
    <div>
      <div style={{ marginBottom: tokens.spacing[7] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          Good to see you{adminName ? `, ${adminName}` : ""}
        </h1>
        <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          {todayLabel}
          {needsAttention.length > 0
            ? ` · ${needsAttention.length} item${needsAttention.length === 1 ? "" : "s"} need attention`
            : " · Nothing needs attention right now"}
        </p>
      </div>

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
        <SectionHeader>Needs Attention</SectionHeader>
        {needsAttention.length === 0 ? (
          <EmptyState
            title="Nothing needs attention"
            description={`No open shifts have been running longer than ${MISSED_CLOCK_OUT_THRESHOLD_HOURS} hours.`}
            style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
          />
        ) : (
          <Panel padding="sm">
            {needsAttention.map((item, i) => (
              <div
                key={item.clockLogId}
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
                    <div style={{ fontWeight: tokens.typography.weight.semibold, fontSize: tokens.typography.size.base }}>
                      {item.employeeName} — {formatDurationOpen(item.clockInIso, now)}
                    </div>
                    <div style={{ fontFamily: tokens.fontFamilyOpsDeck.mono, fontSize: 11, color: tokens.paper.inkFaint }}>
                      Clocked in {formatAppDateTime(item.clockInIso)}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/people/${item.employeeId}`}
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
            { label: "Scheduled today", value: scheduledToday },
            { label: "Houses represented today", value: housesToday, hint: "Distinct names scheduled, not full coverage" },
          ]}
        />
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Recent Activity</SectionHeader>
        {recentActivity.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description="Clock-ins and clock-outs will appear here."
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
                    Action
                  </th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((event) => (
                  <tr key={event.key}>
                    <td style={tdStyle}>{event.employeeName}</td>
                    <td style={tdStyle}>
                      {event.type === "in" ? "Clocked in" : "Clocked out"}
                      {event.enteredByAdmin && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontFamily: tokens.fontFamilyOpsDeck.mono,
                            fontSize: 9.5,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: tokens.paper.inkFaint,
                            border: `1px solid ${tokens.paper.border}`,
                            borderRadius: 4,
                            padding: "1px 5px",
                          }}
                        >
                          Admin correction
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {formatAppDateTime(event.timestampIso)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <SectionHeader>Quick Actions</SectionHeader>
        <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing[3] }}>
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="cc-btn"
              style={{
                padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                borderRadius: tokens.radius.structural,
                border: `1px solid ${tokens.paper.border}`,
                background: tokens.paper.surface,
                fontSize: tokens.typography.size.sm,
                fontWeight: tokens.typography.weight.semibold,
                color: tokens.paper.ink,
                textDecoration: "none",
              }}
            >
              {action.label}
            </Link>
          ))}
        </div>
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
