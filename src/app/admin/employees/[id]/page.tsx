"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../supabaseClient";
import {formatAppDate, formatAppDateTime, formatAppTimeRange} from "../../../../lib/time";

type EmployeeRow = {
id: string;
name: string;
email: string;
hourly_rate: number | null;
user_id: string | null;
org_id: string;
};

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
created_at: string | null;
entered_by_admin?: boolean | null;
};

type ProfileRow = {
id: string;
org_id: string;
role: string;
};

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

function getHours(clockIn: string | null, clockOut: string | null) {
if (!clockIn || !clockOut) return null;

const start = new Date(clockIn).getTime();
const end = new Date(clockOut).getTime();

if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

return (end - start) / (1000 * 60 * 60);
}

function combineDateAndTime(dateValue: string, timeValue: string) {
if (!dateValue || !timeValue) return null;

const combined = new Date(`${dateValue}T${timeValue}`);
if (Number.isNaN(combined.getTime())) return null;

return combined.toISOString();
}

export default function AdminEmployeeDetailPage() {
const router = useRouter();
const params = useParams();
const employeeId = params?.id as string;

const now = new Date();

const [authReady, setAuthReady] = useState(false);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);

const [employee, setEmployee] = useState<EmployeeRow | null>(null);
const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
const [clockLogs, setClockLogs] = useState<ClockLogRow[]>([]);
const [editingLog, setEditingLog] = useState<ClockLogRow | null>(null);

const [manualClockInDate, setManualClockInDate] = useState(
toDateInputValue(now)
);
const [manualClockInTime, setManualClockInTime] = useState(
toTimeInputValue(now)
);
const [manualClockOutDate, setManualClockOutDate] = useState(
toDateInputValue(now)
);
const [manualClockOutTime, setManualClockOutTime] = useState(
toTimeInputValue(now)
);

async function checkAdminAndLoad() {
setLoading(true);
setError(null);

const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
router.push("/login");
return;
}

const { data: profile, error: profileError } = await supabase
.from("profiles")
.select("id, org_id, role")
.eq("id", user.id)
.single();

if (profileError || !profile) {
router.push("/login");
return;
}

const adminProfile = profile as ProfileRow;

if (adminProfile.role !== "admin") {
router.push("/employee/clock");
return;
}

setAuthReady(true);

await Promise.all([
loadEmployee(adminProfile.org_id, employeeId),
loadSchedules(employeeId),
loadClockLogs(employeeId),
]);

setLoading(false);
}

async function loadEmployee(activeOrgId: string, id: string) {
const { data, error } = await supabase
.from("employees")
.select("id, name, email, hourly_rate, user_id, org_id")
.eq("id", id)
.eq("org_id", activeOrgId)
.single();

if (error || !data) {
setError("Employee not found.");
return;
}

setEmployee(data as EmployeeRow);
}

async function loadSchedules(id: string) {
const { data, error } = await supabase
.from("schedules")
.select("*")
.eq("employee_id", id)
.order("work_date", { ascending: false });

if (error) {
setError(error.message);
return;
}

setSchedules((data ?? []) as ScheduleRow[]);
}

async function loadClockLogs(id: string) {
const { data, error } = await supabase
.from("clock_logs")
.select("*")
.eq("employee_id", id)
.order("clock_in", { ascending: false });

if (error) {
setError(error.message);
return;
}

setClockLogs((data ?? []) as ClockLogRow[]);
}

async function refreshEmployeeData() {
if (!employeeId) return;
await Promise.all([loadSchedules(employeeId), loadClockLogs(employeeId)]);
}

function startEdit(log: ClockLogRow) {
    setEditingLog(log);
    
    if (log.clock_in) {
    const d = new Date(log.clock_in);
    setManualClockInDate(toDateInputValue(d));
    setManualClockInTime(toTimeInputValue(d));
    }
    
    if (log.clock_out) {
    const d = new Date(log.clock_out);
    setManualClockOutDate(toDateInputValue(d));
    setManualClockOutTime(toTimeInputValue(d));
    }
    }

