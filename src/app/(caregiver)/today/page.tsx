"use client";

import { useCallback, useEffect, useState } from "react";
import { useCaregiverProfile } from "../../../hooks/useCaregiverSession";
import { supabase } from "../../../supabaseClient";
import {
  APP_TIMEZONE,
  formatAppDate,
  formatAppTimeRange,
  getAppTodayISODate,
  getWeekStartISODate,
  normalizeUtcValue,
} from "../../../lib/time";
import { tokens } from "../../../styles/tokens";
import { ClockAction, LoadingSpinner, SectionHeader, StatusDot } from "../../../components/ui";

/*
  Real Caregiver Today. Employee/profile come from useCaregiverProfile()
  (resolved once by CaregiverShell) — no repeated getUser/profile/employee
  lookup here.

  Clock in/out preserves employee/clock/page.tsx's business rules exactly:
  same JOB_SITE, same ALLOWED_RADIUS_METERS, same haversine formula, same
  fresh-at-click-time geolocation check, same guards, same clock_logs
  insert/update payload shapes. Presentation is new; outcomes are not.

  Scheduled-house context (below) is informational only and never wired
  to the location/geofence check, which stays entirely JOB_SITE-based —
  the UI keeps these two concepts visibly separate rather than implying
  CareClock verifies location against a scheduled house.
*/

const JOB_SITE = {
  name: "Client Home — Marysville",
  latitude: 48.03957,
  longitude: -122.14665,
};

const ALLOWED_RADIUS_METERS = 50000;

