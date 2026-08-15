"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminProfile } from "../../../../hooks/useAdminSession";
import { supabase } from "../../../../supabaseClient";
import { formatAppDate, formatAppDateTime, formatAppTimeRange, getAppTodayISODate, normalizeUtcValue } from "../../../../lib/time";
import { tokens } from "../../../../styles/tokens";
import { SectionHeader, StatusBand, EmptyState, LoadingSpinner, Panel } from "../../../../components/ui";

/*
  People -> employee detail (People B). Operational record, not an HR
  profile. Ports /admin/employees/[id]'s real, proven functionality
  (identity, schedule, clock history, full manual correction toolkit)
  onto Operations Deck, with two deliberate, audited changes:

  1. Safe loading order — the employee row is resolved with BOTH
     .eq("id", routeId) AND .eq("org_id", orgId) before schedules or
     clock_logs are ever queried. Legacy ran all three concurrently via
     Promise.all, so a foreign-org id could still leak that employee's
     schedule/clock history even though the identity fields showed
     "not found" — fixed here by gating C behind B succeeding, not by
     adding a new auth layer.
  2. Every mutation touching an existing clock_logs row scopes by BOTH
     id and employee_id (defense-in-depth — the id already originates
     from an employee-scoped fetch, this just removes any need to trust
     that blindly).

  Everything else — the six correction functions' validation rules,
  guards, and Supabase payload shapes — is preserved exactly. The one
  deliberate exception, per explicit instruction: saveManualLog still
  has no guard against a second simultaneously-open session. That gap
  is real (Exceptions' Overlapping Sessions already catches it after
  the fact) but changing it here would be a new attendance policy, not
  a migration — out of scope for this page.
*/

type EmployeeDetail = { id: string; name: string; email: string; hourly_rate: number | null; is_active: boolean };
type ScheduleRow = {
  id: string;
  employee_id: string;
  house_name: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  mileage: number | null;
  is_outing: boolean | null;
  daily_log: string | null;
};
type ClockLogRow = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
  latitude: number | null;
  longitude: number | null;
  entered_by_admin: boolean | null;
};

type AttendanceStatus = "clocked-in" | "clocked-out" | "no-activity";
type Feedback = { type: "success" | "error"; message: string };

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  "clocked-in": "Clocked In",
  "clocked-out": "Clocked Out",
  "no-activity": "No Activity",
};

const SCHEDULE_SECTION_LIMIT = 4;

function parseTimestamp(value: string): Date {
  return new Date(normalizeUtcValue(value) ?? value);
}

function formatHourlyRate(rate: number | null): string {
  return rate != null ? `$${rate.toFixed(2)}/hr` : "—";
}