async function adminClockInNow() {
if (!employee) return;

const openLog = clockLogs.find((log) => log.clock_in && !log.clock_out);
if (openLog) {
alert("This employee is already clocked in.");
return;
}

setSaving(true);
setError(null);

const { error } = await supabase.from("clock_logs").insert([
{
employee_id: employee.id,
clock_in: new Date().toISOString(),
entered_by_admin: true,
},
]);

if (error) {
setError(error.message);
setSaving(false);
return;
}

await loadClockLogs(employee.id);
setSaving(false);
}

async function adminClockOutNow() {
if (!employee) return;

const openLog = clockLogs.find((log) => log.clock_in && !log.clock_out);
if (!openLog) {
alert("No open clock-in found for this employee.");
return;
}

setSaving(true);
setError(null);

const { error } = await supabase
.from("clock_logs")
.update({
clock_out: new Date().toISOString(),
entered_by_admin: true,
})
.eq("id", openLog.id);

if (error) {
setError(error.message);
setSaving(false);
return;
}

await loadClockLogs(employee.id);
setSaving(false);
}

async function updateExistingLog() {
    if (!editingLog) return;
    
    const clockInIso = combineDateAndTime(
    manualClockInDate,
    manualClockInTime
    );
    
    const clockOutIso = combineDateAndTime(
    manualClockOutDate,
    manualClockOutTime
    );
    
    if (!clockInIso) {
    alert("Clock in required.");
    return;
    }
    
    if (
    clockOutIso &&
    new Date(clockOutIso).getTime() <= new Date(clockInIso).getTime()
    ) {
    alert("Clock out must be after clock in.");
    return;
    }
    
    setSaving(true);
    setError(null);
    
    const { error } = await supabase
    .from("clock_logs")
    .update({
    clock_in: clockInIso,
    clock_out: clockOutIso,
    entered_by_admin: true,
    })
    .eq("id", editingLog.id);
    
    if (error) {
    setError(error.message);
    setSaving(false);
    return;
    }
    
    await loadClockLogs(employee!.id);
    setEditingLog(null);
    setSaving(false);
    alert("Clock log updated.");
    }

async function saveManualLog() {
if (!employee) return;

const clockInIso = combineDateAndTime(manualClockInDate, manualClockInTime);
if (!clockInIso) {
alert("Please enter a valid clock-in date and time.");
return;
}

const clockOutIso =
manualClockOutDate && manualClockOutTime
? combineDateAndTime(manualClockOutDate, manualClockOutTime)
: null;

if (
clockOutIso &&
new Date(clockOutIso).getTime() <= new Date(clockInIso).getTime()
) {
alert("Clock out must be after clock in.");
return;
}

setSaving(true);
setError(null);

const { error } = await supabase.from("clock_logs").insert([
{
employee_id: employee.id,
clock_in: clockInIso,
clock_out: clockOutIso,
entered_by_admin: true,
},
]);

if (error) {
setError(error.message);
setSaving(false);
return;
}

await loadClockLogs(employee.id);
setSaving(false);
alert("Manual time log saved.");
}

async function updateOpenLogWithManualClockOut() {
if (!employee) return;

const openLog = clockLogs.find((log) => log.clock_in && !log.clock_out);
if (!openLog) {
alert("No open clock-in found for this employee.");
return;
}

const manualOutIso = combineDateAndTime(
manualClockOutDate,
manualClockOutTime
);

if (!manualOutIso) {
alert("Please enter a valid clock-out date and time.");
return;
}

if (
openLog.clock_in &&
new Date(manualOutIso).getTime() <= new Date(openLog.clock_in).getTime()
) {
alert("Clock out must be after the existing clock in.");
return;
}

setSaving(true);
setError(null);

const { error } = await supabase
.from("clock_logs")
.update({
clock_out: manualOutIso,
entered_by_admin: true,
})
.eq("id", openLog.id);

if (error) {
setError(error.message);
setSaving(false);
return;
}

await loadClockLogs(employee.id);
setSaving(false);
alert("Open log updated.");
}

async function deleteLog(logId: string) {
if (!employee) return;

const confirmed = window.confirm("Delete this clock log?");
if (!confirmed) return;

setSaving(true);
setError(null);

const { error } = await supabase.from("clock_logs").delete().eq("id", logId);

if (error) {
setError(error.message);
setSaving(false);
return;
}

await loadClockLogs(employee.id);
setSaving(false);
}

