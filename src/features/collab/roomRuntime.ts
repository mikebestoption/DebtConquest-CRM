import { ApiError } from "../../api/client";
import {
  controlCollabSession,
  endCollabSession,
  fetchCollabSession,
  fetchGuestSession,
  guestRoomApi,
  joinAsGuest,
  joinCollabSession,
  staffRoomApi,
  uploadCollabRecording,
  type CollabSession,
  type ControlAction,
  type JoinResult,
  type RoomApi,
} from "../../api/collab";
import { collabLog } from "./debug";
import { LocalMedia } from "./media";
import { RoomClient, type ClosedReason, type RoomPointer, type RoomSnapshot } from "./roomClient";
import { RoomRecorder, recordingSupported, type RecorderTile, type RecordingMode, type RecordingResult } from "./recorder";

// Everything a Teams room page needs, held outside React: the local
// devices, the WebRTC mesh client, the recorder, and the join/leave
// lifecycle. The page subscribes with useSyncExternalStore and builds one of
// these per visit (see useRoomRuntime in RoomPage.tsx, which also makes it
// safe under StrictMode's double-mounting).

export type Phase = "loading" | "lobby" | "joining" | "live" | "ended" | "error";

export interface RecordingState {
  status: "idle" | "recording" | "uploading" | "saved" | "error";
  mode: RecordingMode;
  startedAt: number | null;
  error: string | null;
  // A finished recording that failed to upload, held so it can be retried
  // or saved to disk rather than lost.
  pending: RecordingResult | null;
}

export interface RuntimeState {
  phase: Phase;
  error: string | null;
  endedMessage: string | null;
  // Whether "Rejoin" makes sense on the ended screen (the session itself is
  // still running - we left, were dropped, or were replaced by another tab).
  canRejoin: boolean;
  session: CollabSession | null;
  // Who we are in the room. A visitor only has an id once they've joined.
  me: { id: string; name: string } | null;
  snapshot: RoomSnapshot;
  recording: RecordingState;
  // Short-lived message like "The host muted you".
  notice: string | null;
  // Bumped whenever LocalMedia changes so subscribers re-render.
  mediaVersion: number;
}

const EMPTY_SNAPSHOT: RoomSnapshot = { participants: [], peers: [], messages: [], reconnecting: false, relayConfigured: false };
const NO_POINTERS: RoomPointer[] = [];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

// How one visit reaches the server, and as whom. Two flavours - a signed-in
// staff member, or an external visitor on a guest link - and the room
// doesn't care which: it's handed one of these.
export interface RoomAccess {
  kind: "staff" | "guest";
  // Identifies this room for "was I in it before the page reloaded?".
  key: string;
  // Known up front for staff; a visitor gets theirs by joining.
  me: { id: string; name: string } | null;
  loadSession(): Promise<CollabSession>;
  join(): Promise<{ result: JoinResult; me: { id: string; name: string }; room: RoomApi }>;
  // Staff only: moderation, ending the session, saving a recording.
  control?(input: { action: ControlAction; targetId?: string; all?: boolean }): Promise<unknown>;
  end?(): Promise<unknown>;
  uploadRecording?(blob: Blob, durationSeconds: number): Promise<unknown>;
}

export function staffAccess(sessionId: string, me: { id: string; name: string }): RoomAccess {
  return {
    kind: "staff",
    key: sessionId,
    me,
    loadSession: async () => (await fetchCollabSession(sessionId)).session,
    join: async () => {
      const result = await joinCollabSession(sessionId);
      return { result, me, room: staffRoomApi(sessionId, result.instance) };
    },
    control: (input) => controlCollabSession(sessionId, input),
    end: () => endCollabSession(sessionId),
    uploadRecording: (blob, durationSeconds) => uploadCollabRecording(sessionId, blob, durationSeconds),
  };
}

// What a visitor's browser remembers about a guest link: the name they
// typed and the id they were given, so coming back (a refresh, a dropped
// connection, later the same day) returns them as the same participant.
const GUEST_STORE = "dc_meet_guest:";

export function readGuestIdentity(guestToken: string): { guestId?: string; name?: string } {
  try {
    return JSON.parse(localStorage.getItem(GUEST_STORE + guestToken) ?? "{}") as { guestId?: string; name?: string };
  } catch {
    return {};
  }
}

