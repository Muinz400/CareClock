"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../supabaseClient";
import ShiftCard from "../../components/ShiftCard";
import WeeklySchedule from "../../components/WeeklySchedule";
import type { Schedule } from "@/components/WeeklySchedule";

type ProfileRow = {
id: string;
org_id: string;
role: string;
};

type Employee = {
id: string;
name: string;
};

function SchedulingPageContent() {
const router = useRouter();
const searchParams = useSearchParams();
const editId = searchParams.get("edit");

const [authReady, setAuthReady] = useState(false);
const [orgId, setOrgId] = useState<string | null>(null);

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

async function checkAdminAndLoadData() {
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

setOrgId(adminProfile.org_id);
setAuthReady(true);

await Promise.all([
loadEmployees(adminProfile.org_id),
loadSchedules(adminProfile.org_id),
]);

setLoading(false);
}

async function loadEmployees(activeOrgId: string) {
const { data, error } = await supabase
.from("employees")
.select("id, name")
.eq("org_id", activeOrgId)
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

async function loadSchedules(activeOrgId: string) {
const { data, error } = await supabase
.from("schedules")
.select("*")
.eq("org_id", activeOrgId)
.order("work_date", { ascending: false });

if (error) {
setError(error.message);
return;
}

setSchedules((data ?? []) as Schedule[]);
}

function handleEditShift(shift: Schedule) {
setEditingId(shift.id);
setEmployeeId(shift.employee_id);
setHouseName(shift.house_name ?? "");
setWorkDate(shift.work_date);
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

function handleAddShiftFromCalendar(house: string, day: string) {
setHouseName(house);

const date = new Date();
const targetDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
day
);

const diff = targetDay - date.getDay();
date.setDate(date.getDate() + diff);

const localDate = new Intl.DateTimeFormat("en-CA", {
timeZone: "America/Los_Angeles",
year: "numeric",
month: "2-digit",
day: "2-digit",
}).format(date);

setWorkDate(localDate);

window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveSchedule(e: React.FormEvent) {
e.preventDefault();
setError(null);

if (!orgId) {
setError("Admin organization not loaded.");
return;
}

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
const { error } = await supabase
.from("schedules")
.update(payload)
.eq("id", editingId);

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
await loadSchedules(orgId);
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

if (orgId) {
await loadSchedules(orgId);
}
}

async function handleSignOut() {
await supabase.auth.signOut();
router.push("/login");
}

useEffect(() => {
void checkAdminAndLoadData();
}, []);

useEffect(() => {
if (!editId || schedules.length === 0) return;

const shiftToEdit = schedules.find((s) => s.id === editId);
if (shiftToEdit) {
handleEditShift(shiftToEdit);
}
}, [editId, schedules]);

const selectedEmployeeName =
employees.find((emp) => emp.id === employeeId)?.name ?? "None selected";

const upcomingCount = useMemo(() => schedules.length, [schedules]);

const filteredEmployeeOptions = useMemo(() => {
return employees.filter((emp) =>
emp.name.toLowerCase().includes(shiftSearch.toLowerCase())
);
}, [employees, shiftSearch]);

const visibleSchedules = useMemo(() => {
if (selectedShiftEmployeeId === "all") return schedules;
return schedules.filter((s) => s.employee_id === selectedShiftEmployeeId);
}, [schedules, selectedShiftEmployeeId]);

if (!authReady && loading) {
return (
<main style={pageStyle}>
<p>Loading scheduling...</p>
</main>
);
}

return (
<main style={pageStyle}>
<div style={headerRow}>
<div>
<h1 style={{ margin: 0, fontSize: 36 }}>Scheduling</h1>
<p style={subText}>
Create, edit, and review employee shifts in one place.
</p>
</div>

<button onClick={handleSignOut} style={signOutBtn}>
Sign Out
</button>
</div>

{error && (
<div style={errorCard}>
<strong style={{ display: "block", marginBottom: 4 }}>
Something went wrong
</strong>
<span>{error}</span>
</div>
)}

<div style={statsRow}>
<div style={statCard}>
<div style={statLabel}>Employees</div>
<div style={statValue}>{employees.length}</div>
</div>

<div style={statCard}>
<div style={statLabel}>Scheduled Shifts</div>
<div style={statValue}>{upcomingCount}</div>
</div>

<div style={statCard}>
<div style={statLabel}>Selected Employee</div>
<div style={statValueSmall}>{selectedEmployeeName}</div>
</div>
</div>

<div style={gridWrap}>
<section style={panelStyle}>
<div style={panelHeader}>
<div>
<h2 style={panelTitle}>{editingId ? "Edit Shift" : "Create Shift"}</h2>
<p style={panelSub}>Build a cleaner weekly plan for your team.</p>
</div>

{editingId && <span style={editingBadge}>Editing</span>}
</div>

<form onSubmit={saveSchedule} style={formGrid}>
<div>
<label style={labelStyle}>Employee</label>
<select
value={employeeId}
onChange={(e) => setEmployeeId(e.target.value)}
style={inputStyle}
>
<option value="">Select employee</option>
{employees.map((emp) => (
<option key={emp.id} value={emp.id}>
{emp.name}
</option>
))}
</select>
</div>

<div>
<label style={labelStyle}>House</label>
<input
type="text"
placeholder="Ex: Maple House"
value={houseName}
onChange={(e) => setHouseName(e.target.value)}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>Work Date</label>
<input
type="date"
value={workDate}
onChange={(e) => setWorkDate(e.target.value)}
style={inputStyle}
/>
</div>

<div style={twoCol}>
<div>
<label style={labelStyle}>Start Time</label>
<input
type="time"
value={startTime}
onChange={(e) => setStartTime(e.target.value)}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>End Time</label>
<input
type="time"
value={endTime}
onChange={(e) => setEndTime(e.target.value)}
style={inputStyle}
/>
</div>
</div>

<div>
<label style={labelStyle}>Mileage</label>
<input
type="number"
placeholder="Leave blank if none"
value={mileage}
onChange={(e) => setMileage(e.target.value)}
style={inputStyle}
/>
</div>

<label style={checkboxRow}>
<input
type="checkbox"
checked={isOuting}
onChange={(e) => setIsOuting(e.target.checked)}
/>
<span>Mark as outing</span>
</label>

<div>
<label style={labelStyle}>Daily Log</label>
<textarea
placeholder="Add context for the shift, tasks, notes, or reminders"
value={dailyLog}
onChange={(e) => setDailyLog(e.target.value)}
rows={5}
style={textareaStyle}
/>
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button type="submit" style={primaryBtn}>
{saving ? "Saving..." : editingId ? "Save Changes" : "Create Shift"}
</button>

{editingId && (
<button type="button" onClick={resetForm} style={secondaryBtnStyle}>
Cancel Edit
</button>
)}
</div>
</form>
</section>

<section style={panelStyle}>
<div style={panelHeader}>
<div>
<h2 style={panelTitle}>Scheduled Shifts</h2>
<p style={panelSub}>Review and manage upcoming assignments.</p>
</div>
</div>

<div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
<div>
<label style={labelStyle}>Search Employee</label>
<input
type="text"
placeholder="Type employee name..."
value={shiftSearch}
onChange={(e) => setShiftSearch(e.target.value)}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>Filter Scheduled Shifts</label>
<select
value={selectedShiftEmployeeId}
onChange={(e) => setSelectedShiftEmployeeId(e.target.value)}
style={inputStyle}
>
<option value="all">All Employees</option>
{filteredEmployeeOptions.map((emp) => (
<option key={emp.id} value={emp.id}>
{emp.name}
</option>
))}
</select>
</div>
</div>

{visibleSchedules.length === 0 ? (
<div style={emptyState}>
<div style={{ fontSize: 30 }}>📅</div>
<p style={{ margin: 0, fontWeight: 600 }}>No scheduled shifts found</p>
<p style={{ margin: 0, opacity: 0.7 }}>
Try another employee or create a new shift.
</p>
</div>
) : (
<div style={{ display: "grid", gap: 12 }}>
{visibleSchedules.map((s) => {
const employee = employees.find((e) => e.id === s.employee_id);

return (
<ShiftCard
key={s.id}
shift={s}
employee={employee}
onEdit={() => handleEditShift(s)}
onDelete={() => deleteShift(s.id)}
/>
);
})}
</div>
)}
</section>
</div>

<div style={{ marginTop: 24 }}>
<WeeklySchedule
schedules={schedules}
employees={employees}
onAddShift={handleAddShiftFromCalendar}
onEditShift={handleEditShift}
/>
</div>
</main>
);
}

const pageStyle: React.CSSProperties = {
maxWidth: 1200,
margin: "40px auto",
padding: 20,
};

const headerRow: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
gap: 16,
flexWrap: "wrap",
marginBottom: 24,
};

const subText: React.CSSProperties = {
marginTop: 8,
opacity: 0.72,
fontSize: 15,
};

const signOutBtn: React.CSSProperties = {
padding: "10px 16px",
background: "#111827",
color: "white",
border: "none",
borderRadius: 10,
fontWeight: 600,
cursor: "pointer",
};

const statsRow: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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

const statValue: React.CSSProperties = {
fontSize: 30,
fontWeight: 700,
};

const statValueSmall: React.CSSProperties = {
fontSize: 18,
fontWeight: 700,
};

const gridWrap: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "minmax(340px, 460px) 1fr",
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

const editingBadge: React.CSSProperties = {
background: "#dbeafe",
color: "#1d4ed8",
padding: "6px 10px",
borderRadius: 999,
fontSize: 12,
fontWeight: 700,
};

const formGrid: React.CSSProperties = {
display: "grid",
gap: 14,
};

const twoCol: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "1fr 1fr",
gap: 12,
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

const textareaStyle: React.CSSProperties = {
width: "100%",
padding: "12px 14px",
border: "1px solid #d1d5db",
borderRadius: 12,
background: "#fff",
fontSize: 14,
resize: "vertical",
};

const checkboxRow: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 10,
fontSize: 14,
fontWeight: 500,
};

const primaryBtn: React.CSSProperties = {
background: "#2563eb",
color: "white",
border: "none",
padding: "10px 16px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 700,
};

const secondaryBtnStyle: React.CSSProperties = {
background: "#e5e7eb",
color: "#111827",
border: "none",
padding: "10px 16px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 600,
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
minHeight: 220,
border: "1px dashed #cbd5e1",
borderRadius: 16,
display: "flex",
flexDirection: "column",
justifyContent: "center",
alignItems: "center",
gap: 8,
background: "#f8fafc",
};

export default function SchedulingPage() {
    return (
    <Suspense fallback={<main style={pageStyle}><p>Loading scheduling...</p></main>}>
    <SchedulingPageContent />
    </Suspense>
    );
    }