useEffect(() => {
if (!employeeId) return;
void checkAdminAndLoad();
}, [employeeId]);

const latestLog = useMemo(() => clockLogs[0] ?? null, [clockLogs]);

const currentStatus = useMemo(() => {
if (!latestLog) return "No Activity";
if (latestLog.clock_in && !latestLog.clock_out) return "Clocked In";
return "Clocked Out";
}, [latestLog]);

const totalHours = useMemo(() => {
return clockLogs.reduce((sum, log) => {
return sum + (getHours(log.clock_in, log.clock_out) ?? 0);
}, 0);
}, [clockLogs]);

if (!authReady && loading) {
return (
<main style={pageStyle}>
<p>Loading employee...</p>
</main>
);
}

return (
<main style={pageStyle}>
<div style={topRow}>
<div>
<button onClick={() => router.push("/admin/employees")} style={backBtn}>
← Back to Employees
</button>
<h1 style={{ margin: "12px 0 6px 0" }}>
{employee?.name ?? "Employee"}
</h1>
<p style={subText}>
Full employee overview, shifts, and clock activity.
</p>
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button onClick={adminClockInNow} style={greenBtn} disabled={saving}>
{saving ? "Working..." : "Admin Clock In Now"}
</button>
<button onClick={adminClockOutNow} style={redBtn} disabled={saving}>
{saving ? "Working..." : "Admin Clock Out Now"}
</button>
</div>
</div>

{error && <div style={errorCard}>{error}</div>}

<div style={statsRow}>
<div style={statCard}>
<div style={statLabel}>Email</div>
<div style={statValueSmall}>{employee?.email ?? "—"}</div>
</div>

<div style={statCard}>
<div style={statLabel}>Hourly Rate</div>
<div style={statValueSmall}>
{employee?.hourly_rate != null
? `$${employee.hourly_rate.toFixed(2)}`
: "—"}
</div>
</div>

<div style={statCard}>
<div style={statLabel}>Current Status</div>
<div
style={{
...statusPill,
background:
currentStatus === "Clocked In"
? "#dcfce7"
: currentStatus === "Clocked Out"
? "#e5e7eb"
: "#fef3c7",
color:
currentStatus === "Clocked In"
? "#166534"
: currentStatus === "Clocked Out"
? "#111827"
: "#92400e",
}}
>
{currentStatus}
</div>
</div>

<div style={statCard}>
<div style={statLabel}>Total Logged Hours</div>
<div style={statValueSmall}>{totalHours.toFixed(2)} hrs</div>
</div>
</div>

<div style={manualPanel}>
<div style={panelHeader}>
<div>
<h2 style={panelTitle}>Manual Time Correction</h2>
<p style={panelSub}>
Enter the actual arrival and departure time when an employee forgot
to clock in or out.
</p>
</div>
</div>

<div style={manualGrid}>
<div>
<label style={labelStyle}>Clock In Date</label>
<input
type="date"
value={manualClockInDate}
onChange={(e) => setManualClockInDate(e.target.value)}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>Clock In Time</label>
<input
type="time"
value={manualClockInTime}
onChange={(e) => setManualClockInTime(e.target.value)}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>Clock Out Date</label>
<input
type="date"
value={manualClockOutDate}
onChange={(e) => setManualClockOutDate(e.target.value)}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>Clock Out Time</label>
<input
type="time"
value={manualClockOutTime}
onChange={(e) => setManualClockOutTime(e.target.value)}
style={inputStyle}
/>
</div>
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
<button
onClick={() =>
    editingLog ? updateExistingLog() : saveManualLog()
    }style={primaryBtn}
disabled={saving}
>
{saving
? "Saving..."
: editingLog
? "Update Existing Log"
: "Save New Manual Log"}
</button>

<button
onClick={updateOpenLogWithManualClockOut}
style={secondaryBtn}
disabled={saving}
>
{saving ? "Saving..." : "Update Open Log With Manual Clock Out"}
</button>

{editingLog && (
<button
onClick={() => setEditingLog(null)}
style={backBtn}
disabled={saving}
>
Cancel Edit
</button>
)}

</div>
</div>

<div style={gridWrap}>
<section style={panelStyle}>
<div style={panelHeader}>
<div>
<h2 style={panelTitle}>Scheduled Shifts</h2>
<p style={panelSub}>All shifts assigned to this employee.</p>
</div>
</div>

{schedules.length === 0 ? (
<div style={emptyState}>No scheduled shifts yet.</div>
) : (
<div style={{ display: "grid", gap: 12 }}>
{schedules.map((shift) => (
<div key={shift.id} style={shiftCard}>
<div style={shiftTopRow}>
<div style={{ fontWeight: 700 }}>
{formatAppDate(shift.work_date)}
</div>
{shift.is_outing ? <span style={outingBadge}>Outing</span> : null}
</div>

<div style={shiftGrid}>
<div>
<div style={miniLabel}>Time</div>
<div style={miniValue}>
{formatAppTimeRange(shift.start_time, shift.end_time)}
</div>
</div>

<div>
<div style={miniLabel}>House</div>
<div style={miniValue}>{shift.house_name || "—"}</div>
</div>

<div>
<div style={miniLabel}>Mileage</div>
<div style={miniValue}>
{shift.mileage != null ? shift.mileage : "—"}
</div>
</div>
</div>

<div style={{ marginTop: 12 }}>
<div style={miniLabel}>Daily Log</div>
<div style={miniNote}>{shift.daily_log || "No notes added."}</div>
</div>
</div>
))}
</div>
)}
</section>

<section style={panelStyle}>
<div style={panelHeader}>
<div>
<h2 style={panelTitle}>Clock Log History</h2>
<p style={panelSub}>Recent time activity for this employee.</p>
</div>
</div>

{clockLogs.length === 0 ? (
<div style={emptyState}>No clock logs yet.</div>
) : (
<div style={tableWrap}>
<table style={tableStyle}>
<thead>
<tr>
<th style={thStyle}>Clock In</th>
<th style={thStyle}>Clock Out</th>
<th style={thStyle}>Hours</th>
<th style={thStyle}>Location</th>
<th style={thStyle}>Source</th>
<th style={thStyle}>Actions</th>
</tr>
</thead>
<tbody>
{clockLogs.map((log) => {
const hours = getHours(log.clock_in, log.clock_out);

return (
<tr key={log.id}>
<td style={tdStyle}>{formatAppDateTime(log.clock_in)}</td>
<td style={tdStyle}>{formatAppDateTime(log.clock_out)}</td>
<td style={tdStyle}>
{hours != null
? `${hours.toFixed(2)} hrs`
: log.clock_in
? "Active"
: "—"}
</td>
<td style={tdStyle}>
{log.latitude != null && log.longitude != null
? `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`
: "—"}
</td>

<td style={tdStyle}>
<div style={{ display: "flex", gap: 6 }}>
<button
onClick={() => startEdit(log)}
style={editBtn}
>
Edit
</button>

<button
onClick={() => deleteLog(log.id)}
style={smallDeleteBtn}
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
</main>
);
}

const pageStyle: React.CSSProperties = {
maxWidth: 1200,
margin: "40px auto",
padding: 20,
};

const topRow: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
gap: 16,
flexWrap: "wrap",
marginBottom: 24,
};

const backBtn: React.CSSProperties = {
background: "#e5e7eb",
color: "#111827",
border: "none",
padding: "8px 12px",
borderRadius: 8,
cursor: "pointer",
fontWeight: 600,
};

const subText: React.CSSProperties = {
margin: 0,
opacity: 0.72,
fontSize: 15,
};

const greenBtn: React.CSSProperties = {
padding: "10px 14px",
background: "#16a34a",
color: "white",
border: "none",
borderRadius: 10,
fontWeight: 700,
cursor: "pointer",
};

const redBtn: React.CSSProperties = {
padding: "10px 14px",
background: "#dc2626",
color: "white",
border: "none",
borderRadius: 10,
fontWeight: 700,
cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
padding: "10px 16px",
background: "#2563eb",
color: "white",
border: "none",
borderRadius: 10,
fontWeight: 700,
cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
padding: "10px 16px",
background: "#111827",
color: "white",
border: "none",
borderRadius: 10,
fontWeight: 700,
cursor: "pointer",
};

const statsRow: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 14,
marginBottom: 24,
};

const statCard: React.CSSProperties = {
background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
border: "1px solid #e5e7eb",
borderRadius: 16,
padding: 18,
boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)",
};

const statLabel: React.CSSProperties = {
fontSize: 12,
opacity: 0.68,
marginBottom: 8,
textTransform: "uppercase",
letterSpacing: 0.6,
};

const statValueSmall: React.CSSProperties = {
fontSize: 18,
fontWeight: 700,
};

const statusPill: React.CSSProperties = {
display: "inline-block",
padding: "6px 12px",
borderRadius: 999,
fontWeight: 700,
fontSize: 14,
};

const manualPanel: React.CSSProperties = {
background: "white",
border: "1px solid #e5e7eb",
borderRadius: 20,
padding: 20,
boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
marginBottom: 24,
};

const manualGrid: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 14,
};

const labelStyle: React.CSSProperties = {
display: "block",
marginBottom: 8,
fontSize: 13,
fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
width: "100%",
padding: "12px 14px",
border: "1px solid #d1d5db",
borderRadius: 12,
background: "#fff",
fontSize: 14,
};

const gridWrap: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "1fr 1.1fr",
gap: 20,
alignItems: "start",
};