// Exact copy of employee/clock/page.tsx's pure haversine function.
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;

  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function parseTimestamp(value: string): Date {
  return new Date(normalizeUtcValue(value) ?? value);
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

type ClockStatus = "clocked-in" | "clocked-out";
type Feedback = { type: "success" | "error"; message: string };

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

export default function TodayPage() {
  const { employee } = useCaregiverProfile();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [clockStatus, setClockStatus] = useState<ClockStatus>("clocked-out");
  const [clockInIso, setClockInIso] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [distanceAway, setDistanceAway] = useState<string | null>(null);
  const [locationUnavailable, setLocationUnavailable] = useState(false);

  const [todayShift, setTodayShift] = useState<ScheduleRow | null>(null);
  const [nextShift, setNextShift] = useState<ScheduleRow | null>(null);
  const [weeklyHours, setWeeklyHours] = useState(0);

  const [mileageInput, setMileageInput] = useState("");
  const [dailyLogInput, setDailyLogInput] = useState("");
  const [shiftLogDirty, setShiftLogDirty] = useState(false);
  const [savingShiftLog, setSavingShiftLog] = useState(false);

  const updateLocationState = useCallback((lat: number, lng: number) => {
    setLocationUnavailable(false);

    const metersAway = getDistanceMeters(lat, lng, JOB_SITE.latitude, JOB_SITE.longitude);
    setDistanceAway(metersAway.toFixed(0));
    return metersAway;
  }, []);

  const checkCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationUnavailable(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => updateLocationState(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        console.error(err);
        setLocationUnavailable(true);
      }
    );
  }, [updateLocationState]);

  const loadData = useCallback(async () => {
    try {
      const { data: latestLog, error: latestLogError } = await supabase
        .from("clock_logs")
        .select("id, employee_id, clock_in, clock_out, latitude, longitude")
        .eq("employee_id", employee.id)
        .order("clock_in", { ascending: false })
        .limit(1)
        .single();

      if (!latestLogError && latestLog) {
        const isOpen = Boolean(latestLog.clock_in) && !latestLog.clock_out;
        setClockStatus(isOpen ? "clocked-in" : "clocked-out");
        setClockInIso(isOpen ? latestLog.clock_in : null);
      } else {
        setClockStatus("clocked-out");
        setClockInIso(null);
      }

      const todayISO = getAppTodayISODate();

      const { data: scheduleRows } = await supabase
        .from("schedules")
        .select("*")
        .eq("employee_id", employee.id)
        .gte("work_date", todayISO)
        .order("work_date", { ascending: true })
        .limit(5);

      const rows = (scheduleRows ?? []) as ScheduleRow[];
      const today = rows.find((r) => r.work_date === todayISO) ?? null;
      const next = rows.find((r) => r.work_date > todayISO) ?? null;

      setTodayShift(today);
      setNextShift(next);
      setMileageInput(today?.mileage != null ? String(today.mileage) : "");
      setDailyLogInput(today?.daily_log ?? "");
      setShiftLogDirty(false);

      // "This week" — Sunday-Saturday, matching payroll/page.tsx's existing
      // convention (see getWeekStartISODate). Only completed shifts
      // contribute to this static total, matching the same completed-only
      // rule employee/timesheets/page.tsx's own totalHours already uses;
      // the live elapsed timer above represents the current open shift
      // separately, so nothing is double-counted or missing.
      const weekStartISO = getWeekStartISODate();
      const { data: weekLogs } = await supabase
        .from("clock_logs")
        .select("clock_in, clock_out")
        .eq("employee_id", employee.id)
        .gte("clock_in", `${weekStartISO}T00:00:00Z`);

      const total = (weekLogs ?? []).reduce((sum, log) => {
        if (!log.clock_in || !log.clock_out) return sum;
        const start = parseTimestamp(log.clock_in).getTime();
        const end = parseTimestamp(log.clock_out).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;
        return sum + (end - start) / (1000 * 60 * 60);
      }, 0);

      setWeeklyHours(total);
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Couldn't load your latest data." });
    } finally {
      setLoadingInitial(false);
    }
  }, [employee.id]);

  useEffect(() => {
    checkCurrentLocation();
    void loadData();
  }, [checkCurrentLocation, loadData]);

  // Local ticking display only — zero database calls per tick. Stops the
  // instant clockInIso goes null (clock-out), not just on unmount.
  useEffect(() => {
    if (clockStatus !== "clocked-in" || !clockInIso) {
      setElapsedSeconds(0);
      return;
    }

    function tick() {
      const start = parseTimestamp(clockInIso as string).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [clockStatus, clockInIso]);

  const isWithinRadius = distanceAway !== null && Number(distanceAway) <= ALLOWED_RADIUS_METERS;

  async function handleClockIn() {
    setFeedback(null);

    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: "Geolocation not supported" });
      return;
    }

    setActionLoading(true);

    const { data: existingOpenShift, error: existingShiftError } = await supabase
      .from("clock_logs")
      .select("id")
      .eq("employee_id", employee.id)
      .is("clock_out", null)
      .maybeSingle();

    if (existingShiftError) {
      setFeedback({ type: "error", message: existingShiftError.message });
      setActionLoading(false);
      return;
    }

    if (existingOpenShift) {
      setFeedback({ type: "error", message: "You are already clocked in." });
      setActionLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          const metersAway = updateLocationState(lat, lng);

          if (metersAway > ALLOWED_RADIUS_METERS) {
            setFeedback({
              type: "error",
              message: `Clock in blocked. You are ${metersAway.toFixed(
                0
              )} meters away from ${JOB_SITE.name}. You must be within ${ALLOWED_RADIUS_METERS} meters.`,
            });
            setActionLoading(false);
            return;
          }

          const nowIso = new Date().toISOString();

          const { error } = await supabase.from("clock_logs").insert([
            {
              employee_id: employee.id,
              latitude: lat,
              longitude: lng,
              clock_in: nowIso,
            },
          ]);

          if (error) {
            setFeedback({ type: "error", message: error.message });
            setActionLoading(false);
            return;
          }

          setClockStatus("clocked-in");
          setClockInIso(nowIso);
          setFeedback({ type: "success", message: "Clocked in successfully." });
        } catch (err) {
          console.error(err);
          setFeedback({ type: "error", message: "Failed to clock in" });
        } finally {
          setActionLoading(false);
        }
      },
      (err) => {
        console.error(err);
        setFeedback({ type: "error", message: "Unable to get location" });
        setActionLoading(false);
      }
    );
  }

  async function handleClockOut() {
    setFeedback(null);
    setActionLoading(true);

    try {
      const { data: openShift, error: openShiftError } = await supabase
        .from("clock_logs")
        .select("id, clock_in, clock_out")
        .eq("employee_id", employee.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .maybeSingle();

      if (openShiftError) {
        setFeedback({ type: "error", message: openShiftError.message });
        setActionLoading(false);
        return;
      }

      if (!openShift) {
        setFeedback({ type: "error", message: "You are not currently clocked in." });
        setClockStatus("clocked-out");
        setActionLoading(false);
        return;
      }

      const nowIso = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("clock_logs")
        .update({ clock_out: nowIso })
        .eq("id", openShift.id);

      if (updateError) {
        setFeedback({ type: "error", message: updateError.message });
        setActionLoading(false);
        return;
      }

      setClockStatus("clocked-out");
      setClockInIso(null);
      setFeedback({ type: "success", message: "Clocked out successfully." });
      await loadData();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to clock out." });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveShiftLog() {
    if (!todayShift) return;

    const parsedMileage = mileageInput.trim() === "" ? null : Number(mileageInput);

    if (parsedMileage !== null && Number.isNaN(parsedMileage)) {
      setFeedback({ type: "error", message: "Mileage must be a valid number." });
      return;
    }

    setSavingShiftLog(true);

    const { error } = await supabase
      .from("schedules")
      .update({ mileage: parsedMileage, daily_log: dailyLogInput.trim() || null })
      .eq("id", todayShift.id);

    setSavingShiftLog(false);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      return;
    }

    setFeedback({ type: "success", message: "Mileage and notes saved." });
    await loadData();
  }

  if (loadingInitial) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading today..." />
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  });

  const locationStatusText = locationUnavailable
    ? "Location unavailable — check permissions"
    : distanceAway === null
    ? "Checking your location…"
    : isWithinRadius
    ? `Within range of ${JOB_SITE.name}`
    : `Outside range — ${distanceAway}m away (limit ${ALLOWED_RADIUS_METERS}m)`;

  return (
    <div>
      {/* 1. Employee/date context */}
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <div
          style={{
            fontFamily: tokens.fontFamilyOpsDeck.mono,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: tokens.shell.inkFaint,
            marginBottom: 4,
          }}
        >
          {todayLabel}
        </div>
        <h1 style={{ fontSize: tokens.typography.size.xl, fontWeight: tokens.typography.weight.bold, margin: 0 }}>
          {clockStatus === "clocked-in" ? "You're on shift" : `Hi, ${employee.name.split(" ")[0]}`}
        </h1>
      </div>

      {feedback?.type === "error" && (
        <div
          role="alert"
          style={{
            marginBottom: tokens.spacing[4],
            padding: tokens.spacing[3],
            borderRadius: tokens.radius.structural,
            background: "rgba(199, 58, 46, 0.12)",
            border: `1px solid ${tokens.action.off}`,
            color: tokens.shell.ink,
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
            marginBottom: tokens.spacing[4],
            padding: tokens.spacing[3],
            borderRadius: tokens.radius.structural,
            background: "rgba(31, 110, 92, 0.14)",
            border: `1px solid ${tokens.action.on}`,
            color: tokens.shell.ink,
            fontSize: tokens.typography.size.sm,
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* 2. Current clock state */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: tokens.spacing[4] }}>
        <StatusDot
          active={clockStatus === "clocked-in"}
          label={clockStatus === "clocked-in" ? "Clocked In" : "Clocked Out"}
          onShell
        />
      </div>

      {/* 3 + 4. Dominant clock control, elapsed time shown on the button itself */}
      <div style={{ marginBottom: tokens.spacing[3] }}>
        <ClockAction
          status={clockStatus}
          loading={actionLoading}
          disabled={clockStatus === "clocked-out" ? !isWithinRadius : false}
          elapsedLabel={formatElapsed(elapsedSeconds)}
          onClick={clockStatus === "clocked-in" ? handleClockOut : handleClockIn}
        />
      </div>

      {/* 5. Location status */}
      <p
        style={{
          textAlign: "center",
          fontSize: tokens.typography.size.sm,
          color: tokens.shell.inkMuted,
          marginBottom: tokens.spacing[7],
        }}
      >
        {locationStatusText}
      </p>

      {/* 6. Today's scheduled shift — informational only, never wired to the geofence check above */}
      <div style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader tone="shell">Today&rsquo;s Shift</SectionHeader>
        {todayShift ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: tokens.typography.size.base }}>
                {todayShift.house_name || "No location on file"}
              </span>
              {todayShift.is_outing && (
                <span
                  style={{
                    fontFamily: tokens.fontFamilyOpsDeck.mono,
                    fontSize: 9.5,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: tokens.signal.base,
                    border: `1px solid ${tokens.shell.border}`,
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                >
                  Outing
                </span>
              )}
            </div>
            <div style={{ fontSize: tokens.typography.size.sm, color: tokens.shell.inkMuted, marginTop: 2 }}>
              {formatAppTimeRange(todayShift.start_time, todayShift.end_time)}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: tokens.shell.inkMuted, fontSize: tokens.typography.size.sm }}>
            No shift scheduled for today.
          </p>
        )}
      </div>

      {/* 7. Mileage + Daily Log — only when a real schedule row exists for today */}
      {todayShift && (
        <div style={{ marginBottom: tokens.spacing[7] }}>
          <SectionHeader tone="shell">Mileage &amp; Notes</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: tokens.typography.size.sm, color: tokens.shell.inkMuted }}>Mileage (mi)</span>
              <input
                type="number"
                inputMode="decimal"
                value={mileageInput}
                onChange={(e) => {
                  setMileageInput(e.target.value);
                  setShiftLogDirty(true);
                }}
                placeholder="Enter mileage"
                style={{
                  padding: "12px 14px",
                  minHeight: 44,
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.shell.border}`,
                  background: tokens.shell.bg2,
                  color: tokens.shell.ink,
                  fontSize: tokens.typography.size.base,
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: tokens.typography.size.sm, color: tokens.shell.inkMuted }}>Notes</span>
              <textarea
                value={dailyLogInput}
                onChange={(e) => {
                  setDailyLogInput(e.target.value);
                  setShiftLogDirty(true);
                }}
                rows={3}
                placeholder="Add notes for this shift"
                style={{
                  padding: "12px 14px",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.shell.border}`,
                  background: tokens.shell.bg2,
                  color: tokens.shell.ink,
                  fontSize: tokens.typography.size.base,
                  resize: "vertical",
                }}
              />
            </label>

            {shiftLogDirty && (
              <button
                type="button"
                onClick={saveShiftLog}
                disabled={savingShiftLog}
                className="cc-btn"
                style={{
                  minHeight: 44,
                  padding: "10px 18px",
                  borderRadius: tokens.radius.structural,
                  border: "none",
                  background: tokens.signal.base,
                  color: "#1a1305",
                  fontWeight: tokens.typography.weight.semibold,
                  fontSize: tokens.typography.size.sm,
                  alignSelf: "flex-start",
                }}
              >
                {savingShiftLog ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 8. Next shift */}
      <div style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader tone="shell">Next Shift</SectionHeader>
        {nextShift ? (
          <p style={{ margin: 0, fontSize: tokens.typography.size.sm }}>
            {formatAppDate(nextShift.work_date)} · {nextShift.house_name || "No location on file"} ·{" "}
            {formatAppTimeRange(nextShift.start_time, nextShift.end_time)}
          </p>
        ) : (
          <p style={{ margin: 0, color: tokens.shell.inkMuted, fontSize: tokens.typography.size.sm }}>
            No upcoming shifts scheduled.
          </p>
        )}
      </div>

      {/* 9. This week's hours */}
      <div>
        <SectionHeader tone="shell">This Week</SectionHeader>
        <div style={{ fontFamily: tokens.fontFamilyOpsDeck.mono, fontSize: 28, fontWeight: 700 }}>
          {weeklyHours.toFixed(2)}h
        </div>
        <p style={{ margin: "2px 0 0", fontSize: tokens.typography.size.xs, color: tokens.shell.inkFaint }}>
          Completed shifts only — this updates once you clock out.
        </p>
      </div>
    </div>
  );
}
