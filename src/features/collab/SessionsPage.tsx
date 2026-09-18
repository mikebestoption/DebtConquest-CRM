import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../../state/confirmStore";
import { Link, useNavigate } from "react-router-dom";
import { endCollabSession, fetchCollabSessions, type CollabSession, type CollabSessionType } from "../../api/collab";
import { ApiError } from "../../api/client";
import { useAuthStore } from "../../state/authStore";
import { IconPlayCircle, IconPlus, IconSearch } from "../layout/icons";
import { SessionFormModal } from "./SessionFormModal";
import { STATUS_STYLES, formatDateTime, formatTimeRange, inRoomNames } from "./format";

// One list screen backing all three live-room types - Huddle Room, Meeting
// and Support Session differ in wording, who can see what, and how they're
// created (see SessionFormModal), not in how they're browsed or joined.

interface PageConfig {
  title: string;
  subtitle: string;
  emptyActive: string;
  emptyPast: string;
}

const CONFIG: Record<CollabSessionType, PageConfig> = {
  HUDDLE: {
    title: "Huddle Room",
    subtitle: "Drop-in rooms for quick conversations. Start one, or hop into a huddle that's already going.",
    emptyActive: "No huddles are running right now. Start one to get a conversation going.",
    emptyPast: "No past huddles yet.",
  },
  MEETING: {
    title: "Meeting",
    subtitle: "Schedule meetings with your team, or start one instantly. Scheduled meetings also appear on attendees' calendars.",
    emptyActive: "No upcoming meetings. Schedule one, or start a meeting now.",
    emptyPast: "No past meetings yet.",
  },
  SUPPORT: {
    title: "Support Session",
    subtitle: "Need a hand? Request a live support session and anyone on the team can pick it up. Share your screen to show what you're seeing.",
    emptyActive: "The support queue is empty.",
    emptyPast: "No past support sessions yet.",
  },
};

const REFRESH_MS = 5000;

export function HuddleRoomPage() {
  return <SessionsPage type="HUDDLE" />;
}
export function MeetingPage() {
  return <SessionsPage type="MEETING" />;
}
export function SupportSessionPage() {
  return <SessionsPage type="SUPPORT" />;
}

