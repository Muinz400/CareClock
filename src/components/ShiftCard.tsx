"use client";

import {formatAppDate, formatAppTimeRange} from "../lib/time";

type Shift = {
id: string;
employee_id: string;
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

type ShiftCardProps = {
shift: Shift;
employee?: Employee;
onEdit: () => void;
onDelete: () => void;
};



export default function ShiftCard({
shift,
employee,
onEdit,
onDelete,
}: ShiftCardProps) {
return (
<div style={cardStyle}>
<div style={topRow}>
<div>
<div style={titleRow}>
<h3 style={nameStyle}>{employee?.name ?? "Unknown Employee"}</h3>

{shift.is_outing ? (
<span style={outingBadge}>Outing</span>
) : (
<span style={standardBadge}>Standard</span>
)}
</div>

<div style={dateText}>{formatAppDate(shift.work_date)}</div>
</div>

<div style={actionsRow}>
<button onClick={onEdit} style={editBtn}>
Edit
</button>
<button onClick={onDelete} style={deleteBtn}>
Delete
</button>
</div>
</div>

<div style={metaGrid}>
<div style={metaCard}>
<div style={metaLabel}>Time</div>
<div style={metaValue}>{formatAppTimeRange(shift.start_time, shift.end_time)}</div>
</div>

<div style={metaCard}>
<div style={metaLabel}>House</div>
<div style={metaValue}>{shift.house_name || "—"}</div>
</div>

<div style={metaCard}>
<div style={metaLabel}>Mileage</div>
<div style={metaValue}>
{shift.mileage != null ? shift.mileage : "—"}
</div>
</div>
</div>

<div style={notesWrap}>
<div style={metaLabel}>Daily Log</div>
<div style={notesText}>
{shift.daily_log?.trim() ? shift.daily_log : "No daily notes added."}
</div>
</div>
</div>
);
}

const cardStyle: React.CSSProperties = {
background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
border: "1px solid #e5e7eb",
borderRadius: 18,
padding: 18,
boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

const topRow: React.CSSProperties = {
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
gap: 12,
flexWrap: "wrap",
marginBottom: 16,
};

const titleRow: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 10,
flexWrap: "wrap",
marginBottom: 6,
};

const nameStyle: React.CSSProperties = {
margin: 0,
fontSize: 20,
fontWeight: 700,
color: "#0f172a",
};

const dateText: React.CSSProperties = {
fontSize: 14,
color: "#475569",
};

const actionsRow: React.CSSProperties = {
display: "flex",
gap: 8,
flexWrap: "wrap",
};

const editBtn: React.CSSProperties = {
background: "#dbeafe",
color: "#1d4ed8",
border: "none",
padding: "8px 12px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 700,
fontSize: 13,
};

const deleteBtn: React.CSSProperties = {
background: "#fee2e2",
color: "#b91c1c",
border: "none",
padding: "8px 12px",
borderRadius: 10,
cursor: "pointer",
fontWeight: 700,
fontSize: 13,
};

const outingBadge: React.CSSProperties = {
background: "#ede9fe",
color: "#6d28d9",
padding: "5px 10px",
borderRadius: 999,
fontSize: 12,
fontWeight: 700,
};

const standardBadge: React.CSSProperties = {
background: "#e2e8f0",
color: "#334155",
padding: "5px 10px",
borderRadius: 999,
fontSize: 12,
fontWeight: 700,
};

const metaGrid: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
gap: 12,
marginBottom: 14,
};

const metaCard: React.CSSProperties = {
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 14,
padding: 14,
};

const metaLabel: React.CSSProperties = {
fontSize: 12,
textTransform: "uppercase",
letterSpacing: 0.6,
color: "#64748b",
marginBottom: 6,
fontWeight: 700,
};

const metaValue: React.CSSProperties = {
fontSize: 15,
fontWeight: 700,
color: "#0f172a",
};

const notesWrap: React.CSSProperties = {
background: "#ffffff",
border: "1px solid #e5e7eb",
borderRadius: 14,
padding: 14,
};

const notesText: React.CSSProperties = {
fontSize: 14,
color: "#334155",
lineHeight: 1.5,
};
