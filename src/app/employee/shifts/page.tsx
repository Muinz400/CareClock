"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../supabaseClient";
import { formatAppDate } from "../../../lib/time";

type Employee = {
id: string;
name: string;
};

type Shift = {
id: string;
employee_id: string;
house_name: string | null;
work_date: string;
start_time: string | null;
end_time: string | null;
mileage: number | null;
is_outing: boolean;
daily_log: string | null;
};

function formatTime12(time: string | null) {
if (!time) return "—";

const [hourStr, minuteStr] = time.split(":");
let hour = parseInt(hourStr, 10);
const minutes = minuteStr;

const ampm = hour >= 12 ? "PM" : "AM";

hour = hour % 12;
if (hour === 0) hour = 12;

return `${hour}:${minutes} ${ampm}`;
}

export default function EmployeeShiftsPage() {
const router = useRouter();

const [employee, setEmployee] = useState<Employee | null>(null);
const [shifts, setShifts] = useState<Shift[]>([]);
const [loading, setLoading] = useState(true);

const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
const [editMileage, setEditMileage] = useState("");
const [editDailyLog, setEditDailyLog] = useState("");
const [savingShiftId, setSavingShiftId] = useState<string | null>(null);

async function loadShifts() {
setLoading(true);

const {
data: { user },
} = await supabase.auth.getUser();

if (!user) {
router.push("/login");
return;
}

const { data: employeeRow } = await supabase
.from("employees")
.select("id, name")
.eq("user_id", user.id)
.single();

if (!employeeRow) {
setLoading(false);
return;
}

setEmployee(employeeRow);

const { data: shiftRows } = await supabase
.from("schedules")
.select("*")
.eq("employee_id", employeeRow.id)
.order("work_date", { ascending: false });

setShifts((shiftRows ?? []) as Shift[]);
setLoading(false);
}

function startEditingShift(shift: Shift) {
setEditingShiftId(shift.id);
setEditMileage(shift.mileage != null ? String(shift.mileage) : "");
setEditDailyLog(shift.daily_log ?? "");
}

function cancelEditingShift() {
setEditingShiftId(null);
setEditMileage("");
setEditDailyLog("");
}

async function saveShiftLog(shiftId: string) {
const parsedMileage =
editMileage.trim() === "" ? null : Number(editMileage);

if (parsedMileage !== null && Number.isNaN(parsedMileage)) {
alert("Mileage must be a valid number.");
return;
}

setSavingShiftId(shiftId);

const { error } = await supabase
.from("schedules")
.update({
mileage: parsedMileage,
daily_log: editDailyLog.trim() || null,
})
.eq("id", shiftId);

setSavingShiftId(null);

if (error) {
alert(error.message);
return;
}

cancelEditingShift();
await loadShifts();
}

useEffect(() => {
loadShifts();
}, []);

if (loading) {
return (
<main style={{ padding: 20 }}>
<p>Loading shifts...</p>
</main>
);
}

return (
<main style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
<h1>My Shifts</h1>

<p style={{ opacity: 0.7 }}>Upcoming and past scheduled shifts.</p>

{shifts.length === 0 ? (
<p>No shifts assigned yet.</p>
) : (
<div style={{ display: "grid", gap: 12 }}>
{shifts.map((shift) => (
<div key={shift.id} style={card}>
<div style={row}>
<div
style={{
display: "flex",
alignItems: "center",
gap: 8,
flexWrap: "wrap",
}}
>
<strong>{formatAppDate(shift.work_date)}</strong>

{shift.is_outing && (
<span style={outingBadge}>Outing</span>
)}
</div>

<button
onClick={() => startEditingShift(shift)}
style={editBtn}
>
Update Log
</button>
</div>

<div style={grid}>
<div>
<div style={label}>Time</div>
<div>
{formatTime12(shift.start_time)} -{" "}
{formatTime12(shift.end_time)}
</div>
</div>

<div>
<div style={label}>House</div>
<div>{shift.house_name || "—"}</div>
</div>

<div>
<div style={label}>Mileage</div>
<div>{shift.mileage ?? "—"}</div>
</div>
</div>

<div style={{ marginTop: 10 }}>
<div style={label}>Daily Log</div>
<div style={{ opacity: 0.8 }}>
{shift.daily_log || "No notes added."}
</div>
</div>

{editingShiftId === shift.id && (
<div style={editPanel}>
<div>
<div style={label}>Mileage</div>
<input
type="number"
value={editMileage}
onChange={(e) => setEditMileage(e.target.value)}
placeholder="Enter mileage"
style={inputStyle}
/>
</div>

<div>
<div style={label}>Daily Log</div>
<textarea
value={editDailyLog}
onChange={(e) => setEditDailyLog(e.target.value)}
rows={4}
placeholder="Add notes for this shift"
style={textareaStyle}
/>
</div>

<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
<button
onClick={() => saveShiftLog(shift.id)}
style={saveBtn}
>
{savingShiftId === shift.id ? "Saving..." : "Save"}
</button>

<button
onClick={cancelEditingShift}
style={cancelBtn}
>
Cancel
</button>
</div>
</div>
)}
</div>
))}
</div>
)}
</main>
);
}

const card: React.CSSProperties = {
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 16,
background: "white",
};

const row: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
marginBottom: 10,
};

const grid: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "1fr 1fr 1fr",
gap: 12,
};

const label: React.CSSProperties = {
fontSize: 12,
opacity: 0.6,
};

const outingBadge: React.CSSProperties = {
background: "#dbeafe",
padding: "4px 8px",
borderRadius: 999,
fontSize: 12,
};

const editBtn: React.CSSProperties = {
background: "#111827",
color: "white",
border: "none",
padding: "8px 12px",
borderRadius: 10,
cursor: "pointer",
fontSize: 13,
fontWeight: 600,
};

const editPanel: React.CSSProperties = {
marginTop: 14,
padding: 14,
border: "1px solid #e5e7eb",
borderRadius: 12,
background: "#f8fafc",
display: "grid",
gap: 12,
};

const inputStyle: React.CSSProperties = {
width: "100%",
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 10,
fontSize: 14,
background: "white",
};

const textareaStyle: React.CSSProperties = {
width: "100%",
padding: "10px 12px",
border: "1px solid #d1d5db",
borderRadius: 10,
fontSize: 14,
resize: "vertical",
background: "white",
};

const saveBtn: React.CSSProperties = {
background: "#2563eb",
color: "white",
border: "none",
padding: "10px 14px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 600,
};

const cancelBtn: React.CSSProperties = {
background: "#e5e7eb",
color: "#111827",
border: "none",
padding: "10px 14px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 600,
};
