"use client";

import { useState } from "react";
import { formatAppTimeRange } from "../lib/time";

export type Schedule = {
id: string;
employee_id: string;
org_id?: string;
house_name: string | null;
work_date: string;
start_time: string | null;
end_time: string | null;
mileage: number | null;
is_outing: boolean | null;
daily_log: string | null;
};

type Employee = {
id: string;
name: string;
};

type WeeklyScheduleProps = {
schedules: Schedule[];
employees: Employee[];
onAddShift: (house: string, clickedDate: string) => void;
onEditShift: (shift: Schedule) => void;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayLabel(date: string) {
return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
weekday: "short",
});
}

function getWeekStartSunday(date = new Date()) {
const d = new Date(date);
const day = d.getDay();
d.setDate(d.getDate() - day);
d.setHours(0, 0, 0, 0);
return d;
}

function formatShortDate(date: Date) {
return date.toLocaleDateString("en-US", {
month: "short",
day: "numeric",
});
}

function formatDateKey(date: Date) {
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, "0");
const day = String(date.getDate()).padStart(2, "0");
return `${year}-${month}-${day}`;
}

function formatDateForPrint(dateString: string) {
const date = new Date(`${dateString}T00:00:00`);
return date.toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
year: "numeric",
});
}

export default function WeeklySchedule({
schedules,
employees,
onAddShift,
onEditShift,
}: WeeklyScheduleProps) {
const houses = Array.from(
new Set(schedules.map((s) => s.house_name?.trim()).filter(Boolean))
) as string[];

const [weekStart, setWeekStart] = useState(getWeekStartSunday());

const weekEnd = new Date(weekStart);
weekEnd.setDate(weekStart.getDate() + 6);

function getEmployeeName(employeeId: string) {
return employees.find((e) => e.id === employeeId)?.name ?? "Unknown";
}

function getCellShifts(house: string, day: string) {
return schedules.filter((s) => {
if ((s.house_name ?? "").trim() !== house) return false;

const shiftDate = new Date(`${s.work_date}T00:00:00`);
const shiftWeekStart = getWeekStartSunday(shiftDate);

return (
shiftWeekStart.getTime() === weekStart.getTime() &&
getDayLabel(s.work_date) === day
);
});
}

function goNextWeek() {
const next = new Date(weekStart);
next.setDate(next.getDate() + 7);
setWeekStart(next);
}

function goPrevWeek() {
const prev = new Date(weekStart);
prev.setDate(prev.getDate() - 7);
setWeekStart(prev);
}

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
`<th>${DAYS[index]}<br /><span style="font-weight:400;">${formatShortDate(
date
)}</span></th>`
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
<div class="shift-name">${getEmployeeName(
shift.employee_id
)}</div>
<div>${formatDateForPrint(
shift.work_date
)}</div>
<div>${formatAppTimeRange(
shift.start_time,
shift.end_time
)}</div>
${
shift.mileage != null
? `<div>Mileage: ${shift.mileage}</div>`
: ""
}
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

return (
<section style={sectionStyle} className="weekly-schedule-print">
<div style={headerRow}>
<button onClick={goPrevWeek} style={navBtn}>
◀ Previous
</button>

<div>
<h2 style={titleStyle}>Weekly Schedule</h2>
<p style={subTextStyle}>
{formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
</p>
</div>

<div style={{ display: "flex", gap: 8 }}>
<button onClick={goNextWeek} style={navBtn}>
Next ▶
</button>

<button onClick={handleExportPdf} style={exportBtn}>
Export PDF
</button>
</div>
</div>

{houses.length === 0 ? (
<div style={emptyState}>No scheduled houses yet.</div>
) : (
<div style={boardWrap}>
<table style={tableStyle}>
<thead>
<tr>
<th style={houseHeaderStyle}>House</th>
{DAYS.map((day) => (
<th key={day} style={dayHeaderStyle}>
{day}
</th>
))}
</tr>
</thead>

<tbody>
{houses.map((house) => (
<tr key={house}>
<td style={houseCellStyle}>{house}</td>

{DAYS.map((day, index) => {
const cellDate = new Date(weekStart);
cellDate.setDate(weekStart.getDate() + index);

const clickedDate = formatDateKey(cellDate);
const cellShifts = getCellShifts(house, day);

return (
<td key={day} style={cellStyle}>
{cellShifts.length === 0 ? (
<button
style={addBtn}
onClick={() => onAddShift(house, clickedDate)}
>
+ Add
</button>
) : (
<div style={shiftStackStyle}>
{cellShifts.map((shift) => (
<div
key={shift.id}
style={shiftPillStyle}
onClick={() => onEditShift(shift)}
>
<div style={shiftNameStyle}>
{getEmployeeName(shift.employee_id)}
</div>

<div style={shiftTimeStyle}>
{formatAppTimeRange(
shift.start_time,
shift.end_time
)}
</div>

{shift.is_outing ? (
<div style={outingBadge}>Outing</div>
) : null}
</div>
))}
</div>
)}
</td>
);
})}
</tr>
))}
</tbody>
</table>
</div>
)}
</section>
);
}

const sectionStyle: React.CSSProperties = {
marginTop: 28,
background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
border: "1px solid #e5e7eb",
borderRadius: 20,
padding: 20,
boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
};

const headerRow: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
alignItems: "center",
gap: 12,
marginBottom: 16,
flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
margin: 0,
fontSize: 26,
};

