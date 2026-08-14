export const APP_TIMEZONE = "America/Los_Angeles";

export function normalizeUtcValue(value: string | null) {
if (!value) return null;

const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
return hasTimezone ? value : `${value}Z`;
}

export function formatAppDate(value: string | null) {
if (!value) return "—";

const [year, month, day] = value.split("-").map(Number);
const date = new Date(year, month - 1, day);

return date.toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
year: "numeric",
});
}

export function formatAppDateTime(value: string | null) {
const normalized = normalizeUtcValue(value);
if (!normalized) return "—";

return new Date(normalized).toLocaleString("en-US", {
month: "short",
day: "numeric",
year: "numeric",
hour: "numeric",
minute: "2-digit",
timeZone: APP_TIMEZONE,
});
}

export function formatAppTime(time: string | null) {
if (!time) return "—";

return new Date(`1970-01-01T${time}`).toLocaleTimeString("en-US", {
hour: "numeric",
minute: "2-digit",
});
}

export function formatAppTimeRange(start: string | null, end: string | null) {
if (!start || !end) return "—";
return `${formatAppTime(start)} - ${formatAppTime(end)}`;
}

export function getAppDateKey(value: string | null) {
if (!value) return "unknown";
return value;
}

// "en-CA" formats as YYYY-MM-DD, matching the plain date-string format
// already used for schedules.work_date elsewhere in the app.
export function getAppTodayISODate() {
return new Intl.DateTimeFormat("en-CA", {
timeZone: APP_TIMEZONE,
year: "numeric",
month: "2-digit",
day: "2-digit",
}).format(new Date());
}

// Sunday-Saturday week boundary. This intentionally matches the existing
// Sunday-start convention already used by payroll/page.tsx's own local
// startOfWeekSunday() — same interpretation of "week", not a competing
// one. That function stays where it is (untouched); this is a fresh,
// independent implementation so nothing there needs to change for this
// to exist. Not Monday-start, not locale-dependent (Intl's default
// first-day-of-week varies by locale — deliberately not used here).
//
// Returns a YYYY-MM-DD date key, same shape as getAppTodayISODate(), for
// the Sunday that starts the week containing referenceDateKey (defaults
// to today). Callers needing a timestamp boundary for a clock_logs query
// append "T00:00:00Z", matching normalizeUtcValue's existing UTC
// convention for these columns.
export function getWeekStartISODate(referenceDateKey?: string) {
const dateKey = referenceDateKey ?? getAppTodayISODate();
const [year, month, day] = dateKey.split("-").map(Number);

const date = new Date(year, month - 1, day);
date.setDate(date.getDate() - date.getDay());

const y = date.getFullYear();
const m = String(date.getMonth() + 1).padStart(2, "0");
const d = String(date.getDate()).padStart(2, "0");

return `${y}-${m}-${d}`;
}