// `getName` is read at join time - the visitor types it in the lobby.
export function guestAccess(guestToken: string, getName: () => string): RoomAccess {
  return {
    kind: "guest",
    key: `guest:${guestToken}`,
    me: null,
    loadSession: async () => (await fetchGuestSession(guestToken)).session,
    join: async () => {
      const name = getName().trim();
      const result = await joinAsGuest(guestToken, name, readGuestIdentity(guestToken).guestId);
      try {
        localStorage.setItem(GUEST_STORE + guestToken, JSON.stringify({ guestId: result.guestId, name }));
      } catch {
        // Private browsing with storage disabled: they'd just rejoin as a new participant.
      }
      return { result, me: { id: result.guestId, name }, room: guestRoomApi(result.guestKey, result.instance) };
    },
  };
}

// Set while we're in a room, so a reload of the page (or a crash-recovered
// tab) goes straight back in instead of stopping at the lobby. Per tab:
// sessionStorage doesn't leak into other tabs.
const LIVE_FLAG = "dc_room_live:";

function wasLive(key: string): boolean {
  try {
    return sessionStorage.getItem(LIVE_FLAG + key) === "1";
  } catch {
    return false;
  }
}

function setLive(key: string, live: boolean): void {
  try {
    if (live) sessionStorage.setItem(LIVE_FLAG + key, "1");
    else sessionStorage.removeItem(LIVE_FLAG + key);
  } catch {
    // No storage: a refresh just lands in the lobby.
  }
}

export class RoomRuntime {
  readonly media = new LocalMedia();
  readonly access: RoomAccess;

  private state: RuntimeState;
  private listeners = new Set<() => void>();
  private client: RoomClient | null = null;
  private room: RoomApi | null = null;
  private recorder: RoomRecorder | null = null;
  private recorderLocalStream: MediaStream | null = null;
  private recorderLocalKey = "";
  private loading: Promise<void> | null = null;
  private joined = false;
  private disposed = false;
  private autoJoin: boolean;
  private unsubscribeMedia: () => void;
  private noticeTimer: number | null = null;

  // `autoJoin`: skip the lobby (the "Rejoin" button). A page reload does the
  // same on its own - see LIVE_FLAG.
  constructor(access: RoomAccess, options: { autoJoin?: boolean } = {}) {
    this.access = access;
    this.autoJoin = !!options.autoJoin || wasLive(access.key);
    this.state = {
      phase: "loading",
      error: null,
      endedMessage: null,
      canRejoin: false,
      session: null,
      me: access.me,
      snapshot: EMPTY_SNAPSHOT,
      recording: { status: "idle", mode: "video", startedAt: null, error: null, pending: null },
      notice: null,
      mediaVersion: 0,
    };
    this.unsubscribeMedia = this.media.subscribe(() => {
      this.syncOutgoing();
      this.syncRecorderTiles();
      this.patch({ mediaVersion: this.media.getVersion() });
    });
    window.addEventListener("pagehide", this.handlePageHide);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): RuntimeState => this.state;

  private patch(partial: Partial<RuntimeState>): void {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l();
  }

  private patchRecording(partial: Partial<RecordingState>): void {
    this.patch({ recording: { ...this.state.recording, ...partial } });
  }

  // Idempotent: loads the session and starts the camera/mic preview. Safe to
  // call twice (StrictMode) - the second call gets the first's promise.
  load(): Promise<void> {
    this.loading ??= (async () => {
      const mediaReady = this.media.init();
      try {
        const session = await this.access.loadSession();
        if (this.disposed) return;
        if (!session.isOpen) {
          setLive(this.access.key, false);
          this.patch({ session, phase: "ended", endedMessage: session.status === "CANCELLED" ? "This session was cancelled." : "This session has ended." });
          this.media.stopAll();
          return;
        }
        if (!this.callsSupported) {
          // Some embedded and locked-down browsers have no WebRTC at all.
          // Say so here, rather than let them join a room where every
          // connection would fail one after the other.
          this.patch({ session, phase: "lobby", error: "This browser can't make calls. Open this link in an up-to-date Chrome, Edge, Firefox or Safari." });
          return;
        }
        this.patch({ session, phase: "lobby" });
        if (this.autoJoin) {
          // Coming back after a reload, or "Rejoin": straight in, as soon as
          // the devices have been sorted out.
          await mediaReady;
          if (!this.disposed) await this.join();
        }
      } catch (err) {
        if (this.disposed) return;
        setLive(this.access.key, false);
        this.media.stopAll();
        this.patch({ phase: "error", error: errorMessage(err, "Couldn't load this session") });
      }
    })();
    return this.loading;
  }

  get callsSupported(): boolean {
    return typeof RTCPeerConnection === "function";
  }