function SessionsPage({ type }: { type: CollabSessionType }) {
  const config = CONFIG[type];
  const navigate = useNavigate();
  const staff = useAuthStore((s) => s.staff);
  const [view, setView] = useState<"active" | "past">("active");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<CollabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ session: CollabSession | null; startNow?: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      return fetchCollabSessions({ type, view, search: search.trim() || undefined })
        .then((res) => {
          setSessions(res.sessions);
          setError(null);
        })
        .catch((err) => {
          // A failed background refresh shouldn't wipe a working list.
          if (!silent) setError(err instanceof Error ? err.message : "Failed to load sessions");
        })
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [type, view, search],
  );

  useEffect(() => {
    // Debounce typing in the search box; view/type changes load right away.
    const t = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  // Live presence ("3 in the room") and the support queue change under you.
  useEffect(() => {
    if (view !== "active") return;
    const t = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load, view]);

  const myId = staff?.id ?? "";
  const myFirstName = staff?.firstName || staff?.email.split("@")[0] || "My";

  async function handleEnd(s: CollabSession) {
    const verb = s.status === "SCHEDULED" || s.status === "WAITING" ? "Cancel" : "End";
    const ok = await confirmAction({
      title: `${verb} this ${s.type === "MEETING" ? "meeting" : s.type === "SUPPORT" ? "support request" : "huddle"}?`,
      message:
        s.status === "LIVE"
          ? `"${s.title}" will end and everyone in the room will be disconnected.`
          : `"${s.title}" will be cancelled${s.type === "MEETING" ? " and removed from attendees' calendars" : ""}.`,
      confirmLabel: verb === "Cancel" ? "Cancel it" : "End for everyone",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(s.id);
    try {
      await endCollabSession(s.id);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${verb.toLowerCase()} session`);
    } finally {
      setBusyId(null);
    }
  }

  function joinLabel(s: CollabSession): string {
    if (type === "SUPPORT") return s.host.id === myId ? "Enter room" : "Accept & join";
    if (type === "MEETING" && s.host.id === myId && s.status === "SCHEDULED") return "Start";
    return "Join";
  }

  const primary =
    type === "HUDDLE" ? (
      <button onClick={() => setModal({ session: null })} className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
        <IconPlus width={16} height={16} /> Start a Huddle
      </button>
    ) : type === "MEETING" ? (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setModal({ session: null, startNow: true })} className="rounded-md border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-bg">
          Meet now
        </button>
        <button onClick={() => setModal({ session: null })} className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
          <IconPlus width={16} height={16} /> Schedule Meeting
        </button>
      </div>
    ) : (
      <button onClick={() => setModal({ session: null })} className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
        <IconPlus width={16} height={16} /> Request Support
      </button>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-ink">{config.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{config.subtitle}</p>
        </div>
        {primary}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-3">
        <div className="flex rounded-md border border-border p-0.5 text-sm font-semibold">
          {(["active", "past"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-4 py-1.5 ${view === v ? "bg-teal text-white" : "text-muted hover:text-ink"}`}
            >
              {v === "active" ? (type === "MEETING" ? "Upcoming & live" : type === "SUPPORT" ? "Queue" : "Live now") : "History"}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or host"
            className="w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-error">{error}</div>}

      <div className="space-y-3">
        {loading && <div className="rounded-card border border-border bg-white px-4 py-10 text-center text-muted">Loading…</div>}
        {!loading && sessions.length === 0 && (
          <div className="rounded-card border border-dashed border-border bg-white px-4 py-12 text-center text-muted">
            {search ? "Nothing matches your search." : view === "active" ? config.emptyActive : config.emptyPast}
          </div>
        )}
        {!loading &&
          sessions.map((s) => {
            const status = STATUS_STYLES[s.status];
            const inRoom = inRoomNames(s);
            const attendees = s.participants.filter((p) => p.role === "INVITEE");
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-4 sm:gap-4 sm:px-5">
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-base font-semibold text-ink">{s.title}</h2>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.className}`}>{status.label}</span>
                    {s.isOpen && s.inRoomCount > 0 && (
                      <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">{s.inRoomCount} in room</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Host: {s.host.id === myId ? "You" : s.host.name}
                    {type === "MEETING" && ` · ${formatTimeRange(s.scheduledStart, s.scheduledEnd)}`}
                    {type !== "MEETING" && s.isOpen && ` · started ${formatDateTime(s.startedAt ?? s.createdAt)}`}
                    {!s.isOpen && s.endedAt && ` · ended ${formatDateTime(s.endedAt)}`}
                  </p>
                  {s.description && <p className="mt-1 line-clamp-2 text-sm text-ink">{s.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    {s.lead && (
                      <span>
                        Lead:{" "}
                        <Link to={`/leads/${s.lead.id}`} className="font-medium text-teal hover:underline">
                          {s.lead.name} (#{s.lead.leadNumber})
                        </Link>
                      </span>
                    )}
                    {type === "MEETING" && attendees.length > 0 && (
                      <span title={attendees.map((a) => a.name).join(", ")}>
                        {attendees.length} invited: {attendees.slice(0, 3).map((a) => a.name).join(", ")}
                        {attendees.length > 3 && ` +${attendees.length - 3} more`}
                      </span>
                    )}
                    {s.isOpen && inRoom.length > 0 && <span>Here now: {inRoom.join(", ")}</span>}
                    {s.recordingCount > 0 && (
                      <Link to="/teams/recordings" className="flex items-center gap-1 font-medium text-teal hover:underline">
                        <IconPlayCircle width={12} height={12} /> {s.recordingCount} recording{s.recordingCount === 1 ? "" : "s"}
                      </Link>
                    )}
                  </div>
                </div>

                {s.isOpen && (
                  <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                    {s.canManage && (
                      <>
                        {type !== "SUPPORT" && (
                          <button onClick={() => setModal({ session: s })} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-ink hover:bg-bg">
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => void handleEnd(s)}
                          disabled={busyId === s.id}
                          className="rounded-md border border-error px-3 py-2 text-xs font-semibold text-error hover:bg-error hover:text-white disabled:opacity-60"
                        >
                          {s.status === "SCHEDULED" || s.status === "WAITING" ? "Cancel" : "End"}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => navigate(`/teams/room/${s.id}`)}
                      className="flex-1 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover sm:flex-none"
                    >
                      {joinLabel(s)}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {modal && (
        <SessionFormModal
          type={type}
          session={modal.session}
          currentStaffId={myId}
          defaultTitle={type === "HUDDLE" ? `${myFirstName}'s huddle` : ""}
          startNow={modal.startNow}
          onClose={() => setModal(null)}
          onSaved={(saved, created) => {
            setModal(null);
            // Huddles, instant meetings and support requests drop the host
            // straight into the room; scheduled meetings just land in the list.
            if (created && (type !== "MEETING" || saved.status === "LIVE")) navigate(`/teams/room/${saved.id}`);
            else void load(true);
          }}
        />
      )}
    </div>
  );
}
