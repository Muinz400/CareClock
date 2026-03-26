"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../supabaseClient";
import React from "react";
import { formatAppDateTime } from "../../../../lib/time";

type ProfileRow = {
id: string;
org_id: string;
role: string;
};

type EmployeeRow = {
id: string;
user_id: string | null;
org_id: string;
name: string;
email: string;
hourly_rate: number | null;
};

type ClockLogRow = {
id: string;
employee_id: string;
clock_in: string | null;
clock_out: string | null;
latitude: number | null;
longitude: number | null;
created_at: string | null;
};

function formatClockDate(value: string | null) {
    if (!value) return "—";
    
    const date = new Date(value);
    
    if (Number.isNaN(date.getTime())) return "—";
    
    return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    });
    }
    
    function getClockDateLabel(value: string | null) {
    return formatClockDate(value);
    }

export default function TimesheetsPage() {
const router = useRouter();

const [authReady, setAuthReady] = useState(false);
const [adminOrgId, setAdminOrgId] = useState<string | null>(null);

const [employees, setEmployees] = useState<EmployeeRow[]>([]);
const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

const [logs, setLogs] = useState<ClockLogRow[]>([]);
const [loadingEmployees, setLoadingEmployees] = useState(true);
const [loadingLogs, setLoadingLogs] = useState(false);
const [error, setError] = useState<string | null>(null);

async function checkAdminAndLoadEmployees() {
setLoadingEmployees(true);
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

setAdminOrgId(adminProfile.org_id);
setAuthReady(true);

const { data: employeeRows, error: employeesError } = await supabase
.from("employees")
.select("id, user_id, org_id, name, email, hourly_rate")
.eq("org_id", adminProfile.org_id)
.order("name", { ascending: true });

if (employeesError) {
setError(employeesError.message);
setLoadingEmployees(false);
return;
}

const employeeList = (employeeRows ?? []) as EmployeeRow[];
setEmployees(employeeList);

if (employeeList.length > 0) {
setSelectedEmployeeId(employeeList[0].id);
}

setLoadingEmployees(false);
}

async function loadLogs(employeeId: string) {
if (!employeeId) {
setLogs([]);
return;
}

setLoadingLogs(true);
setError(null);

const { data, error } = await supabase
.from("clock_logs")
.select(
"id, employee_id, clock_in, clock_out, latitude, longitude, created_at"
)
.eq("employee_id", employeeId)
.order("clock_in", { ascending: false });

if (error) {
setError(error.message);
setLoadingLogs(false);
return;
}

setLogs((data ?? []) as ClockLogRow[]);
setLoadingLogs(false);
}

useEffect(() => {
void checkAdminAndLoadEmployees();
}, []);

useEffect(() => {
if (selectedEmployeeId) {
void loadLogs(selectedEmployeeId);
}
}, [selectedEmployeeId]);

const selectedEmployee =
employees.find((emp) => emp.id === selectedEmployeeId) ?? null;

const totalHours = useMemo(() => {
return logs.reduce((sum, log) => {
if (!log.clock_in || !log.clock_out) return sum;

const start = new Date(log.clock_in).getTime();
const end = new Date(log.clock_out).getTime();

if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;

return sum + (end - start) / (1000 * 60 * 60);
}, 0);
}, [logs]);

const groupedLogs = useMemo(() => {
const groups: Record<string, ClockLogRow[]> = {};

for (const log of logs) {
const key = getAppDateLabel(log.clock_in);

if (!groups[key]) {
groups[key] = [];
}

groups[key].push(log);
}

return Object.entries(groups);
}, [logs]);

function getHoursNumber(clockIn: string | null, clockOut: string | null) {
if (!clockIn || !clockOut) return null;

const start = new Date(clockIn).getTime();
const end = new Date(clockOut).getTime();

if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

return (end - start) / (1000 * 60 * 60);
}

function formatHoursDetailed(clockIn: string | null, clockOut: string | null) {
if (!clockIn) return "—";
if (!clockOut) return "Active";

const hours = getHoursNumber(clockIn, clockOut);
if (hours == null) return "—";

const totalMinutes = Math.round(hours * 60);

return `${hours.toFixed(2)} hrs (${totalMinutes} min)`;
}

function getAppDateLabel(value: string | null) {
    return getClockDateLabel(value);
    }

function formatHours(clockIn: string | null, clockOut: string | null) {
if (!clockIn) return "—";
if (!clockOut) return "Active";

const start = new Date(clockIn).getTime();
const end = new Date(clockOut).getTime();

if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "—";

const hours = (end - start) / (1000 * 60 * 60);
return hours.toFixed(2);
}

if (!authReady && loadingEmployees) {
return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<p>Loading timesheets...</p>
</main>
);
}