  async join(): Promise<void> {
    if (this.state.phase !== "lobby" || !this.callsSupported) return;
    this.patch({ phase: "joining", error: null });
    try {
      const { result, me, room } = await this.access.join();
      if (this.disposed) {
        void room.leave().catch(() => {});
        return;
      }
      this.joined = true;
      this.room = room;
      collabLog("joined", { session: result.session.id, me: me.id, instance: result.instance });
      this.client = new RoomClient({
        api: room,
        myId: me.id,
        iceServers: result.iceServers,
        iceTransportPolicy: result.iceTransportPolicy,
        relayConfigured: result.relayConfigured,
        onUpdate: (snapshot) => this.handleSnapshot(snapshot),
        onControl: (action) => {
          if (action === "mute") {
            this.media.muteMic();
            this.showNotice("The host muted your microphone.");
          } else {
            this.media.stopShare();
            this.showNotice("The host stopped your screen share.");
          }
        },
        onClosed: (reason, message) => void this.handleClosed(reason, message),
      });
      this.syncOutgoing();
      this.client.start();
      setLive(this.access.key, true);
      this.patch({ phase: "live", session: result.session, me });
    } catch (err) {
      setLive(this.access.key, false);
      this.patch({ phase: "lobby", error: errorMessage(err, "Couldn't join this session") });
    }
  }

  // Tells people when someone drops out - "left" and "lost connection" are
  // different things to act on.
  private handleSnapshot(snapshot: RoomSnapshot): void {
    const before = this.state.snapshot.peers;
    this.patch({ snapshot });
    this.syncRecorderTiles();
    if (this.state.phase !== "live") return;
    const now = new Set(snapshot.peers.map((p) => p.staffId));
    for (const peer of before) {
      if (now.has(peer.staffId)) continue;
      const listed = snapshot.participants.find((p) => p.staffId === peer.staffId);
      const dropped = listed !== undefined && listed.left === false;
      this.showNotice(dropped ? `${peer.name} lost their connection. They'll reappear if they reconnect.` : `${peer.name} left the session.`);
    }
  }

  // --- local devices ---

  private syncOutgoing(): void {
    this.client?.setOutgoing(this.media.audioTrack, this.media.outgoingVideo, {
      audio: this.media.micOn,
      video: this.media.outgoingVideo !== null,
      screen: this.media.sharing,
    });
  }

  toggleMic = (): void => void this.media.toggleMic();
  toggleCamera = (): void => void this.media.toggleCamera();
  toggleShare = (): void => {
    if (this.media.sharing) this.media.stopShare();
    else void this.media.startShare();
  };
  // After fixing a permission or plugging a device in.
  retryDevices = (): void => void this.media.retry();

  async sendMessage(body: string): Promise<void> {
    await this.client?.sendMessage(body);
  }

  // Drop the connections that aren't working and try them again right now.
  retryConnections = (): void => this.client?.retry();

  // --- pointing at a shared screen (see RoomClient.sendPointer) ---

  subscribePointers = (listener: () => void): (() => void) => this.client?.subscribePointers(listener) ?? (() => {});
  getPointers = (): RoomPointer[] => this.client?.getPointers() ?? NO_POINTERS;
  sendPointer = (target: string, at: { x: number; y: number } | null): void => this.client?.sendPointer(target, at);

  private showNotice(message: string): void {
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.patch({ notice: message });
    this.noticeTimer = window.setTimeout(() => this.patch({ notice: null }), 6000);
  }

  // Host/admin moderation (the server checks permission).
  async control(action: ControlAction, targetId?: string): Promise<void> {
    if (!this.access.control) return;
    try {
      await this.access.control(targetId ? { action, targetId } : { action, all: true });
    } catch (err) {
      this.showNotice(errorMessage(err, "That didn't work"));
    }
  }

  // --- leaving / ending ---

  // The page is going away (closed, reloaded, navigated). Tell the server
  // now, with a request that outlives the page, so the others see us go at
  // once instead of staring at a frozen tile until our presence times out.
  private handlePageHide = (): void => {
    if (this.joined) void this.room?.leave(true).catch(() => {});
  };

  private async handleClosed(reason: ClosedReason, message: string): Promise<void> {
    collabLog("room closed", { reason, message });
    // Whatever was being recorded is still worth keeping.
    await this.finishRecording();
    this.media.stopAll();
    setLive(this.access.key, false);
    const wasJoined = this.joined;
    this.joined = false;
    // Not when another tab took over: that tab is the participant now, and
    // "leave" is about it, not us.
    if (wasJoined && reason !== "superseded") void this.room?.leave().catch(() => {});
    if (this.disposed) return;
    if (reason === "ended") {
      this.patch({ phase: "ended", endedMessage: message, canRejoin: false });
    } else if (reason === "superseded") {
      this.patch({ phase: "ended", endedMessage: "You joined this session from another tab or device, so this one was disconnected.", canRejoin: true });
    } else if (this.state.phase === "live") {
      // A refused poll mid-call means the host removed us (or we were
      // dropped) - not a failure to open the session.
      this.patch({ phase: "ended", endedMessage: "You were removed from this session, or your connection was lost.", canRejoin: true });
    } else {
      this.patch({ phase: "error", error: message });
    }
  }

