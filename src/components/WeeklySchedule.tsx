"use client";

import { formatAppTimeRange } from "../lib/time";
import { tokens } from "../styles/tokens";
import { EmptyState } from "./ui";

/*
  Weekly house x day board (Scheduling A). Now a pure, controlled
  component — weekStart is owned by the parent page so a single
  page-level toolbar (Previous/Today/Next/date range/Export PDF/New
  Shift) can drive both this board and the export together, per the
  locked Scheduling A hierarchy. Previously this component owned its
  own week state and its own header row (Previous/Next + Export PDF);
  that ownership moved up, nothing about what it DOES changed.

  handleExportPdf and its helpers (Pre-A's relocated/upgraded print
  feature) moved to the parent page verbatim — same algorithm, same
  week-scoped popup HTML generation, just called from the page-level
  toolbar instead of a button inside this component. The helper
  functions below are exported so the page reuses the exact same code
  rather than a retyped copy.
*/

export type Schedule = {
  id: string;
  employee_id: string;
  org_id?: string;
  house_name: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  mileage: number | null;
  is_outing: boolean | null;
  daily_log: string | null;
};

type Employee = {
  id: string;
  name: string;
};

type WeeklyScheduleProps = {
  schedules: Schedule[];
  employees: Employee[];
  weekStart: Date;
  onAddShift: (house: string, clickedDate: string) => void;
  onEditShift: (shift: Schedule) => void;
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getDayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

export function getWeekStartSunday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForPrint(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WeeklySchedule({
  schedules,
  employees,
  weekStart,
  onAddShift,
  onEditShift,
}: WeeklyScheduleProps) {
  const houses = Array.from(
    new Set(schedules.map((s) => s.house_name?.trim()).filter(Boolean))
  ) as string[];

  function getEmployeeName(employeeId: string) {
    return employees.find((e) => e.id === employeeId)?.name ?? "Unknown";
  }

  function getCellShifts(house: string, day: string) {
    return schedules.filter((s) => {
      if ((s.house_name ?? "").trim() !== house) return false;

      const shiftDate = new Date(`${s.work_date}T00:00:00`);
      const shiftWeekStart = getWeekStartSunday(shiftDate);

      return shiftWeekStart.getTime() === weekStart.getTime() && getDayLabel(s.work_date) === day;
    });
  }

  if (houses.length === 0) {
    return (
      <EmptyState
        title="No scheduled houses yet."
        style={{ background: tokens.paper.surface2, border: `1px dashed ${tokens.paper.border}` }}
      />
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: `1px solid ${tokens.paper.border}`,
        borderRadius: tokens.radius.structural,
        background: tokens.paper.surface,
      }}
    >
      <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...thStyle, minWidth: 160 }}>
              House
            </th>
            {DAYS.map((day) => (
              <th key={day} scope="col" style={{ ...thStyle, textAlign: "center", minWidth: 150 }}>
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {houses.map((house) => (
            <tr key={house}>
              <td style={{ ...tdStyle, fontWeight: tokens.typography.weight.semibold }}>{house}</td>

              {DAYS.map((day, index) => {
                const cellDate = new Date(weekStart);
                cellDate.setDate(weekStart.getDate() + index);

                const clickedDate = formatDateKey(cellDate);
                const cellShifts = getCellShifts(house, day);

                return (
                  <td key={day} style={{ ...tdStyle, verticalAlign: "top" }}>
                    {cellShifts.length === 0 ? (
                      <button type="button" onClick={() => onAddShift(house, clickedDate)} style={addBtn} className="cc-btn">
                        + Add
                      </button>
                    ) : (
                      <div style={{ display: "grid", gap: tokens.spacing[2] }}>
                        {cellShifts.map((shift) => (
                          <div key={shift.id} onClick={() => onEditShift(shift)} style={shiftPillStyle} className="cc-btn">
                            <div style={{ fontWeight: tokens.typography.weight.semibold, fontSize: tokens.typography.size.sm }}>
                              {getEmployeeName(shift.employee_id)}
                            </div>
                            <div style={{ fontFamily: tokens.fontFamilyOpsDeck.mono, fontSize: 11, color: tokens.paper.inkMuted }}>
                              {formatAppTimeRange(shift.start_time, shift.end_time)}
                            </div>
                            {shift.is_outing ? <div style={outingBadge}>Outing</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
  padding: "10px 12px",
  borderBottom: `1px solid ${tokens.paper.border}`,
  fontSize: tokens.typography.size.sm,
};

const addBtn: React.CSSProperties = {
  width: "100%",
  padding: `${tokens.spacing[2]} ${tokens.spacing[2]}`,
  minHeight: 44,
  border: `1px dashed ${tokens.paper.borderStrong}`,
  borderRadius: tokens.radius.structural,
  background: "transparent",
  color: tokens.paper.inkMuted,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.medium,
};

const shiftPillStyle: React.CSSProperties = {
  padding: tokens.spacing[2],
  border: `1px solid ${tokens.paper.border}`,
  borderRadius: tokens.radius.structural,
  background: tokens.paper.surface2,
};

const outingBadge: React.CSSProperties = {
  marginTop: 4,
  display: "inline-block",
  fontFamily: tokens.fontFamilyOpsDeck.mono,
  fontSize: 9.5,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: tokens.signal.strong,
  border: `1px solid ${tokens.signal.base}`,
  borderRadius: 4,
  padding: "1px 5px",
};
