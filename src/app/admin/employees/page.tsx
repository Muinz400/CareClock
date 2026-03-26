"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../supabaseClient";
import { formatAppDateTime } from "../../../lib/time";

type Employee = {
id: string;
name: string;
email: string;
};

type ClockLog = {
id: string;
employee_id: string;
clock_in: string | null;
clock_out: string | null;
};

export default function AdminEmployeesPage() {
const router = useRouter();

const [employees, setEmployees] = useState<Employee[]>([]);
const [clockLogs, setClockLogs] = useState<ClockLog[]>([]);
const [loading, setLoading] = useState(true);

async function loadData() {
setLoading(true);

// Get employees
const { data: employeeRows } = await supabase
.from("employees")
.select("id, name, email")
.order("name");

// Get latest clock logs
const { data: logRows } = await supabase
.from("clock_logs")
.select("*")
.order("created_at", { ascending: false });

setEmployees((employeeRows ?? []) as Employee[]);
setClockLogs((logRows ?? []) as ClockLog[]);

setLoading(false);
}

useEffect(() => {
loadData();
}, []);

function getLatestLog(employeeId: string) {
return clockLogs.find((log) => log.employee_id === employeeId);
}

function getStatus(employeeId: string) {
const log = getLatestLog(employeeId);

if (!log) return "No Activity";
if (log.clock_in && !log.clock_out) return "Clocked In";
if (log.clock_out) return "Clocked Out";

return "—";
}

async function adminClockIn(employeeId: string) {
await supabase.from("clock_logs").insert([
{
employee_id: employeeId,
clock_in: new Date().toISOString(),
entered_by_admin: true,
},
]);

loadData();
}

async function adminClockOut(employeeId: string) {
const openLog = clockLogs.find(
(log) =>
log.employee_id === employeeId &&
log.clock_in &&
!log.clock_out
);

if (!openLog) {
alert("No active shift found.");
return;
}

await supabase
.from("clock_logs")
.update({
clock_out: new Date().toISOString(),
entered_by_admin: true,
})
.eq("id", openLog.id);

loadData();
}

if (loading) {
return <p style={{ padding: 20 }}>Loading employees...</p>;
}

return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<h1>Admin Employees</h1>
<p style={{ opacity: 0.7 }}>
Manage employee activity, shifts, and clock logs.
</p>

<div style={tableWrap}>
<table style={tableStyle}>
<thead>
<tr>
<th style={th}>Name</th>
<th style={th}>Email</th>
<th style={th}>Status</th>
<th style={th}>Last Clock In</th>
<th style={th}>Last Clock Out</th>
<th style={th}>Actions</th>
</tr>
</thead>

<tbody>
{employees.map((emp) => {
const log = getLatestLog(emp.id);

return (
<tr key={emp.id}>
<td style={td}>{emp.name}</td>
<td style={td}>{emp.email}</td>
<td style={td}>{getStatus(emp.id)}</td>


<td style={td}>{formatAppDateTime(log?.clock_in ?? null)}</td>
<td style={td}>{formatAppDateTime(log?.clock_out ?? null)}</td>

<td style={td}>
<div style={{ display: "flex", gap: 6 }}>

<button
onClick={() => {
console.log("manage employee id:", emp.id);
router.push(`/admin/employees/${emp.id}`);
}}
style={btn}
>
Manage
</button>


<button
onClick={() => adminClockIn(emp.id)}
style={greenBtn}
>
Clock In
</button>

<button
onClick={() => adminClockOut(emp.id)}
style={redBtn}
>
Clock Out
</button>
</div>
</td>
</tr>
);
})}
</tbody>
</table>
</div>
</main>
);
}

const tableWrap: React.CSSProperties = {
marginTop: 20,
overflowX: "auto",
border: "1px solid #e5e7eb",
borderRadius: 12,
};

const tableStyle: React.CSSProperties = {
width: "100%",
borderCollapse: "collapse",
};

const th: React.CSSProperties = {
padding: 12,
borderBottom: "1px solid #e5e7eb",
background: "#f9fafb",
textAlign: "left",
};

const td: React.CSSProperties = {
padding: 12,
borderBottom: "1px solid #f1f5f9",
};

const btn: React.CSSProperties = {
padding: "6px 10px",
background: "#111",
color: "white",
border: "none",
borderRadius: 6,
cursor: "pointer",
};

const greenBtn: React.CSSProperties = {
padding: "6px 10px",
background: "#16a34a",
color: "white",
border: "none",
borderRadius: 6,
cursor: "pointer",
};

const redBtn: React.CSSProperties = {
padding: "6px 10px",
background: "#dc2626",
color: "white",
border: "none",
borderRadius: 6,
cursor: "pointer",
};