const panelStyle: React.CSSProperties = {
background: "white",
border: "1px solid #e5e7eb",
borderRadius: 20,
padding: 20,
boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
};

const panelHeader: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
gap: 12,
marginBottom: 16,
};

const panelTitle: React.CSSProperties = {
margin: 0,
fontSize: 26,
};

const panelSub: React.CSSProperties = {
marginTop: 6,
marginBottom: 0,
opacity: 0.68,
fontSize: 14,
};

const shiftCard: React.CSSProperties = {
border: "1px solid #e5e7eb",
borderRadius: 16,
padding: 16,
background: "#f8fafc",
};

const shiftTopRow: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 12,
marginBottom: 12,
};

const shiftGrid: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(3, 1fr)",
gap: 12,
};

const miniLabel: React.CSSProperties = {
fontSize: 12,
fontWeight: 700,
opacity: 0.62,
textTransform: "uppercase",
letterSpacing: 0.5,
marginBottom: 4,
};

const miniValue: React.CSSProperties = {
fontSize: 16,
fontWeight: 600,
};

const miniNote: React.CSSProperties = {
fontSize: 14,
opacity: 0.82,
};

const outingBadge: React.CSSProperties = {
background: "#ede9fe",
color: "#6d28d9",
borderRadius: 999,
padding: "4px 8px",
fontSize: 11,
fontWeight: 700,
};