  async leave(): Promise<void> {
    await this.finishRecording();
    setLive(this.access.key, false);
    this.client?.stop();
    this.client = null;
    if (this.joined) {
      this.joined = false;
      await this.room?.leave().catch(() => {});
    }
    this.media.stopAll();
    if (!this.disposed) this.patch({ phase: "ended", endedMessage: "You left the session.", canRejoin: true });
  }

  async endForEveryone(): Promise<void> {
    await this.access.end?.();
    await this.leave();
    if (!this.disposed) this.patch({ canRejoin: false });
  }

  // Called on unmount (or when the user navigates away mid-call): tear down
  // without waiting on anything, but still try to save a recording in flight.
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("pagehide", this.handlePageHide);
    this.unsubscribeMedia();
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.client?.stop();
    this.client = null;
    void this.finishRecording();
    this.media.stopAll();
    setLive(this.access.key, false);
    if (this.joined) {
      this.joined = false;
      void this.room?.leave().catch(() => {});
    }
  }

  // --- recording ---

  get recordingSupported(): boolean {
    return recordingSupported() && this.access.uploadRecording !== undefined;
  }

  private get myName(): string {
    return this.state.me?.name ?? "You";
  }

  private buildRecorderTiles(): RecorderTile[] {
    const tracks = [this.media.audioTrack, this.media.outgoingVideo].filter((t): t is MediaStreamTrack => t !== null);
    // Same MediaStream instance until the tracks change, so the recorder
    // doesn't keep re-attaching the local tile's <video>.
    const key = tracks.map((t) => t.id).join("|");
    if (key !== this.recorderLocalKey) {
      this.recorderLocalStream = new MediaStream(tracks);
      this.recorderLocalKey = key;
    }

    return [
      {
        id: "me",
        label: this.myName,
        stream: this.recorderLocalStream ?? new MediaStream(),
        screen: this.media.sharing,
        videoOn: this.media.outgoingVideo !== null,
      },
      ...this.state.snapshot.peers.map((p) => ({
        id: p.staffId,
        label: p.name,
        stream: p.stream,
        screen: p.screen,
        videoOn: p.video,
      })),
    ];
  }

  private syncRecorderTiles(): void {
    this.recorder?.setTiles(this.buildRecorderTiles());
  }

  startRecording(mode: RecordingMode): void {
    if (this.recorder || this.state.phase !== "live") return;
    try {
      const recorder = new RoomRecorder(mode, () => void this.stopRecording());
      recorder.start(this.buildRecorderTiles());
      this.recorder = recorder;
      this.patchRecording({ status: "recording", mode, startedAt: Date.now(), error: null, pending: null });
      // Everyone in the room gets told - nobody should be recorded silently.
      void this.client?.sendMessage(`● ${this.myName} started recording this session.`).catch(() => {});
    } catch (err) {
      this.patchRecording({ status: "error", error: errorMessage(err, "Couldn't start recording") });
    }
  }

  async stopRecording(): Promise<void> {
    await this.finishRecording();
  }

  // Stops the recorder (if any) and uploads what it captured.
  private async finishRecording(): Promise<void> {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    this.patchRecording({ status: "uploading" });
    let result: RecordingResult;
    try {
      result = await recorder.stop();
    } catch (err) {
      this.patchRecording({ status: "error", startedAt: null, error: errorMessage(err, "Recording failed") });
      return;
    }
    await this.upload(result);
    void this.client?.sendMessage(`■ ${this.myName} stopped recording.`).catch(() => {});
  }

  private async upload(result: RecordingResult): Promise<void> {
    this.patchRecording({ status: "uploading", startedAt: null, error: null, pending: result });
    try {
      await this.access.uploadRecording?.(result.blob, result.durationSeconds);
      this.patchRecording({ status: "saved", pending: null });
    } catch (err) {
      this.patchRecording({ status: "error", error: errorMessage(err, "Couldn't save the recording"), pending: result });
    }
  }

  async retryUpload(): Promise<void> {
    const pending = this.state.recording.pending;
    if (pending) await this.upload(pending);
  }

  discardPending(): void {
    this.patchRecording({ status: "idle", error: null, pending: null });
  }
}
