"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { formatAppDate, formatAppTimeRange } from "../../../lib/time";

type Employee = {
id: string;
name: string;
};

type Schedule = {
id: string;
employee_id: string;
house_name: string | null;
work_date: string;
start_time: string | null;
end_time: string | null;
mileage: number | null;
is_outing: boolean | null;
daily_log: string | null;
org_id: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulingPrintPage() {
const [employees, setEmployees] = useState<Employee[]>([]);
const [schedules, setSchedules] = useState<Schedule[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function loadData() {
const {
data: { user },
} = await supabase.auth.getUser();

if (!user) return;

const { data: profile } = await supabase
.from("profiles")
.select("org_id, role")
.eq("id", user.id)
.single();

if (!profile || profile.role !== "admin") return;

const { data: employeeRows } = await supabase
.from("employees")
.select("id, name")
.eq("org_id", profile.org_id)
.order("name", { ascending: true });

const { data: scheduleRows } = await supabase
.from("schedules")
.select("*")
.eq("org_id", profile.org_id)
.order("work_date", { ascending: true });

setEmployees((employeeRows ?? []) as Employee[]);
setSchedules((scheduleRows ?? []) as Schedule[]);
setLoading(false);
}

loadData();
}, []);

useEffect(() => {
if (!loading) {
setTimeout(() => {
window.print();
}, 500);
}
}, [loading]);

function getEmployeeName(employeeId: string) {
return employees.find((e) => e.id === employeeId)?.name ?? "Unknown";
}

function getDayName(dateString: string) {
const [year, month, day] = dateString.split("-").map(Number);
const date = new Date(year, month - 1, day);
return DAYS[date.getDay()];
}

function groupByDay() {
const grouped: Record<string, Schedule[]> = {
Sun: [],
Mon: [],
Tue: [],
Wed: [],
Thu: [],
Fri: [],
Sat: [],
};

for (const shift of schedules) {
const dayName = getDayName(shift.work_date);
grouped[dayName].push(shift);
}

return grouped;
}

const groupedSchedules = groupByDay();

if (loading) {
return <main style={{ padding: 24 }}>Loading weekly schedule...</main>;
}

return (
    <main className="print-page-only" style={pageStyle}>
    <h1 style={titleStyle}>Weekly Schedule</h1>
    <p style={subStyle}>Generated on {new Date().toLocaleDateString()}</p>
    
    <div style={gridStyle}>
    {DAYS.map((day) => (
    <div key={day} style={dayCardStyle}>
    <div style={dayHeaderStyle}>{day}</div>
    
    {groupedSchedules[day].length === 0 ? (
    <div style={emptyStyle}>No shifts</div>
    ) : (
    groupedSchedules[day].map((shift) => (
    <div key={shift.id} style={shiftCardStyle}>
    <div style={employeeStyle}>
    {getEmployeeName(shift.employee_id)}
    </div>
    <div>{formatAppDate(shift.work_date)}</div>
    <div>{formatAppTimeRange(shift.start_time, shift.end_time)}</div>
    <div>{shift.house_name || "—"}</div>
    {shift.mileage != null && <div>Mileage: {shift.mileage}</div>}
    </div>
    ))
    )}
    </div>
    ))}
    </div>
    
    <style jsx global>{`
    @page {
    size: landscape;
    margin: 16px;
    }
    
    @media print {
    body * {
    visibility: hidden !important;
    }
    
    .print-page-only,
    .print-page-only * {
    visibility: visible !important;
    }
    
    .print-page-only {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0 !important;
    padding: 24px !important;
    background: white !important;
    }
    }
    `}</style>
    </main>
    );
}

const pageStyle: React.CSSProperties = {
padding: 24,
background: "white",
color: "#111827",
};

const titleStyle: React.CSSProperties = {
margin: 0,
marginBottom: 6,
fontSize: 28,
};

const subStyle: React.CSSProperties = {
marginTop: 0,
marginBottom: 20,
color: "#6b7280",
};

const gridStyle: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(7, 1fr)",
gap: 12,
};

const dayCardStyle: React.CSSProperties = {
border: "1px solid #d1d5db",
borderRadius: 12,
padding: 10,
minHeight: 260,
background: "#fff",
};

const dayHeaderStyle: React.CSSProperties = {
fontWeight: 700,
marginBottom: 10,
paddingBottom: 8,
borderBottom: "1px solid #e5e7eb",
};

const shiftCardStyle: React.CSSProperties = {
border: "1px solid #e5e7eb",
borderRadius: 10,
padding: 8,
marginBottom: 8,
fontSize: 12,
lineHeight: 1.4,
background: "#f9fafb",
};

const employeeStyle: React.CSSProperties = {
fontWeight: 700,
marginBottom: 4,
};

const emptyStyle: React.CSSProperties = {
color: "#9ca3af",
fontSize: 12,
};


