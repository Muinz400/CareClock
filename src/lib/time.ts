export const APP_TIMEZONE = "America/Los_Angeles";

function normalizeUtcValue(value: string | null) {
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
