"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { formatAppDateTime, formatAppDate } from "../../../lib/time";

type Employee = {
id: string;
user_id: string | null;
name: string;
email: string;
};

type ClockLog = {
id: string;
employee_id: string;
clock_in: string | null;
clock_out: string | null;
latitude: number | null;
longitude: number | null;
};

type EmployeeDashboardRow = {
employee: Employee;
latestLog: ClockLog | null;
status: "Clocked In" | "Clocked Out" | "No Activity";
houseName: string | null;
};



function calculateHours(clockIn: string | null, clockOut: string | null) {
if (!clockIn || !clockOut) return "-";

const start = new Date(clockIn);
const end = new Date(clockOut);

const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

return diff.toFixed(2);
}

export default function AdminPage() {
const router = useRouter();

const [rows, setRows] = useState<EmployeeDashboardRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [newEmployeeName, setNewEmployeeName] = useState("");
const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
const [newEmployeeRate, setNewEmployeeRate] = useState("");
const [adminOrgId, setAdminOrgId] = useState<string | null>(null);

useEffect(() => {
async function checkAdmin() {
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
.select("role, org_id")
.eq("id", user.id)
.single();

if (profileError || !profile) {
router.push("/login");
return;
}

setAdminOrgId(profile.org_id);

if (profile.role !== "admin") {
router.push("/employee/clock");
}
}

checkAdmin();
}, [router]);

async function handleSignOut() {
await supabase.auth.signOut();
router.push("/login");
}

async function loadDashboard() {
setLoading(true);
setError("");

try {
const { data: employees, error: employeesError } = await supabase
.from("employees")
.select("id, user_id, name, email")
.order("name", { ascending: true });

if (employeesError) {
throw employeesError;
}

const employeeList = (employees ?? []) as Employee[];
const results: EmployeeDashboardRow[] = [];

for (const employee of employeeList) {
const { data: latestLog, error: logError } = await supabase
.from("clock_logs")
.select("id, employee_id, clock_in, clock_out, latitude, longitude")
.eq("employee_id", employee.id)
.order("clock_in", { ascending: false })
.limit(1)
.maybeSingle();

if (logError) {
throw logError;
}

let status: "Clocked In" | "Clocked Out" | "No Activity" = "No Activity";

if (latestLog) {
status =
latestLog.clock_in && !latestLog.clock_out
? "Clocked In"
: "Clocked Out";
}

results.push({
employee,
latestLog: (latestLog as ClockLog | null) ?? null,
status,
houseName: "Main House",
});
}

setRows(results);
} catch (err: any) {
console.error(err);
setError(err.message ?? "Failed to load admin dashboard.");
} finally {
setLoading(false);
}
}

useEffect(() => {
let mounted = true;

const refresh = async () => {
if (!mounted) return;
await loadDashboard();
};

refresh();

const interval = setInterval(() => {
refresh();
}, 10000);

const channel = supabase
.channel("admin-clock-live")
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "clock_logs",
},
async () => {
await refresh();
}
)
.subscribe();

return () => {
mounted = false;
clearInterval(interval);
supabase.removeChannel(channel);
};
}, []);

async function handleAddEmployee(e: React.FormEvent) {
e.preventDefault();

if (!adminOrgId) {
alert("Admin org not loaded yet.");
return;
}

if (!newEmployeeName || !newEmployeeEmail || !newEmployeeRate) {
alert("Please fill out all employee fields.");
return;
}

const hourlyRateNumber = Number(newEmployeeRate);

if (Number.isNaN(hourlyRateNumber)) {
alert("Hourly rate must be a number.");
return;
}

const response = await fetch("/api/create-employee", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
name: newEmployeeName,
email: newEmployeeEmail,
hourlyRate: hourlyRateNumber,
orgId: adminOrgId,
}),
});

const result = await response.json();

if (!response.ok) {
alert(result.error || "Failed to create employee.");
return;
}

setNewEmployeeName("");
setNewEmployeeEmail("");
setNewEmployeeRate("");

alert(
`Employee created successfully. Temporary password: ${result.temporaryPassword}`
);

loadDashboard();
}

return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 8,
gap: 12,
flexWrap: "wrap",
}}
>
<h1 style={{ margin: 0 }}>Admin Dashboard</h1>

<button
onClick={handleSignOut}
style={{
padding: "10px 14px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
}}
>
Sign Out
</button>
</div>

<p style={{ marginTop: 0, opacity: 0.75 }}>
Live employee clock activity and latest timesheet status.
</p>

<p style={{ opacity: 0.65, marginTop: -4, marginBottom: 20 }}>
Auto-refreshing every 10 seconds
</p>