const tableWrap: React.CSSProperties = {
overflowX: "auto",
border: "1px solid #e5e7eb",
borderRadius: 16,
background: "white",
};

const tableStyle: React.CSSProperties = {
width: "100%",
borderCollapse: "collapse",
minWidth: 860,
};

const thStyle: React.CSSProperties = {
textAlign: "left",
padding: "12px 14px",
borderBottom: "1px solid #e5e7eb",
background: "#f8fafc",
fontSize: 14,
};

const tdStyle: React.CSSProperties = {
padding: "12px 14px",
borderBottom: "1px solid #f1f5f9",
fontSize: 14,
};


const editBtn: React.CSSProperties = {
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
    };

const smallDeleteBtn: React.CSSProperties = {
background: "#fee2e2",
color: "#dc2626",
border: "none",
borderRadius: 10,
padding: "8px 12px",
fontWeight: 700,
cursor: "pointer",
};

const errorCard: React.CSSProperties = {
marginBottom: 18,
background: "#fef2f2",
border: "1px solid #fecaca",
color: "#991b1b",
padding: 14,
borderRadius: 14,
};

const emptyState: React.CSSProperties = {
minHeight: 160,
border: "1px dashed #cbd5e1",
borderRadius: 16,
display: "flex",
justifyContent: "center",
alignItems: "center",
background: "#f8fafc",
fontWeight: 600,
};
