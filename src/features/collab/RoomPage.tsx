import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../state/authStore";
import { RoomRuntime, type RecordingState } from "./roomRuntime";
import type { RecordingMode } from "./recorder";
import { VideoTile } from "./VideoTile";
import { TYPE_META, formatDuration, formatTimeRange, inRoomNames } from "./format";
import { Select } from "../../components/controls";
import {
  IconLink,
  IconLogOut,
  IconMessage,
  IconMic,
  IconMicOff,
  IconMonitor,
  IconRecord,
  IconSend,
  IconStop,
  IconUsers,
  IconVideo,
  IconVideoOff,
} from "../layout/icons";

// Live room for Huddle Room / Meeting / Support Session (they only differ in
// how they're created and listed - see SessionsPage.tsx). Route:
// /teams/room/:id

// Owns a RoomRuntime for the lifetime of the page. StrictMode mounts,
// unmounts and re-mounts every effect in development; tearing the runtime
// down synchronously on that fake unmount would drop the camera and call
// /leave right before the real mount joined. Deferring the teardown a beat
// (and cancelling it if the effect re-runs) makes the fake unmount a no-op
// while a real one still cleans up.
function useRoomRuntime(sessionId: string, me: { id: string; name: string }): RoomRuntime {
  const [runtime] = useState(() => new RoomRuntime(sessionId, me));
  const teardownTimer = useRef<number | null>(null);

  useEffect(() => {
    if (teardownTimer.current !== null) {
      window.clearTimeout(teardownTimer.current);
      teardownTimer.current = null;
    }
    void runtime.load();
    return () => {
      teardownTimer.current = window.setTimeout(() => runtime.dispose(), 400);
    };
  }, [runtime]);

  return runtime;
}

export function RoomPage() {
  const { id } = useParams<{ id: string }>();
  // Keyed so navigating from one room straight to another builds a fresh runtime.
  return id ? <RoomView key={id} sessionId={id} /> : null;
}

function RoomView({ sessionId }: { sessionId: string }) {
  const staff = useAuthStore((s) => s.staff);
  const me = {
    id: staff?.id ?? "",
    name: [staff?.firstName, staff?.lastName].filter(Boolean).join(" ") || staff?.email || "You",
  };
  const runtime = useRoomRuntime(sessionId, me);
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const backPath = state.session ? TYPE_META[state.session.type].path : "/teams/huddle-room";

  if (state.phase === "loading") {
    return <CenteredCard title="Loading session…" />;
  }
  if (state.phase === "error") {
    return <CenteredCard title="Can't open this session" message={state.error ?? undefined} backPath={backPath} />;
  }
  if (state.phase === "ended") {
    return (
      <CenteredCard title={state.endedMessage ?? "This session has ended."} backPath={backPath}>
        <RecordingBanner recording={state.recording} runtime={runtime} />
        {state.session && state.session.recordingCount + (state.recording.status === "saved" ? 1 : 0) > 0 && (
          <Link to="/teams/recordings" className="mt-3 text-sm font-semibold text-teal hover:underline">
            View recordings
          </Link>
        )}
      </CenteredCard>
    );
  }
  if (state.phase === "lobby" || state.phase === "joining") {
    return <Lobby runtime={runtime} />;
  }
  return <LiveRoom runtime={runtime} myId={me.id} myName={me.name} backPath={backPath} />;
}

function CenteredCard({ title, message, backPath, children }: { title: string; message?: string; backPath?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-card border border-border bg-white px-6 text-center">
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      {message && <p className="mt-1 text-sm text-muted">{message}</p>}
      {children}
      {backPath && (
        <Link to={backPath} className="mt-4 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
          Back to {backPath === "/teams/meeting" ? "meetings" : backPath === "/teams/support-session" ? "support sessions" : "huddle rooms"}
        </Link>
      )}
    </div>
  );
}

// --- Lobby: check camera/mic before joining ---

