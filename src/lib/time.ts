export const APP_TIMEZONE = "America/Los_Angeles";

export function formatAppDate(value: string | null) {
if (!value) return "—";

return new Date(value).toLocaleDateString("en-US", {
weekday: "short",
month: "short",
day: "numeric",
year: "numeric",
timeZone: APP_TIMEZONE,
});
}

export function formatAppDateTime(value: string | null) {
if (!value) return "—";

return new Date(value).toLocaleString("en-US", {
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
timeZone: APP_TIMEZONE,
});
}

export function formatAppTimeRange(start: string | null, end: string | null) {
if (!start || !end) return "—";
return `${formatAppTime(start)} – ${formatAppTime(end)}`;
}