const subTextStyle: React.CSSProperties = {
margin: "6px 0 0 0",
opacity: 0.7,
fontSize: 14,
};

const exportBtn: React.CSSProperties = {
background: "#111827",
color: "white",
border: "none",
padding: "10px 16px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 700,
};

const navBtn: React.CSSProperties = {
background: "#e5e7eb",
border: "none",
padding: "8px 14px",
borderRadius: 8,
cursor: "pointer",
fontWeight: 600,
};

const boardWrap: React.CSSProperties = {
overflowX: "auto",
border: "1px solid #e5e7eb",
borderRadius: 16,
background: "white",
};

const tableStyle: React.CSSProperties = {
width: "100%",
minWidth: 1000,
borderCollapse: "collapse",
};

const houseHeaderStyle: React.CSSProperties = {
textAlign: "left",
padding: "14px 16px",
background: "#f8fafc",
borderBottom: "1px solid #e5e7eb",
minWidth: 180,
fontWeight: 700,
};

const dayHeaderStyle: React.CSSProperties = {
textAlign: "center",
padding: "14px 12px",
background: "#f8fafc",
borderBottom: "1px solid #e5e7eb",
minWidth: 150,
fontWeight: 700,
};

const houseCellStyle: React.CSSProperties = {
padding: "16px",
borderBottom: "1px solid #f1f5f9",
verticalAlign: "top",
fontWeight: 700,
};

const cellStyle: React.CSSProperties = {
padding: "10px",
borderBottom: "1px solid #f1f5f9",
borderLeft: "1px solid #f8fafc",
verticalAlign: "top",
};

const shiftStackStyle: React.CSSProperties = {
display: "grid",
gap: 8,
};

const shiftPillStyle: React.CSSProperties = {
background: "#eff6ff",
border: "1px solid #bfdbfe",
borderRadius: 12,
padding: "10px",
cursor: "pointer",
};

const shiftNameStyle: React.CSSProperties = {
fontWeight: 700,
fontSize: 13,
marginBottom: 4,
};

const shiftTimeStyle: React.CSSProperties = {
fontSize: 12,
color: "#1e3a8a",
};

const addBtn: React.CSSProperties = {
background: "#f8fafc",
border: "1px dashed #cbd5e1",
color: "#475569",
padding: "8px 10px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 600,
width: "100%",
};

const outingBadge: React.CSSProperties = {
marginTop: 6,
display: "inline-block",
background: "#ede9fe",
color: "#6d28d9",
borderRadius: 999,
padding: "4px 8px",
fontSize: 11,
fontWeight: 700,
};

const emptyState: React.CSSProperties = {
border: "1px dashed #cbd5e1",
borderRadius: 16,
padding: 24,
textAlign: "center",
color: "#64748b",
};
