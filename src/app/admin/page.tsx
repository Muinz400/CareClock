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
const [newEmployeeName, setNewEmployeeName] = useState("");
const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
const [newEmployeeRate, setNewEmployeeRate] = useState("");
const [adminOrgId, setAdminOrgId] = useState<string | null>(null);



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
    
    const { error } = await supabase.from("employees").insert([
    {
    org_id: adminOrgId,
    name: newEmployeeName,
    email: newEmployeeEmail,
    hourly_rate: hourlyRateNumber,
    user_id: null,
    },
    ]);
    
    if (error) {
    alert(error.message);
    return;
    }
    
    setNewEmployeeName("");
    setNewEmployeeEmail("");
    setNewEmployeeRate("");
    alert("Employee added successfully.");
    
    loadDashboard();
    }


return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<h1 style={{ marginBottom: 8 }}>Admin Dashboard</h1>
<p style={{ marginTop: 0, opacity: 0.75 }}>
Live employee clock activity and latest timesheet status.
</p>
<div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
<a href="/employees">
<button
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14
}}
>
Employees
</button>
</a>

<a href="/timesheets">
<button
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14
}}
>
Timesheets
</button>
</a>

<a href="/payroll">
<button
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14
}}
>
Payroll
</button>
</a>

<a href="/scheduling">
<button
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14
}}
>
Scheduling
</button>
</a>

<a href="/clients">
<button
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14
}}
>
Clients
</button>
</a>

<a href="/houses">
<button
style={{
padding: "12px 20px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 14
}}
>
Houses
</button>
</a>
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
style={{
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 8,
minWidth: 180,
}}
/>

<input
type="email"
placeholder="Employee email"
value={newEmployeeEmail}
onChange={(e) => setNewEmployeeEmail(e.target.value)}
style={{
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 8,
minWidth: 220,
}}
/>

<input
type="number"
step="0.01"
placeholder="Hourly rate"
value={newEmployeeRate}
onChange={(e) => setNewEmployeeRate(e.target.value)}
style={{
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 8,
minWidth: 140,
}}
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
