"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../supabaseClient";
import { formatAppDateTime } from "../../../lib/time";

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

export default function EmployeeTimesheetsPage() {
const router = useRouter();

const [authReady, setAuthReady] = useState(false);
const [employee, setEmployee] = useState<EmployeeRow | null>(null);
const [logs, setLogs] = useState<ClockLogRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

async function loadEmployeeTimesheets() {
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
.select("id, role")
.eq("id", user.id)
.single();

if (profileError || !profile) {
router.push("/login");
return;
}

if (profile.role !== "employee") {
router.push("/admin");
return;
}

const { data: employeeRow, error: employeeError } = await supabase
.from("employees")
.select("id, user_id, org_id, name, email, hourly_rate")
.eq("user_id", user.id)
.single();

if (employeeError || !employeeRow) {
setError("Employee record not found.");
setLoading(false);
setAuthReady(true);
return;
}

setEmployee(employeeRow as EmployeeRow);

const { data: logRows, error: logsError } = await supabase
.from("clock_logs")
.select("id, employee_id, clock_in, clock_out, latitude, longitude, created_at")
.eq("employee_id", employeeRow.id)
.order("clock_in", { ascending: false });

if (logsError) {
setError(logsError.message);
setLoading(false);
setAuthReady(true);
return;
}

setLogs((logRows ?? []) as ClockLogRow[]);
setLoading(false);
setAuthReady(true);
}

useEffect(() => {
void loadEmployeeTimesheets();
}, []);

const totalHours = useMemo(() => {
return logs.reduce((sum, log) => {
if (!log.clock_in || !log.clock_out) return sum;

const start = new Date(log.clock_in).getTime();
const end = new Date(log.clock_out).getTime();

if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;

return sum + (end - start) / (1000 * 60 * 60);
}, 0);
}, [logs]);



function formatHours(clockIn: string | null, clockOut: string | null) {
if (!clockIn) return "—";
if (!clockOut) return "Active";

const start = new Date(clockIn).getTime();
const end = new Date(clockOut).getTime();

if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "—";

const hours = (end - start) / (1000 * 60 * 60);
return hours.toFixed(2);
}

async function handleSignOut() {
await supabase.auth.signOut();
router.push("/login");
}

if (!authReady && loading) {
return (
<main style={{ maxWidth: 1100, margin: "40px auto", padding: 20 }}>
<p>Loading timesheets...</p>
</main>
);
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
<h1 style={{ margin: 0 }}>My Timesheets</h1>

<button
onClick={handleSignOut}
style={{
padding: "8px 14px",
background: "#111",
color: "white",
border: "none",
borderRadius: 8,
fontWeight: 600,
cursor: "pointer",
fontSize: 13,
}}
>
Sign Out
</button>
</div>

<p style={{ opacity: 0.75, marginBottom: 20 }}>
Review your worked hours from clock logs.
</p>

{employee && (
<div style={summaryRow}>
<div style={summaryCard}>
<div style={summaryLabel}>Employee</div>
<div style={summaryValueSmall}>{employee.name}</div>
</div>

<div style={summaryCard}>
<div style={summaryLabel}>Email</div>
<div style={summaryValueSmall}>{employee.email}</div>
</div>

<div style={summaryCard}>
<div style={summaryLabel}>Total Logged Hours</div>
<div style={summaryValue}>{totalHours.toFixed(2)} hrs</div>
</div>
</div>
)}

{error && (
<p style={{ color: "crimson", marginTop: 16, marginBottom: 16 }}>
Error: {error}
</p>
)}

{loading ? (
<p style={{ marginTop: 16 }}>Loading...</p>
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
{logs.map((log) => {
const dateLabel = formatClockDate(log.clock_in);


return (
<tr key={log.id}>
<td style={tdStyle}>{dateLabel}</td>
<td style={tdStyle}>{formatAppDateTime(log.clock_in)}</td>
<td style={tdStyle}>{formatAppDateTime(log.clock_out)}</td>
<td style={tdStyle}>{formatHours(log.clock_in, log.clock_out)}</td>
<td style={tdStyle}>
{log.latitude != null && log.longitude != null
? `${Number(log.latitude).toFixed(5)}, ${Number(log.longitude).toFixed(5)}`
: "—"}
</td>
</tr>
);
})}
</tbody>
</table>
</div>
)}
</main>
);
}

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
