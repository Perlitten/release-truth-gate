export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function timelineDayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function formatTimelineDay(dayKey) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

export function formatTime(value) {
  return new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(
    new Date(value),
  );
}

export function formatFullTimestamp(value) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "long",
  }).format(new Date(value));
}

export function initials(name) {
  return (
    name
      ?.split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "RT"
  );
}
