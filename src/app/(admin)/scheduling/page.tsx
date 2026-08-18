"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminProfile } from "../../../hooks/useAdminSession";
import { supabase } from "../../../supabaseClient";
import { formatAppDate, formatAppTimeRange } from "../../../lib/time";
import { tokens } from "../../../styles/tokens";
import { SectionHeader, Panel, EmptyState, LoadingSpinner } from "../../../components/ui";
import WeeklySchedule, {
  type Schedule,
  DAYS,
  getDayLabel,
  getWeekStartSunday,
  formatShortDate,
  formatDateKey,
  formatDateForPrint,
} from "../../../components/WeeklySchedule";

/*
  Scheduling A — migrated in place from the legacy bare /scheduling route.
  Every real query, mutation, and validation rule below is preserved
  exactly from Pre-A (commit ad1d6ec) — only auth (AdminShell/
  useAdminProfile, no duplicated getUser/profiles lookup), the page's
  visual hierarchy (weekly board now primary, per the locked product
  direction), and WeeklySchedule's presentation change.

  The now-fully-dead legacy page-level openWeeklySchedulePdfView function
  and its private formatDateForPrint helper are not carried into this
  file at all — that's the approved dead-code removal for this step.
  handleExportPdf below is Pre-A's popup-generation algorithm relocated
  verbatim (not rewritten) to sit next to the weekStart state the
  page-level toolbar now owns.

  Deliberately not touched here, per explicit instruction: inactive-
  employee filtering, mutation org-scoping hardening, overlap validation,
  timezone handling. All carried forward exactly as they exist today.
*/

type Employee = {
  id: string;
  name: string;
};

function getEmployeeNameFrom(employees: Employee[], employeeId: string) {
  return employees.find((e) => e.id === employeeId)?.name ?? "Unknown";
}

