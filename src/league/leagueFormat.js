import { createContext } from "react";

// Volunteer-facing words for League events. Database values stay internal.
export const SESSION_TYPE_LABELS = { session: "League Session", finals: "League Finals" };
export const SESSION_STATUS_LABELS = { upcoming: "Upcoming", active: "Active", completed: "Completed" };

export const sortSessions = (sessions = []) =>
  [...sessions].sort((a, b) => (a.order - b.order) || String(a.date || "").localeCompare(String(b.date || "")) || a.name.localeCompare(b.name));
export const activeSessionOf = (sessions = []) => sessions.find((s) => s.status === "active") || null;
// Next session: the first Upcoming session after the Active one (or the first Upcoming one).
export function nextSessionOf(sessions = []) {
  const ordered = sortSessions(sessions);
  const active = activeSessionOf(ordered);
  const after = active ? ordered.filter((s) => s.order > active.order) : ordered;
  return after.find((s) => s.status === "upcoming") || null;
}

// "2026-10-24" -> "Saturday, October 24, 2026" (date-only values are shown in local time, unshifted).
export function formatSessionDate(date, { long = true } = {}) {
  if (!date) return "";
  const [y, m, d] = String(date).split("-").map(Number);
  if (!y || !m || !d) return String(date);
  const value = new Date(y, m - 1, d);
  return value.toLocaleDateString([], long ? { weekday: "long", month: "long", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}
export function formatSessionTime(time) {
  if (!time) return "";
  const [h, m] = String(time).split(":").map(Number);
  if (!Number.isFinite(h)) return String(time);
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
export function sessionTimeRange(session) {
  const start = formatSessionTime(session?.startTime);
  const end = formatSessionTime(session?.endTime);
  return start && end ? `${start} – ${end}` : start || (end ? `Until ${end}` : "");
}

// Shared with deep components (violation cards, team history, robot photos) so the session
// label is available without threading props through every view. null for Tournament events.
export const LeagueUiContext = createContext(null);
