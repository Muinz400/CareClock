"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

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
};

function formatDateTime(value: string | null) {
if (!value) return "—";

return new Date(value).toLocaleString("en-US", {
month: "short",
day: "numeric",
year: "numeric",
hour: "numeric",
minute: "2-digit",
});
}

export default function AdminPage() {
const [rows, setRows] = useState<EmployeeDashboardRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const router = useRouter();

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
.select("role")
.eq("id", user.id)
.single();

if (profileError || !profile) {
router.push("/login");
return;
}

if (profile.role !== "admin") {
router.push("/employee/clock");
return;
}
}

checkAdmin();
}, [router]);




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
status = latestLog.clock_in && !latestLog.clock_out
? "Clocked In"
: "Clocked Out";
}

results.push({
employee,
latestLog: (latestLog as ClockLog | null) ?? null,
status,
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
loadDashboard();
}, []);

return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<h1 style={{ marginBottom: 8 }}>Admin Dashboard</h1>
<p style={{ marginTop: 0, opacity: 0.75 }}>
Live employee clock activity and latest timesheet status.
</p>
<div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
{[
["Employees", "/employees"],
["Timesheets", "/timesheets"],
["Payroll", "/payroll"],
["Scheduling", "/scheduling"],
["Clients", "/clients"],
["Houses", "/houses"],
].map(([label, href]) => (
<a key={href} href={href}>
<button
style={{
padding: "8px 14px",
borderRadius: 6,
border: "1px solid #ddd",
background: "#f9f9f9",
cursor: "pointer",
fontWeight: 500,
}}
>
{label}
</button>
</a>
))}
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

{error && (
<p style={{ color: "crimson", marginBottom: 16 }}>
{error}
</p>
)}

{!loading && !error && rows.length === 0 && (
<p>No employees found.</p>
)}

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
<th style={thStyle}>Status</th>
<th style={thStyle}>Last Clock In</th>
<th style={thStyle}>Last Clock Out</th>
<th style={thStyle}>Latitude</th>
<th style={thStyle}>Longitude</th>
</tr>
</thead>
<tbody>
{rows.map((row) => (
<tr key={row.employee.id}>
<td style={tdStyle}>{row.employee.name}</td>
<td style={tdStyle}>{row.employee.email}</td>
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
{formatDateTime(row.latestLog?.clock_in ?? null)}
</td>
<td style={tdStyle}>
{formatDateTime(row.latestLog?.clock_out ?? null)}
</td>
<td style={tdStyle}>
{row.latestLog?.latitude ?? "—"}
</td>
<td style={tdStyle}>
{row.latestLog?.longitude ?? "—"}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</main>
);
}

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