return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<h1 style={{ marginBottom: 8 }}>Timesheets</h1>
<p style={{ opacity: 0.75, marginBottom: 20 }}>
Review employee shifts and worked hours.
</p>

<div style={controlsWrap}>
<div>
<label style={labelStyle}>Employee</label>
<select
value={selectedEmployeeId}
onChange={(e) => setSelectedEmployeeId(e.target.value)}
style={selectStyle}
>
{employees.length === 0 ? (
<option value="">No employees found</option>
) : (
employees.map((employee) => (
<option key={employee.id} value={employee.id}>
{employee.name}
</option>
))
)}
</select>
</div>
</div>

{selectedEmployee && (
<div style={summaryRow}>
<div style={summaryCard}>
<div style={summaryLabel}>Employee</div>
<div style={summaryValueSmall}>{selectedEmployee.name}</div>
</div>

<div style={summaryCard}>
<div style={summaryLabel}>Email</div>
<div style={summaryValueSmall}>{selectedEmployee.email}</div>
</div>

<div style={summaryCard}>
<div style={summaryLabel}>Total Logged Hours</div>
<div style={summaryValue}>{totalHours.toFixed(2)} hrs</div>
</div>
<div style={{ fontSize: 13, opacity: 0.7 }}>
{Math.round(totalHours * 60)} total minutes
</div>
</div>
)}

{error && (
<p style={{ color: "crimson", marginTop: 16, marginBottom: 16 }}>
Error: {error}
</p>
)}

{loadingLogs ? (
<p style={{ marginTop: 16 }}>Loading logs...</p>
) : logs.length === 0 ? (
<p style={{ marginTop: 16 }}>No time records found yet.</p>
) : (
<div style={tableWrap}>
<table style={tableStyle}>
<thead>
<tr>
<th style={thStyle}>Date</th>
<th style={thStyle}>Clock In</th>
<th style={thStyle}>Clock Out</th>
<th style={thStyle}>Hours</th>
<th style={thStyle}>Location</th>
</tr>
</thead>
<tbody>
{groupedLogs.map(([groupLabel, dayLogs]) => (
<React.Fragment key={groupLabel}>
<tr>
<td
colSpan={5}
style={{
padding: "12px 14px",
background: "#f8fafc",
fontWeight: 700,
borderBottom: "1px solid #e5e7eb",
}}
>
{groupLabel}
</td>
</tr>

{dayLogs.map((log) => (
<tr key={log.id}>
<td style={tdStyle}>{formatClockDate(log.clock_in)}</td>
<td style={tdStyle}>
{formatAppDateTime(log.clock_in)}
</td>
<td style={tdStyle}>
{formatAppDateTime(log.clock_out)}
</td>
<td style={tdStyle}>
{formatHoursDetailed(log.clock_in, log.clock_out)}
</td>
<td style={tdStyle}>
{log.latitude != null && log.longitude != null
? `${Number(log.latitude).toFixed(5)}, ${Number(
log.longitude
).toFixed(5)}`
: "—"}
</td>
</tr>
))}
</React.Fragment>
))}
</tbody>
</table>
</div>
)}
</main>
);
}

const controlsWrap: React.CSSProperties = {
display: "flex",
gap: 16,
marginBottom: 20,
flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
display: "block",
fontSize: 13,
fontWeight: 600,
marginBottom: 8,
};

const selectStyle: React.CSSProperties = {
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 8,
minWidth: 240,
background: "white",
};

const summaryRow: React.CSSProperties = {
display: "flex",
gap: 16,
flexWrap: "wrap",
marginBottom: 20,
};

const summaryCard: React.CSSProperties = {
background: "white",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 16,
minWidth: 220,
};

const summaryLabel: React.CSSProperties = {
fontSize: 12,
opacity: 0.7,
marginBottom: 8,
};

const summaryValue: React.CSSProperties = {
fontSize: 28,
fontWeight: 700,
};

const summaryValueSmall: React.CSSProperties = {
fontSize: 16,
fontWeight: 600,
};

const tableWrap: React.CSSProperties = {
marginTop: 20,
overflowX: "auto",
background: "white",
border: "1px solid #e5e7eb",
borderRadius: 12,
};

const tableStyle: React.CSSProperties = {
width: "100%",
borderCollapse: "collapse",
minWidth: 760,
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