function formatOpenDuration(clockInIso: string, now: Date): string {
  const ms = now.getTime() - parseTimestamp(clockInIso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function getHours(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const start = parseTimestamp(clockIn).getTime();
  const end = parseTimestamp(clockOut).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return (end - start) / (1000 * 60 * 60);
}

// Native <input type="date"/"time"> value helpers — intentionally local
// browser time, matching legacy exactly, since these bind to native date/
// time input widgets, not display formatting.
function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateAndTime(dateValue: string, timeValue: string): string | null {
  if (!dateValue || !timeValue) return null;
  const combined = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined.toISOString();
}

export default function PersonDetailPage() {
  const { org_id: orgId } = useAdminProfile();
  const params = useParams();
  const employeeId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [clockLogs, setClockLogs] = useState<ClockLogRow[]>([]);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [editingLog, setEditingLog] = useState<ClockLogRow | null>(null);

  const now = new Date();
  const [manualClockInDate, setManualClockInDate] = useState(toDateInputValue(now));
  const [manualClockInTime, setManualClockInTime] = useState(toTimeInputValue(now));
  const [manualClockOutDate, setManualClockOutDate] = useState(toDateInputValue(now));
  const [manualClockOutTime, setManualClockOutTime] = useState(toTimeInputValue(now));

  const refreshClockLogs = useCallback(
    async (currentEmployeeId: string) => {
      const { data, error } = await supabase
        .from("clock_logs")
        .select("id, employee_id, clock_in, clock_out, latitude, longitude, entered_by_admin")
        .eq("employee_id", currentEmployeeId)
        .order("clock_in", { ascending: false });

      if (error) {
        setFeedback({ type: "error", message: "Couldn't refresh time history." });
        return;
      }

      setClockLogs((data ?? []) as ClockLogRow[]);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setLoadError(null);
      setNotFound(false);

      // Step 1: resolve the employee, scoped by BOTH route id and this
      // admin's org. Nothing else queries until this succeeds.
      const { data: employeeRow, error: employeeError } = await supabase
        .from("employees")
        .select("id, name, email, hourly_rate, is_active")
        .eq("id", employeeId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (cancelled) return;

      if (employeeError) {
        setLoadError("Couldn't load this employee.");
        setLoading(false);
        return;
      }

      if (!employeeRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEmployee(employeeRow as EmployeeDetail);

      // Step 2: only now, with a confirmed org-scoped employee, load
      // schedules and clock history. No fallback query if this employee
      // isn't found — the function already returned above.
      const [schedulesResult, clockLogsResult] = await Promise.all([
        supabase
          .from("schedules")
          .select("id, employee_id, house_name, work_date, start_time, end_time, mileage, is_outing, daily_log")
          .eq("employee_id", employeeRow.id)
          .order("work_date", { ascending: false }),
        supabase
          .from("clock_logs")
          .select("id, employee_id, clock_in, clock_out, latitude, longitude, entered_by_admin")
          .eq("employee_id", employeeRow.id)
          .order("clock_in", { ascending: false }),
      ]);

      if (cancelled) return;

      if (schedulesResult.error) {
        setLoadError("Couldn't load this employee's schedule.");
        setLoading(false);
        return;
      }

      if (clockLogsResult.error) {
        setLoadError("Couldn't load this employee's time history.");
        setLoading(false);
        return;
      }

      setSchedules((schedulesResult.data ?? []) as ScheduleRow[]);
      setClockLogs((clockLogsResult.data ?? []) as ClockLogRow[]);
      setLoading(false);
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [employeeId, orgId]);

  function startEdit(log: ClockLogRow) {
    setEditingLog(log);
    setFeedback(null);

    if (log.clock_in) {
      const d = parseTimestamp(log.clock_in);
      setManualClockInDate(toDateInputValue(d));
      setManualClockInTime(toTimeInputValue(d));
    }

    // Cleared (not left over from a prior edit) when this log has no
    // clock-out yet — an open log shouldn't inherit stale clock-out
    // values from whatever was last typed into the shared form.
    if (log.clock_out) {
      const d = parseTimestamp(log.clock_out);
      setManualClockOutDate(toDateInputValue(d));
      setManualClockOutTime(toTimeInputValue(d));
    } else {
      setManualClockOutDate("");
      setManualClockOutTime("");
    }
  }

  function cancelEdit() {
    setEditingLog(null);
    setFeedback(null);
  }

  async function toggleEmploymentStatus() {
    if (!employee) return;

    const nextActive = !employee.is_active;

    const confirmMessage = nextActive
      ? `Reactivate ${employee.name} (${employee.email})?\n\nThis restores employee access and the ability to clock in.`
      : `Deactivate ${employee.name} (${employee.email})?\n\nDeactivating this employee prevents future employee access and clock-ins. Historical time, schedules, and payroll-related records are preserved.`;

    if (!window.confirm(confirmMessage)) return;

    setStatusSaving(true);
    setFeedback(null);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      setFeedback({ type: "error", message: "Your session has expired. Please log in again." });
      setStatusSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/deactivate-employee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ employeeId: employee.id, active: nextActive }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: result.error || `Failed to ${nextActive ? "reactivate" : "deactivate"} employee.`,
        });
        setStatusSaving(false);
        return;
      }

      setEmployee({ ...employee, is_active: nextActive });
      setFeedback({ type: "success", message: nextActive ? "Employee reactivated." : "Employee deactivated." });
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Couldn't reach the server. Please try again." });
    } finally {
      setStatusSaving(false);
    }
  }

  async function adminClockInNow() {
    if (!employee) return;

    const openLog = clockLogs.find((log) => log.clock_in && !log.clock_out);
    if (openLog) {
      setFeedback({ type: "error", message: "This employee is already clocked in." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("clock_logs")
      .insert([{ employee_id: employee.id, clock_in: new Date().toISOString(), entered_by_admin: true }]);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await refreshClockLogs(employee.id);
    setFeedback({ type: "success", message: "Clocked in." });
    setSaving(false);
  }

  async function adminClockOutNow() {
    if (!employee) return;

    const openLog = clockLogs.find((log) => log.clock_in && !log.clock_out);
    if (!openLog) {
      setFeedback({ type: "error", message: "No open clock-in found for this employee." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("clock_logs")
      .update({ clock_out: new Date().toISOString(), entered_by_admin: true })
      .eq("id", openLog.id)
      .eq("employee_id", employee.id);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await refreshClockLogs(employee.id);
    setFeedback({ type: "success", message: "Clocked out." });
    setSaving(false);
  }

  async function updateExistingLog() {
    if (!editingLog || !employee) return;

    const clockInIso = combineDateAndTime(manualClockInDate, manualClockInTime);
    const clockOutIso = combineDateAndTime(manualClockOutDate, manualClockOutTime);

    if (!clockInIso) {
      setFeedback({ type: "error", message: "Clock in required." });
      return;
    }

    if (clockOutIso && new Date(clockOutIso).getTime() <= new Date(clockInIso).getTime()) {
      setFeedback({ type: "error", message: "Clock out must be after clock in." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("clock_logs")
      .update({ clock_in: clockInIso, clock_out: clockOutIso, entered_by_admin: true })
      .eq("id", editingLog.id)
      .eq("employee_id", employee.id);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await refreshClockLogs(employee.id);
    setEditingLog(null);
    setFeedback({ type: "success", message: "Clock log updated." });
    setSaving(false);
  }

  async function saveManualLog() {
    if (!employee) return;

    const clockInIso = combineDateAndTime(manualClockInDate, manualClockInTime);
    if (!clockInIso) {
      setFeedback({ type: "error", message: "Please enter a valid clock-in date and time." });
      return;
    }

    const clockOutIso =
      manualClockOutDate && manualClockOutTime ? combineDateAndTime(manualClockOutDate, manualClockOutTime) : null;

    if (clockOutIso && new Date(clockOutIso).getTime() <= new Date(clockInIso).getTime()) {
      setFeedback({ type: "error", message: "Clock out must be after clock in." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    // No guard here against an existing open session — preserved exactly
    // from legacy. See file header note.
    const { error } = await supabase
      .from("clock_logs")
      .insert([{ employee_id: employee.id, clock_in: clockInIso, clock_out: clockOutIso, entered_by_admin: true }]);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await refreshClockLogs(employee.id);
    setFeedback({ type: "success", message: "Manual time log saved." });
    setSaving(false);
  }

  async function updateOpenLogWithManualClockOut() {
    if (!employee) return;

    const openLog = clockLogs.find((log) => log.clock_in && !log.clock_out);
    if (!openLog) {
      setFeedback({ type: "error", message: "No open clock-in found for this employee." });
      return;
    }

    const manualOutIso = combineDateAndTime(manualClockOutDate, manualClockOutTime);
    if (!manualOutIso) {
      setFeedback({ type: "error", message: "Please enter a valid clock-out date and time." });
      return;
    }

    if (openLog.clock_in && new Date(manualOutIso).getTime() <= new Date(openLog.clock_in).getTime()) {
      setFeedback({ type: "error", message: "Clock out must be after the existing clock in." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("clock_logs")
      .update({ clock_out: manualOutIso, entered_by_admin: true })
      .eq("id", openLog.id)
      .eq("employee_id", employee.id);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await refreshClockLogs(employee.id);
    setFeedback({ type: "success", message: "Open log updated." });
    setSaving(false);
  }

  async function deleteLog(logId: string) {
    if (!employee) return;

    const confirmed = window.confirm("Delete this clock log?");
    if (!confirmed) return;

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase.from("clock_logs").delete().eq("id", logId).eq("employee_id", employee.id);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await refreshClockLogs(employee.id);
    setFeedback({ type: "success", message: "Clock log deleted." });
    setSaving(false);
  }

  const latestLog = clockLogs[0] ?? null;
  const status: AttendanceStatus = !latestLog ? "no-activity" : latestLog.clock_out ? "clocked-out" : "clocked-in";
  const hasOpenLog = clockLogs.some((log) => log.clock_in && !log.clock_out);

  const { upcomingShifts, recentShifts } = useMemo(() => {
    const todayKey = getAppTodayISODate();
    const upcoming = schedules
      .filter((s) => s.work_date >= todayKey)
      .sort((a, b) => a.work_date.localeCompare(b.work_date))
      .slice(0, SCHEDULE_SECTION_LIMIT);
    const recent = schedules
      .filter((s) => s.work_date < todayKey)
      .sort((a, b) => b.work_date.localeCompare(a.work_date))
      .slice(0, SCHEDULE_SECTION_LIMIT);
    return { upcomingShifts: upcoming, recentShifts: recent };
  }, [schedules]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading employee..." />
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <BackToPeopleLink />
        <EmptyState
          title="Employee not found"
          description="This employee doesn't exist or isn't part of your organization."
          style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
        />
      </div>
    );
  }

  if (loadError && !employee) {
    return (
      <div>
        <BackToPeopleLink />
        <div
          role="alert"
          style={{
            padding: tokens.spacing[4],
            border: `1px solid ${tokens.colors.danger}`,
            borderRadius: tokens.radius.structural,
            color: tokens.colors.dangerInk,
            background: tokens.colors.dangerSoft,
            fontSize: tokens.typography.size.sm,
          }}
        >
          {loadError}
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div>
      <BackToPeopleLink />

      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          {employee.name}
        </h1>
        <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>{employee.email}</p>
      </div>

      {feedback?.type === "error" && (
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
          {feedback.message}
        </div>
      )}

      {feedback?.type === "success" && (
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
          {feedback.message}
        </div>
      )}

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Overview</SectionHeader>
        <StatusBand
          items={[
            { label: "Status", value: STATUS_LABEL[status] },
            { label: "Hourly Rate", value: formatHourlyRate(employee.hourly_rate) },
            ...(status === "clocked-in" && latestLog?.clock_in
              ? [{ label: "Open Duration", value: formatOpenDuration(latestLog.clock_in, now) }]
              : []),
          ]}
        />
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Employment Status</SectionHeader>
        <Panel padding="md">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: tokens.spacing[3],
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: tokens.typography.weight.semibold, fontSize: tokens.typography.size.base }}>
              {employee.is_active ? "Active" : "Inactive"}
            </div>
            <button
              type="button"
              onClick={toggleEmploymentStatus}
              disabled={statusSaving}
              className="cc-btn"
              style={{
                ...actionButtonStyle,
                background: employee.is_active ? tokens.colors.danger : tokens.colors.success,
                color: "#ffffff",
                border: "none",
              }}
            >
              {statusSaving
                ? "Saving..."
                : employee.is_active
                ? "Deactivate Employee"
                : "Reactivate Employee"}
            </button>
          </div>
          {!employee.is_active && (
            <p style={{ margin: `${tokens.spacing[3]} 0 0`, fontSize: tokens.typography.size.sm, color: tokens.paper.inkMuted }}>
              This employee cannot access employee tools or clock in while inactive. Historical time, schedules, and
              payroll-related records remain intact.
            </p>
          )}
        </Panel>
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Manual Time Correction</SectionHeader>
        <Panel padding="md">
          <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap", marginBottom: tokens.spacing[4] }}>
            <button
              type="button"
              onClick={adminClockInNow}
              disabled={saving || hasOpenLog}
              className="cc-btn"
              style={{ ...actionButtonStyle, background: tokens.colors.success, color: "#ffffff", border: "none" }}
            >
              Clock In Now
            </button>
            <button
              type="button"
              onClick={adminClockOutNow}
              disabled={saving || !hasOpenLog}
              className="cc-btn"
              style={{ ...actionButtonStyle, background: tokens.colors.danger, color: "#ffffff", border: "none" }}
            >
              Clock Out Now
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: tokens.spacing[3],
              marginBottom: tokens.spacing[4],
            }}
          >
            <FormField label="Clock In Date" type="date" value={manualClockInDate} onChange={setManualClockInDate} />
            <FormField label="Clock In Time" type="time" value={manualClockInTime} onChange={setManualClockInTime} />
            <FormField label="Clock Out Date" type="date" value={manualClockOutDate} onChange={setManualClockOutDate} />
            <FormField label="Clock Out Time" type="time" value={manualClockOutTime} onChange={setManualClockOutTime} />
          </div>

          <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={editingLog ? updateExistingLog : saveManualLog}
              disabled={saving}
              className="cc-btn"
              style={{ ...actionButtonStyle, background: tokens.signal.base, color: "#1a1305", border: "none" }}
            >
              {editingLog ? "Update Existing Log" : "Save New Manual Log"}
            </button>
            <button
              type="button"
              onClick={updateOpenLogWithManualClockOut}
              disabled={saving}
              className="cc-btn"
              style={{ ...actionButtonStyle, background: tokens.paper.surface2, color: tokens.paper.ink, border: `1px solid ${tokens.paper.borderStrong}` }}
            >
              Update Open Log With Manual Clock Out
            </button>
            {editingLog && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="cc-btn"
                style={{ ...actionButtonStyle, background: "transparent", color: tokens.paper.inkMuted, border: `1px solid ${tokens.paper.border}` }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </Panel>
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Upcoming Shifts</SectionHeader>
        <ScheduleList shifts={upcomingShifts} emptyLabel="No upcoming shifts." />
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Recent Shifts</SectionHeader>
        <ScheduleList shifts={recentShifts} emptyLabel="No recent shifts." />
      </section>

      <section>
        <SectionHeader>Time History</SectionHeader>
        {clockLogs.length === 0 ? (
          <EmptyState
            title="No time records"
            description="Clock activity for this employee will appear here."
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
                  <th scope="col" style={thStyle}>Clock In</th>
                  <th scope="col" style={thStyle}>Clock Out</th>
                  <th scope="col" style={thStyle}>Hours</th>
                  <th scope="col" style={thStyle}>Location</th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                    <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clockLogs.map((log) => {
                  const hours = getHours(log.clock_in, log.clock_out);
                  return (
                    <tr key={log.id}>
                      <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                        {log.clock_in ? formatAppDateTime(log.clock_in) : "—"}
                        {log.entered_by_admin && (
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
                      <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                        {log.clock_out ? formatAppDateTime(log.clock_out) : "—"}
                      </td>
                      <td style={tdStyle}>
                        {hours != null ? `${hours.toFixed(2)} hrs` : log.clock_in && !log.clock_out ? "Active" : "—"}
                      </td>
                      <td style={{ ...tdStyle, color: log.latitude != null && log.longitude != null ? tokens.paper.ink : tokens.paper.inkFaint }}>
                        {log.latitude != null && log.longitude != null ? "Location recorded" : "No location"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => startEdit(log)}
                            disabled={saving}
                            className="cc-btn"
                            style={rowButtonStyle}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLog(log.id)}
                            disabled={saving}
                            className="cc-btn"
                            style={{ ...rowButtonStyle, color: tokens.colors.dangerInk, borderColor: tokens.colors.danger }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BackToPeopleLink() {
  return (
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
  );
}

function ScheduleList({ shifts, emptyLabel }: { shifts: ScheduleRow[]; emptyLabel: string }) {
  if (shifts.length === 0) {
    return (
      <EmptyState
        title={emptyLabel}
        style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
      />
    );
  }

  return (
    <Panel padding="sm">
      {shifts.map((shift, i) => (
        <div
          key={shift.id}
          style={{
            padding: `${tokens.spacing[3]} ${tokens.spacing[2]}`,
            borderTop: i > 0 ? `1px solid ${tokens.paper.border}` : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: tokens.typography.weight.semibold, fontSize: tokens.typography.size.sm }}>
              {formatAppDate(shift.work_date)}
            </span>
            {shift.is_outing && (
              <span
                style={{
                  fontFamily: tokens.fontFamilyOpsDeck.mono,
                  fontSize: 9.5,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: tokens.signal.strong,
                  border: `1px solid ${tokens.signal.base}`,
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                Outing
              </span>
            )}
          </div>
          <div style={{ fontFamily: tokens.fontFamilyOpsDeck.mono, fontSize: 12, color: tokens.paper.inkMuted, marginTop: 2 }}>
            {formatAppTimeRange(shift.start_time, shift.end_time)} · {shift.house_name || "—"}
          </div>
          {(shift.mileage != null || shift.daily_log) && (
            <div style={{ fontSize: 12, color: tokens.paper.inkFaint, marginTop: 2 }}>
              Mileage: {shift.mileage ?? "—"} · {shift.daily_log || "No notes added."}
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

function FormField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: "date" | "time";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: tokens.typography.size.sm }}>
      <span style={{ fontWeight: tokens.typography.weight.medium, color: tokens.paper.inkMuted }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minHeight: 44,
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          borderRadius: tokens.radius.structural,
          border: `1px solid ${tokens.paper.borderStrong}`,
          background: tokens.paper.surface,
          color: tokens.paper.ink,
          fontSize: tokens.typography.size.sm,
        }}
      />
    </label>
  );
}

const actionButtonStyle: React.CSSProperties = {
  padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: tokens.radius.structural,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.semibold,
};

const rowButtonStyle: React.CSSProperties = {
  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  minHeight: 36,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: tokens.radius.structural,
  border: `1px solid ${tokens.paper.borderStrong}`,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.semibold,
  color: tokens.paper.ink,
  background: "transparent",
};

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
