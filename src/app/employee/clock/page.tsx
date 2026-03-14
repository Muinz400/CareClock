"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../../supabaseClient";

const LocationMap = dynamic(() => import("../../../components/LocationMap"), {
ssr: false,
});

const JOB_SITE = {
name: "Client Home — Marysville",
latitude: 48.03957,
longitude: -122.14665,
};

const ALLOWED_RADIUS_METERS = 5000;

type EmployeeRow = {
id: string;
user_id: string | null;
name: string;
email: string;
};

type ClockLogRow = {
id: string;
employee_id: string;
latitude: number | null;
longitude: number | null;
clock_in: string | null;
clock_out: string | null;
};

export default function ClockPage() {
const [status, setStatus] = useState<string>("Not clocked in");
const [location, setLocation] = useState<string>("");
const [distanceAway, setDistanceAway] = useState<string | null>(null);
const [employeeLat, setEmployeeLat] = useState<number | null>(null);
const [employeeLng, setEmployeeLng] = useState<number | null>(null);
const [lastClockIn, setLastClockIn] = useState<string | null>(null);
const [lastClockOut, setLastClockOut] = useState<string | null>(null);
const [loading, setLoading] = useState(false);

const [employee, setEmployee] = useState<EmployeeRow | null>(null);
const [authReady, setAuthReady] = useState(false);

function getDistanceMeters(
lat1: number,
lon1: number,
lat2: number,
lon2: number
) {
const toRad = (value: number) => (value * Math.PI) / 180;

const earthRadius = 6371000;
const dLat = toRad(lat2 - lat1);
const dLon = toRad(lon2 - lon1);

const a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(toRad(lat1)) *
Math.cos(toRad(lat2)) *
Math.sin(dLon / 2) *
Math.sin(dLon / 2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return earthRadius * c;
}

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

async function loadEmployeeAndClockLog() {
const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
alert("Please log in first.");
setAuthReady(true);
return;
}

const { data: employeeRow, error: employeeError } = await supabase
.from("employees")
.select("id, user_id, name, email")
.eq("user_id", user.id)
.single();

if (employeeError || !employeeRow) {
console.error(employeeError);
alert("Employee record not found.");
setAuthReady(true);
return;
}

setEmployee(employeeRow);
setAuthReady(true);

const { data, error } = await supabase
.from("clock_logs")
.select("id, employee_id, clock_in, clock_out, latitude, longitude")
.eq("employee_id", employeeRow.id)
.order("clock_in", { ascending: false })
.limit(1)
.single();

if (!error && data) {
setLastClockIn(data.clock_in ?? null);
setLastClockOut(data.clock_out ?? null);
setStatus(data.clock_in && !data.clock_out ? "Clocked In" : "Clocked Out");
} else {
setStatus("Not clocked in");
}
}

function updateLocationState(lat: number, lng: number) {
setEmployeeLat(lat);
setEmployeeLng(lng);
setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);

const metersAway = getDistanceMeters(
lat,
lng,
JOB_SITE.latitude,
JOB_SITE.longitude
);

setDistanceAway(metersAway.toFixed(0));
return metersAway;
}

function checkCurrentLocation() {
if (!navigator.geolocation) return;

navigator.geolocation.getCurrentPosition(
(pos) => {
const lat = pos.coords.latitude;
const lng = pos.coords.longitude;
updateLocationState(lat, lng);
},
(err) => {
console.error(err);
}
);
}

useEffect(() => {
checkCurrentLocation();
void loadEmployeeAndClockLog();
}, []);

const handleClockIn = async () => {
if (!employee) {
alert("Employee not loaded yet.");
return;
}

if (!navigator.geolocation) {
alert("Geolocation not supported");
return;
}

setLoading(true);

navigator.geolocation.getCurrentPosition(
async (pos) => {
try {
const lat = pos.coords.latitude;
const lng = pos.coords.longitude;

const metersAway = updateLocationState(lat, lng);

if (metersAway > ALLOWED_RADIUS_METERS) {
alert(
`Clock in blocked. You are ${metersAway.toFixed(
0
)} meters away from ${JOB_SITE.name}. You must be within ${ALLOWED_RADIUS_METERS} meters.`
);
setLoading(false);
return;
}

const nowIso = new Date().toISOString();

const { error } = await supabase.from("clock_logs").insert([
{
employee_id: employee.id,
latitude: lat,
longitude: lng,
clock_in: nowIso,
},
]);

if (error) {
alert(error.message);
setLoading(false);
return;
}

setStatus("Clocked In");
setLastClockIn(nowIso);
setLastClockOut(null);
} catch (err) {
console.error(err);
alert("Failed to clock in");
} finally {
setLoading(false);
}
},
(err) => {
console.error(err);
alert("Unable to get location");
setLoading(false);
}
);
};