function SchedulingPageContent() {
  const { org_id: orgId } = useAdminProfile();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [employeeId, setEmployeeId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [mileage, setMileage] = useState("");
  const [isOuting, setIsOuting] = useState(false);
  const [dailyLog, setDailyLog] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedShiftEmployeeId, setSelectedShiftEmployeeId] = useState("all");
  const [shiftSearch, setShiftSearch] = useState("");

  const [weekStart, setWeekStart] = useState(getWeekStartSunday());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, name")
      .eq("org_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as Employee[];
    setEmployees(rows);

    if (!employeeId && rows.length > 0) {
      setEmployeeId(rows[0].id);
    }
  }

  async function loadSchedules() {
    const { data, error } = await supabase
      .from("schedules")
      .select("*")
      .eq("org_id", orgId)
      .order("work_date", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setSchedules((data ?? []) as Schedule[]);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);

      await Promise.all([loadEmployees(), loadSchedules()]);

      if (!cancelled) setLoading(false);
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function handleEditShift(shift: Schedule) {
    setEditingId(shift.id);
    setEmployeeId(shift.employee_id);
    setHouseName(shift.house_name ?? "");
    setWorkDate(shift.work_date?.slice(0, 10) ?? "");
    setStartTime(shift.start_time ?? "");
    setEndTime(shift.end_time ?? "");
    setMileage(shift.mileage != null ? String(shift.mileage) : "");
    setIsOuting(Boolean(shift.is_outing));
    setDailyLog(shift.daily_log ?? "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setHouseName("");
    setWorkDate("");
    setStartTime("");
    setEndTime("");
    setMileage("");
    setIsOuting(false);
    setDailyLog("");
  }

  function handleNewShiftClick() {
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAddShiftFromCalendar(house: string, clickedDate: string) {
    setHouseName(house);
    setWorkDate(clickedDate);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (!workDate) {
      setError("Please select a work date.");
      return;
    }

    setSaving(true);

    const parsedMileage = mileage.trim() === "" ? null : Number(mileage);

    if (parsedMileage !== null && Number.isNaN(parsedMileage)) {
      setError("Mileage must be a valid number.");
      setSaving(false);
      return;
    }

    const payload = {
      org_id: orgId,
      employee_id: employeeId,
      house_name: houseName.trim() || null,
      work_date: workDate,
      start_time: startTime || null,
      end_time: endTime || null,
      mileage: parsedMileage,
      is_outing: isOuting,
      daily_log: dailyLog.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("schedules").update(payload).eq("id", editingId);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("schedules").insert([payload]);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    resetForm();
    await loadSchedules();
    setSaving(false);
  }

  async function deleteShift(id: string) {
    setError(null);

    const confirmed = window.confirm("Delete this shift?");
    if (!confirmed) return;

    const { error } = await supabase.from("schedules").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadSchedules();
  }

  useEffect(() => {
    if (!editId || schedules.length === 0) return;

    const shiftToEdit = schedules.find((s) => s.id === editId);
    if (shiftToEdit) {
      handleEditShift(shiftToEdit);
    }
  }, [editId, schedules]);

  function goPrevWeek() {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  }

  function goNextWeek() {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  }

  function goToday() {
    setWeekStart(getWeekStartSunday());
  }

  // Pre-A's popup PDF export, relocated verbatim (not rewritten) to sit
  // next to the weekStart state the page-level toolbar now owns.
  function handleExportPdf() {
    const weekDates = DAYS.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });

    const visibleHouses = Array.from(
      new Set(
        schedules
          .filter((s) => {
            const shiftDate = new Date(`${s.work_date}T00:00:00`);
            const shiftWeekStart = getWeekStartSunday(shiftDate);
            return shiftWeekStart.getTime() === weekStart.getTime();
          })
          .map((s) => s.house_name?.trim())
          .filter(Boolean)
      )
    ) as string[];

    const html = `
<!DOCTYPE html>
<html>
<head>
<title>Weekly Schedule</title>
<meta charset="utf-8" />
<style>
body {
font-family: Arial, sans-serif;
margin: 0;
padding: 24px;
color: #111827;
background: white;
}

h1 {
margin: 0 0 6px 0;
font-size: 32px;
}

.sub {
margin: 0 0 20px 0;
color: #6b7280;
font-size: 14px;
line-height: 1.4;
}

.print-btn {
background: #2563eb;
color: white;
border: none;
padding: 10px 16px;
border-radius: 10px;
font-weight: 700;
cursor: pointer;
margin-bottom: 20px;
}

table {
width: 100%;
border-collapse: collapse;
table-layout: fixed;
}

th, td {
border: 1px solid #d1d5db;
vertical-align: top;
padding: 10px;
font-size: 12px;
}

th {
background: #f8fafc;
font-weight: 700;
text-align: center;
}

.house-col {
width: 120px;
font-weight: 700;
background: #f8fafc;
}

.shift-card {
border: 1px solid #e5e7eb;
border-radius: 8px;
padding: 6px;
margin-bottom: 6px;
background: #f9fafb;
}

.shift-name {
font-weight: 700;
margin-bottom: 4px;
}

.empty {
color: #9ca3af;
}

@media print {
.print-btn {
display: none;
}

@page {
size: landscape;
margin: 16px;
}

body {
padding: 16px;
}
}
</style>
</head>
<body>
<h1>Steps Towards Independence</h1>
<p class="sub">
Weekly Staff Schedule<br />
${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}
</p>

<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>

<table>
<thead>
<tr>
<th class="house-col">House</th>
${weekDates
  .map(
    (date, index) =>
      `<th>${DAYS[index]}<br /><span style="font-weight:400;">${formatShortDate(date)}</span></th>`
  )
  .join("")}
</tr>
</thead>
<tbody>
${visibleHouses
  .map((house) => {
    return `
<tr>
<td class="house-col">${house}</td>
${weekDates
  .map((date, index) => {
    const day = DAYS[index];
    const dateKey = formatDateKey(date);

    const cellShifts = schedules.filter((s) => {
      return (
        (s.house_name ?? "").trim() === house &&
        s.work_date === dateKey &&
        getDayLabel(s.work_date) === day
      );
    });

    if (cellShifts.length === 0) {
      return `<td><span class="empty">—</span></td>`;
    }

    return `
<td>
${cellShifts
  .map(
    (shift) => `
<div class="shift-card">
<div class="shift-name">${getEmployeeNameFrom(employees, shift.employee_id)}</div>
<div>${formatDateForPrint(shift.work_date)}</div>
<div>${formatAppTimeRange(shift.start_time, shift.end_time)}</div>
${shift.mileage != null ? `<div>Mileage: ${shift.mileage}</div>` : ""}
</div>
`
  )
  .join("")}
</td>
`;
  })
  .join("")}
</tr>
`;
  })
  .join("")}
</tbody>
</table>
</body>
</html>
`;

    const popup = window.open("", "_blank", "width=1400,height=900");
    if (!popup) return;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
  }

  const filteredEmployeeOptions = useMemo(() => {
    return employees.filter((emp) => emp.name.toLowerCase().includes(shiftSearch.toLowerCase()));
  }, [employees, shiftSearch]);

  const visibleSchedules = useMemo(() => {
    if (selectedShiftEmployeeId === "all") return schedules;
    return schedules.filter((s) => s.employee_id === selectedShiftEmployeeId);
  }, [schedules, selectedShiftEmployeeId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
        <LoadingSpinner size="lg" label="Loading Schedule..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <h1 style={{ fontSize: tokens.typography.size["2xl"], fontWeight: tokens.typography.weight.bold, margin: "0 0 4px" }}>
          Schedule
        </h1>
        <p style={{ margin: 0, color: tokens.paper.inkMuted, fontSize: tokens.typography.size.sm }}>
          Weekly workforce scheduling and shift management.
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: tokens.spacing[3],
          marginBottom: tokens.spacing[5],
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing[2], flexWrap: "wrap" }}>
          <button type="button" onClick={goPrevWeek} className="cc-btn" style={toolbarBtn}>
            ◀ Previous
          </button>
          <button type="button" onClick={goToday} className="cc-btn" style={toolbarBtn}>
            Today
          </button>
          <button type="button" onClick={goNextWeek} className="cc-btn" style={toolbarBtn}>
            Next ▶
          </button>
          <span
            style={{
              fontFamily: tokens.fontFamilyOpsDeck.mono,
              fontSize: tokens.typography.size.sm,
              color: tokens.paper.inkMuted,
              marginLeft: tokens.spacing[2],
            }}
          >
            {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
          </span>
        </div>

        <div style={{ display: "flex", gap: tokens.spacing[2], flexWrap: "wrap" }}>
          <button type="button" onClick={handleExportPdf} className="cc-btn" style={toolbarBtn}>
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleNewShiftClick}
            className="cc-btn"
            style={{ ...toolbarBtn, background: tokens.signal.base, color: "#1a1305", border: "none", fontWeight: tokens.typography.weight.bold }}
          >
            + New Shift
          </button>
        </div>
      </div>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>Weekly Board</SectionHeader>
        <WeeklySchedule
          schedules={schedules}
          employees={employees}
          weekStart={weekStart}
          onAddShift={handleAddShiftFromCalendar}
          onEditShift={handleEditShift}
        />
      </section>

      <section style={{ marginBottom: tokens.spacing[7] }}>
        <SectionHeader>{editingId ? "Edit Shift" : "New Shift"}</SectionHeader>
        <Panel padding="md" style={{ maxWidth: 640 }}>
          <form onSubmit={saveSchedule} style={{ display: "grid", gap: tokens.spacing[4] }}>
            <FormField label="Employee">
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle}>
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="House">
              <input
                type="text"
                placeholder="Ex: Maple House"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                style={inputStyle}
              />
            </FormField>

            <FormField label="Work Date">
              <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} style={inputStyle} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacing[3] }}>
              <FormField label="Start Time">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
              </FormField>
              <FormField label="End Time">
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
              </FormField>
            </div>

            <FormField label="Mileage">
              <input
                type="number"
                placeholder="Leave blank if none"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                style={inputStyle}
              />
            </FormField>

            <label style={{ display: "flex", alignItems: "center", gap: tokens.spacing[2], fontSize: tokens.typography.size.sm }}>
              <input type="checkbox" checked={isOuting} onChange={(e) => setIsOuting(e.target.checked)} />
              <span>Mark as outing</span>
            </label>

            <FormField label="Daily Log">
              <textarea
                placeholder="Add context for the shift, tasks, notes, or reminders"
                value={dailyLog}
                onChange={(e) => setDailyLog(e.target.value)}
                rows={5}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </FormField>

            <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={saving}
                className="cc-btn"
                style={{ ...actionButtonStyle, background: tokens.signal.base, color: "#1a1305", border: "none" }}
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Shift"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="cc-btn"
                  style={{ ...actionButtonStyle, background: "transparent", color: tokens.paper.inkMuted, border: `1px solid ${tokens.paper.border}` }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Panel>
      </section>

      <section>
        <SectionHeader>Scheduled Shifts</SectionHeader>

        <div style={{ display: "grid", gap: tokens.spacing[3], marginBottom: tokens.spacing[4], maxWidth: 480 }}>
          <FormField label="Search Employee">
            <input
              type="text"
              placeholder="Type employee name..."
              value={shiftSearch}
              onChange={(e) => setShiftSearch(e.target.value)}
              style={inputStyle}
            />
          </FormField>

          <FormField label="Filter Scheduled Shifts">
            <select value={selectedShiftEmployeeId} onChange={(e) => setSelectedShiftEmployeeId(e.target.value)} style={inputStyle}>
              <option value="all">All Employees</option>
              {filteredEmployeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {visibleSchedules.length === 0 ? (
          <EmptyState
            title="No scheduled shifts found"
            description="Try another employee or create a new shift."
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
                  <th scope="col" style={thStyle}>Employee</th>
                  <th scope="col" style={thStyle}>Date</th>
                  <th scope="col" style={thStyle}>Time</th>
                  <th scope="col" style={thStyle}>House</th>
                  <th scope="col" style={thStyle}>Outing</th>
                  <th scope="col" style={thStyle}>Mileage</th>
                  <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                    <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleSchedules.map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...tdStyle, fontWeight: tokens.typography.weight.semibold }}>
                      {getEmployeeNameFrom(employees, s.employee_id)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>{formatAppDate(s.work_date)}</td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {formatAppTimeRange(s.start_time, s.end_time)}
                    </td>
                    <td style={tdStyle}>{s.house_name || "—"}</td>
                    <td style={tdStyle}>{s.is_outing ? "Yes" : "No"}</td>
                    <td style={{ ...tdStyle, fontFamily: tokens.fontFamilyOpsDeck.mono }}>
                      {s.mileage != null ? s.mileage : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => handleEditShift(s)} className="cc-btn" style={rowButtonStyle}>
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteShift(s.id)} className="cc-btn" style={rowButtonStyle}>
                          Delete
                        </button>
                      </div>
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: tokens.typography.size.sm }}>
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

const toolbarBtn: React.CSSProperties = {
  minHeight: 40,
  padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
  borderRadius: tokens.radius.structural,
  border: `1px solid ${tokens.paper.border}`,
  background: tokens.paper.surface,
  color: tokens.paper.ink,
  fontSize: tokens.typography.size.sm,
  fontWeight: tokens.typography.weight.semibold,
};

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

export default function SchedulingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacing[9] }}>
          <LoadingSpinner size="lg" label="Loading Schedule..." />
        </div>
      }
    >
      <SchedulingPageContent />
    </Suspense>
  );
}
