import type { CollabSession, CollabSessionStatus, CollabSessionType } from "../../api/collab";

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso);
  const date = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return endIso ? `${date}, ${time(start)} – ${time(new Date(endIso))}` : `${date}, ${time(start)}`;
}

export const STATUS_STYLES: Record<CollabSessionStatus, { label: string; className: string }> = {
  SCHEDULED: { label: "Scheduled", className: "bg-blue-50 text-blue-700" },
  WAITING: { label: "Waiting", className: "bg-amber-50 text-amber-700" },
  LIVE: { label: "Live", className: "bg-green-50 text-green-700" },
  ENDED: { label: "Ended", className: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

// yyyy-MM-ddTHH:mm, the value format <input type="datetime-local"> reads and
// emits - built from local getters (not toISOString, which is UTC).
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function staffDisplayName(s: { firstName: string | null; lastName: string | null; email: string }): string {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email;
}

export function inRoomNames(session: CollabSession): string[] {
  return session.participants.filter((p) => p.inRoom).map((p) => p.name);
}

export const TYPE_META: Record<CollabSessionType, { label: string; path: string }> = {
  HUDDLE: { label: "Huddle Room", path: "/teams/huddle-room" },
  MEETING: { label: "Meeting", path: "/teams/meeting" },
  SUPPORT: { label: "Support Session", path: "/teams/support-session" },
};

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}