const handleClockOut = async () => {
if (!employee) {
alert("Employee not loaded yet.");
return;
}

setLoading(true);

try {
const { data: latestLog, error: fetchError } = await supabase
.from("clock_logs")
.select("*")
.eq("employee_id", employee.id)
.is("clock_out", null)
.order("clock_in", { ascending: false })
.limit(1)
.single();

if (fetchError || !latestLog) {
alert("No active clock-in found");
setLoading(false);
return;
}

const nowIso = new Date().toISOString();

const { error: updateError } = await supabase
.from("clock_logs")
.update({ clock_out: nowIso })
.eq("id", latestLog.id);

if (updateError) {
alert(updateError.message);
setLoading(false);
return;
}

setStatus("Clocked Out");
setLastClockOut(nowIso);
} catch (err) {
console.error(err);
alert("Failed to clock out");
} finally {
setLoading(false);
}
};

const isWithinRadius =
distanceAway !== null && Number(distanceAway) <= ALLOWED_RADIUS_METERS;

const cardStyle: React.CSSProperties = {
background: "#fff",
border: "1px solid #e5e7eb",
borderRadius: 12,
padding: 18,
maxWidth: 720,
boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const clockInBtn: React.CSSProperties = {
padding: "10px 16px",
borderRadius: 8,
border: "none",
background: "#16a34a",
color: "white",
fontWeight: 600,
cursor: "pointer",
};

const clockOutBtn: React.CSSProperties = {
padding: "10px 16px",
borderRadius: 8,
border: "none",
background: "#dc2626",
color: "white",
fontWeight: 600,
cursor: "pointer",
};

const logCardStyle: React.CSSProperties = {
...cardStyle,
marginTop: 16,
};

if (!authReady) {
return (
<main style={{ padding: 24 }}>
<p>Loading employee session...</p>
</main>
);
}

return (
<main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
<h1>CareClock Employee Time</h1>

{employee ? (
<p style={{ opacity: 0.75, marginTop: 4 }}>
Logged in as <strong>{employee.name}</strong> ({employee.email})
</p>
) : null}

<div style={cardStyle}>
<p>
<strong>Status:</strong>{" "}
<span
style={{
padding: "4px 10px",
borderRadius: "999px",
background: status === "Clocked In" ? "#dcfce7" : "#e5e7eb",
color: status === "Clocked In" ? "#166534" : "#111827",
fontWeight: 600,
}}
>
{status}
</span>
</p>

<p>
<strong>GPS location:</strong>{" "}
{location || "Location will appear after clock in"}
</p>

<p>
<strong>Job site:</strong> {JOB_SITE.name}
</p>

<p>
<strong>Allowed radius:</strong> {ALLOWED_RADIUS_METERS} meters
</p>

<p>
<strong>Distance away:</strong>{" "}
{distanceAway ? `${distanceAway} meters` : "Calculating..."}
</p>

<p>
<strong>Location Check:</strong>{" "}
<span
style={{
color:
distanceAway && Number(distanceAway) <= ALLOWED_RADIUS_METERS
? "green"
: "crimson",
fontWeight: 600,
}}
>
{distanceAway
? Number(distanceAway) <= ALLOWED_RADIUS_METERS
? "✅ Within job site radius"
: "❌ Outside job site radius"
: "Checking..."}
</span>
</p>

<div style={{ display: "flex", gap: 12, marginTop: 16 }}>
<button
style={clockInBtn}
onClick={handleClockIn}
disabled={loading || !isWithinRadius || status === "Clocked In"}
>
{loading ? "Working..." : "Clock In"}
</button>

<button
style={clockOutBtn}
onClick={handleClockOut}
disabled={loading || status !== "Clocked In"}
>
{loading ? "Working..." : "Clock Out"}
</button>
</div>
</div>

{employeeLat !== null && employeeLng !== null && (
<div style={{ marginTop: 20 }}>
<LocationMap
employeeLat={employeeLat}
employeeLng={employeeLng}
jobLat={JOB_SITE.latitude}
jobLng={JOB_SITE.longitude}
radiusMeters={ALLOWED_RADIUS_METERS}
/>
</div>
)}

<div style={logCardStyle}>
<h3 style={{ marginTop: 0, marginBottom: 12 }}>Latest Time Activity</h3>
<p style={{ margin: "6px 0" }}>
<strong>Last Clock In:</strong> {formatDateTime(lastClockIn)}
</p>
<p style={{ margin: "6px 0" }}>
<strong>Last Clock Out:</strong> {formatDateTime(lastClockOut)}
</p>
</div>
</main>
);
}