<div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
<button style={navBtnStyle} onClick={() => router.push("/admin/employees")}>
Employees
</button>

<button style={navBtnStyle} onClick={() => router.push("/timesheets")}>
Timesheets
</button>

<button style={navBtnStyle} onClick={() => router.push("/payroll")}>
Payroll
</button>

<button style={navBtnStyle} onClick={() => router.push("/scheduling")}>
Scheduling
</button>

<button style={navBtnStyle} onClick={() => router.push("/admin/shifts")}>
Shifts
</button>
</div>


<div
style={{
marginBottom: 24,
padding: 16,
border: "1px solid #e5e7eb",
borderRadius: 12,
background: "white",
}}
>
<h3 style={{ marginTop: 0 }}>Add Employee</h3>

<form
onSubmit={handleAddEmployee}
style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}
>
<input
type="text"
placeholder="Employee name"
value={newEmployeeName}
onChange={(e) => setNewEmployeeName(e.target.value)}
style={inputStyle}
/>

<input
type="email"
placeholder="Employee email"
value={newEmployeeEmail}
onChange={(e) => setNewEmployeeEmail(e.target.value)}
style={{ ...inputStyle, minWidth: 220 }}
/>

<input
type="number"
step="0.01"
placeholder="Hourly rate"
value={newEmployeeRate}
onChange={(e) => setNewEmployeeRate(e.target.value)}
style={{ ...inputStyle, minWidth: 140 }}
/>

<button
type="submit"
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
}}
>
Add Employee
</button>
</form>
</div>

<div style={{ margin: "20px 0" }}>
<button
onClick={loadDashboard}
style={{
padding: "10px 16px",
background: "#2563eb",
color: "white",
border: "none",
borderRadius: 8,
cursor: "pointer",
fontWeight: 600,
}}
>
Refresh Dashboard
</button>
</div>

{loading && <p>Loading dashboard...</p>}

{error && <p style={{ color: "crimson", marginBottom: 16 }}>{error}</p>}

{!loading && !error && rows.length === 0 && <p>No employees found.</p>}

{!loading && !error && rows.length > 0 && (
<div
style={{
overflowX: "auto",
border: "1px solid #e5e7eb",
borderRadius: 12,
background: "white",
}}
>
<table
style={{
width: "100%",
borderCollapse: "collapse",
minWidth: 900,
}}
>
<thead style={{ background: "#f8fafc" }}>
<tr>
<th style={thStyle}>Employee</th>
<th style={thStyle}>Email</th>
<th style={thStyle}>House</th>
<th style={thStyle}>Status</th>
<th style={thStyle}>Last Clock In</th>
<th style={thStyle}>Last Clock Out</th>
<th style={thStyle}>Hours</th>
<th style={thStyle}>Latitude</th>
<th style={thStyle}>Longitude</th>
</tr>
</thead>

<tbody>
{rows.map((row) => (
<tr key={row.employee.id}>
<td style={tdStyle}>{row.employee.name}</td>
<td style={tdStyle}>{row.employee.email}</td>
<td style={tdStyle}>{row.houseName || "-"}</td>
<td style={tdStyle}>
<span
style={{
display: "inline-block",
padding: "6px 10px",
borderRadius: 999,
fontWeight: 600,
background:
row.status === "Clocked In"
? "#dcfce7"
: row.status === "Clocked Out"
? "#e5e7eb"
: "#fef3c7",
color:
row.status === "Clocked In"
? "#166534"
: row.status === "Clocked Out"
? "#111827"
: "#92400e",
}}
>
{row.status}
</span>
</td>

<td style={tdStyle}>
{formatAppDateTime(row.latestLog?.clock_in ?? null)}
</td>

<td style={tdStyle}>
{formatAppDateTime(row.latestLog?.clock_out ?? null)}
</td>

<td style={tdStyle}>
{calculateHours(
row.latestLog?.clock_in ?? null,
row.latestLog?.clock_out ?? null
)}
</td>

<td style={tdStyle}>{row.latestLog?.latitude ?? "-"}</td>
<td style={tdStyle}>{row.latestLog?.longitude ?? "-"}</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</main>
);
}

const navBtnStyle: React.CSSProperties = {
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14,
};

const inputStyle: React.CSSProperties = {
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 8,
minWidth: 180,
};

const thStyle: React.CSSProperties = {
textAlign: "left",
padding: "14px 16px",
fontSize: 14,
borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
padding: "14px 16px",
borderBottom: "1px solid #e5e7eb",
fontSize: 14,
};