function Lobby({ runtime }: { runtime: RoomRuntime }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const { media } = runtime;
  const session = state.session;
  const joining = state.phase === "joining";
  const navigate = useNavigate();

  if (!session) return null;
  const others = inRoomNames(session);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <VideoTile
          stream={media.getPreviewStream()}
          name="You"
          muted
          mirror
          videoOn={media.camOn}
          audioOn={media.micOn}
          className="aspect-video w-full"
        />
        <div className="flex items-center justify-center gap-3">
          <ControlButton label={media.micOn ? "Mute" : "Unmute"} active={!media.micOn} disabled={!media.audioTrack} onClick={runtime.toggleMic}>
            {media.micOn ? <IconMic width={20} height={20} /> : <IconMicOff width={20} height={20} />}
          </ControlButton>
          <ControlButton label={media.camOn ? "Turn camera off" : "Turn camera on"} active={!media.camOn} onClick={runtime.toggleCamera}>
            {media.camOn ? <IconVideo width={20} height={20} /> : <IconVideoOff width={20} height={20} />}
          </ControlButton>
        </div>
        {media.error && <p className="text-center text-sm text-amber-700">{media.error}</p>}
      </div>

      <div className="rounded-card border border-border bg-white p-6">
        <span className="rounded bg-bg px-2 py-0.5 text-xs font-semibold text-teal-100">{TYPE_META[session.type].label}</span>
        <h1 className="mt-2 text-xl font-bold text-ink">{session.title}</h1>
        <p className="mt-1 text-sm text-muted">Hosted by {session.host.name}</p>
        {session.type === "MEETING" && session.scheduledStart && (
          <p className="mt-1 text-sm text-muted">{formatTimeRange(session.scheduledStart, session.scheduledEnd)}</p>
        )}
        {session.lead && (
          <p className="mt-1 text-sm text-muted">
            About{" "}
            <Link to={`/leads/${session.lead.id}`} className="font-medium text-teal hover:underline">
              {session.lead.name} (#{session.lead.leadNumber})
            </Link>
          </p>
        )}
        {session.description && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{session.description}</p>}

        <p className="mt-4 text-sm text-muted">
          {others.length === 0 ? "No one else is here yet." : `In the room now: ${others.join(", ")}`}
        </p>

        {state.error && <p className="mt-3 text-sm text-error">{state.error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => void runtime.join()}
            disabled={joining || !media.ready}
            className="flex-1 rounded-md bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
          >
            {joining ? "Joining…" : !media.ready ? "Checking devices…" : "Join now"}
          </button>
          <button
            onClick={() => navigate(TYPE_META[session.type].path)}
            className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-ink hover:bg-bg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Live call ---

function LiveRoom({ runtime, myId, myName, backPath }: { runtime: RoomRuntime; myId: string; myName: string; backPath: string }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const navigate = useNavigate();
  const { media } = runtime;
  const { session, snapshot, recording } = state;
  const [panel, setPanel] = useState<"chat" | "people" | null>(null);
  const [recordMode, setRecordMode] = useState<RecordingMode>("video");
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seenMessages, setSeenMessages] = useState(0);

  const recording_ = recording.status === "recording";
  const uploading = recording.status === "uploading";

  // Closing the tab mid-call would drop everyone else's connection to you and
  // lose an in-progress recording.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (panel === "chat") setSeenMessages(snapshot.messages.length);
  }, [panel, snapshot.messages.length]);

  if (!session) return null;

  const nameOf = (staffId: string) => snapshot.participants.find((p) => p.staffId === staffId)?.name ?? "Participant";
  const previewStream = media.getPreviewStream();

  const tiles = [
    {
      key: "me",
      stream: previewStream,
      name: `${myName} (You)`,
      muted: true,
      videoOn: media.outgoingVideo !== null,
      audioOn: media.micOn,
      mirror: true,
      screen: media.sharing,
      status: undefined as string | undefined,
    },
    ...snapshot.peers.map((p) => ({
      key: p.staffId,
      stream: p.stream,
      name: nameOf(p.staffId),
      muted: false,
      videoOn: p.video,
      audioOn: p.audio,
      mirror: false,
      screen: p.screen,
      status: p.connectionState === "connected" ? undefined : p.connectionState === "failed" ? "connection lost" : "connecting…",
    })),
  ];
  const renderTile = (t: (typeof tiles)[number], className: string) => (
    <VideoTile
      key={t.key}
      stream={t.stream}
      name={t.name}
      muted={t.muted}
      videoOn={t.videoOn}
      audioOn={t.audioOn}
      mirror={t.mirror}
      screen={t.screen}
      status={t.status}
      className={className}
    />
  );
  const presenter = tiles.find((t) => t.screen);
  const strip = presenter ? tiles.filter((t) => t !== presenter) : [];
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : tiles.length <= 6 ? 3 : 4;

  const unread = panel === "chat" ? 0 : Math.max(0, snapshot.messages.length - seenMessages);
  const waitingAlone = snapshot.peers.length === 0;

  async function handleLeave() {
    if (recording_ && !window.confirm("You're recording. Leaving stops the recording and saves it. Leave now?")) return;
    setLeaving(true);
    await runtime.leave();
    navigate(backPath);
  }

  async function handleEnd() {
    const what = session?.type === "SUPPORT" ? "support session" : session?.type === "MEETING" ? "meeting" : "huddle";
    if (!window.confirm(`End this ${what} for everyone? Everyone will be disconnected.`)) return;
    setLeaving(true);
    try {
      await runtime.endForEveryone();
      navigate(backPath);
    } catch {
      setLeaving(false);
    }
  }

  function copyLink() {
    void navigator.clipboard?.writeText(`${window.location.origin}/teams/room/${session?.id}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[480px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold text-ink">{session.title}</h1>
            <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-semibold text-teal-100">{TYPE_META[session.type].label}</span>
            {recording_ && <RecordingTimer startedAt={recording.startedAt} />}
          </div>
          <p className="text-xs text-muted">
            {snapshot.peers.length + 1} in the room · hosted by {session.host.name}
            {session.type === "SUPPORT" && session.status === "WAITING" && " · waiting for someone to pick this up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-teal">
            <IconLink width={14} height={14} /> {copied ? "Copied!" : "Copy link"}
          </button>
          {session.canManage && (
            <button
              onClick={() => void handleEnd()}
              disabled={leaving}
              className="rounded-md border border-error px-3 py-1.5 text-xs font-semibold text-error hover:bg-error hover:text-white disabled:opacity-60"
            >
              End for everyone
            </button>
          )}
        </div>
      </div>

      {snapshot.reconnecting && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Connection problem - trying to reconnect…</div>
      )}
      <RecordingBanner recording={recording} runtime={runtime} />

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="relative min-h-0 flex-1 rounded-card bg-[#0b1f1f] p-2">
          {presenter ? (
            <div className="flex h-full flex-col gap-2">
              {renderTile(presenter, "min-h-0 flex-1")}
              {strip.length > 0 && (
                <div className="flex h-28 shrink-0 gap-2 overflow-x-auto">
                  {strip.map((t) => renderTile(t, "aspect-video h-full shrink-0"))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid h-full gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}>
              {tiles.map((t) => renderTile(t, "h-full min-h-0"))}
            </div>
          )}
          {waitingAlone && (
            <div className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm font-medium text-white/80">
              Waiting for others to join…
            </div>
          )}
        </div>

        {panel && (
          <div className="flex w-80 shrink-0 flex-col rounded-card border border-border bg-white">
            <div className="flex border-b border-border text-sm font-semibold">
              {(["chat", "people"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPanel(tab)}
                  className={`flex-1 px-3 py-2.5 capitalize ${panel === tab ? "border-b-2 border-teal text-ink" : "text-muted"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {panel === "chat" ? (
              <ChatPanel runtime={runtime} myId={myId} />
            ) : (
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 text-sm">
                {snapshot.participants
                  .filter((p) => p.inRoom)
                  .map((p) => (
                    <li key={p.staffId} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-bg">
                      <span className="text-ink">
                        {p.name}
                        {p.staffId === myId && " (You)"}
                      </span>
                      {p.role === "HOST" && <span className="text-xs font-semibold text-teal-100">Host</span>}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 rounded-card border border-border bg-white px-4 py-3">
        <ControlButton label={media.micOn ? "Mute" : "Unmute"} active={!media.micOn} disabled={!media.audioTrack} onClick={runtime.toggleMic}>
          {media.micOn ? <IconMic width={20} height={20} /> : <IconMicOff width={20} height={20} />}
        </ControlButton>
        <ControlButton label={media.camOn ? "Turn camera off" : "Turn camera on"} active={!media.camOn} onClick={runtime.toggleCamera}>
          {media.camOn ? <IconVideo width={20} height={20} /> : <IconVideoOff width={20} height={20} />}
        </ControlButton>
        <ControlButton label={media.sharing ? "Stop sharing" : "Share screen"} highlight={media.sharing} onClick={runtime.toggleShare}>
          <IconMonitor width={20} height={20} />
        </ControlButton>

        <span className="mx-1 h-8 w-px bg-border" />

        {runtime.recordingSupported && (
          <div className="flex items-center gap-2">
            {!recording_ && !uploading && (
              <Select fitContent value={recordMode} onChange={(e) => setRecordMode(e.target.value as RecordingMode)} aria-label="Recording type">
                <option value="video">Video + audio</option>
                <option value="audio">Audio only</option>
              </Select>
            )}
            <ControlButton
              label={recording_ ? "Stop recording" : "Record"}
              danger={recording_}
              disabled={uploading}
              onClick={() => (recording_ ? void runtime.stopRecording() : runtime.startRecording(recordMode))}
            >
              {recording_ ? <IconStop width={20} height={20} /> : <IconRecord width={20} height={20} />}
            </ControlButton>
          </div>
        )}

        <span className="mx-1 h-8 w-px bg-border" />

        <div className="relative">
          <ControlButton label="Chat" highlight={panel === "chat"} onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))}>
            <IconMessage width={20} height={20} />
          </ControlButton>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </div>
        <ControlButton label="People" highlight={panel === "people"} onClick={() => setPanel((p) => (p === "people" ? null : "people"))}>
          <IconUsers width={20} height={20} />
        </ControlButton>

        <button
          onClick={() => void handleLeave()}
          disabled={leaving}
          className="flex items-center gap-1.5 rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <IconLogOut width={16} height={16} /> {leaving ? "Leaving…" : "Leave"}
        </button>
      </div>
      {media.error && <p className="text-center text-xs text-amber-700">{media.error}</p>}
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  // Off/muted state (drawn red).
  active?: boolean;
  // On state for toggles like screen share / open panel (drawn teal).
  highlight?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

function ControlButton({ label, onClick, children, active, highlight, danger, disabled }: ControlButtonProps) {
  const tone = danger
    ? "bg-error text-white"
    : active
      ? "bg-red-50 text-error border-red-200"
      : highlight
        ? "bg-teal text-white border-teal"
        : "bg-white text-ink border-border hover:border-teal";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}

function RecordingTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-error">
      <span className="h-2 w-2 animate-pulse rounded-full bg-error" /> REC {formatDuration(startedAt ? (now - startedAt) / 1000 : 0)}
    </span>
  );
}

function RecordingBanner({ recording, runtime }: { recording: RecordingState; runtime: RoomRuntime }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const pending = recording.pending;

  // A download link for a recording that failed to upload.
  useEffect(() => {
    if (!pending) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(pending.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  if (recording.status === "recording") {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-error">
        Recording {recording.mode === "audio" ? "audio" : "video and audio"}. Everyone in the room was notified - keep this tab open and in front until you stop.
      </div>
    );
  }
  if (recording.status === "uploading") {
    return <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">Saving recording…</div>;
  }
  if (recording.status === "saved") {
    return (
      <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        Recording saved.{" "}
        <Link to="/teams/recordings" className="font-semibold underline">
          View recordings
        </Link>
      </div>
    );
  }
  if (recording.status === "error") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-error">
        <span>{recording.error}</span>
        {pending && (
          <>
            <button onClick={() => void runtime.retryUpload()} className="font-semibold underline">
              Retry
            </button>
            {objectUrl && (
              <a href={objectUrl} download="recording.webm" className="font-semibold underline">
                Download
              </a>
            )}
            <button onClick={() => runtime.discardPending()} className="font-semibold underline">
              Discard
            </button>
          </>
        )}
      </div>
    );
  }
  return null;
}

function ChatPanel({ runtime, myId }: { runtime: RoomRuntime; myId: string }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = state.snapshot.messages;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await runtime.sendMessage(body);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && <p className="text-center text-sm text-muted">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={m.staffId === myId ? "text-right" : ""}>
            <div className="text-[11px] text-muted">
              {m.staffId === myId ? "You" : m.name} · {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </div>
            <div className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-left text-sm ${m.staffId === myId ? "bg-teal text-white" : "bg-bg text-ink"}`}>
              {m.body}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="px-3 text-xs text-error">{error}</p>}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Message everyone"
          className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-teal"
        />
        <button type="submit" disabled={sending || !text.trim()} className="rounded-md bg-teal px-3 text-white hover:bg-teal-hover disabled:opacity-60" aria-label="Send">
          <IconSend width={16} height={16} />
        </button>
      </form>
    </>
  );
}
