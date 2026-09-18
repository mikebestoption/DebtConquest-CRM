import { ApiError } from "../../api/client";
import {
  endCollabSession,
  fetchCollabSession,
  joinCollabSession,
  leaveCollabSession,
  uploadCollabRecording,
  type CollabSession,
} from "../../api/collab";
import { LocalMedia } from "./media";
import { RoomClient, type RoomSnapshot } from "./roomClient";
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
  session: CollabSession | null;
  snapshot: RoomSnapshot;
  recording: RecordingState;
  // Bumped whenever LocalMedia changes so subscribers re-render.
  mediaVersion: number;
}

const EMPTY_SNAPSHOT: RoomSnapshot = { participants: [], peers: [], messages: [], reconnecting: false };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

export class RoomRuntime {
  readonly media = new LocalMedia();

  private sessionId: string;
  private myId: string;
  private myName: string;
  private state: RuntimeState;
  private listeners = new Set<() => void>();
  private client: RoomClient | null = null;
  private recorder: RoomRecorder | null = null;
  private recorderLocalStream: MediaStream | null = null;
  private recorderLocalKey = "";
  private loading: Promise<void> | null = null;
  private joined = false;
  private disposed = false;
  private unsubscribeMedia: () => void;

  constructor(sessionId: string, me: { id: string; name: string }) {
    this.sessionId = sessionId;
    this.myId = me.id;
    this.myName = me.name;
    this.state = {
      phase: "loading",
      error: null,
      endedMessage: null,
      session: null,
      snapshot: EMPTY_SNAPSHOT,
      recording: { status: "idle", mode: "video", startedAt: null, error: null, pending: null },
      mediaVersion: 0,
    };
    this.unsubscribeMedia = this.media.subscribe(() => {
      this.syncOutgoing();
      this.syncRecorderTiles();
      this.patch({ mediaVersion: this.media.getVersion() });
    });
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
      void this.media.init();
      try {
        const { session } = await fetchCollabSession(this.sessionId);
        if (this.disposed) return;
        if (!session.isOpen) {
          this.patch({ session, phase: "ended", endedMessage: session.status === "CANCELLED" ? "This session was cancelled." : "This session has ended." });
          this.media.stopAll();
          return;
        }
        this.patch({ session, phase: "lobby" });
      } catch (err) {
        if (this.disposed) return;
        this.media.stopAll();
        this.patch({ phase: "error", error: errorMessage(err, "Couldn't load this session") });
      }
    })();
    return this.loading;
  }

  async join(): Promise<void> {
    if (this.state.phase !== "lobby") return;
    this.patch({ phase: "joining", error: null });
    try {
      const res = await joinCollabSession(this.sessionId);
      if (this.disposed) {
        void leaveCollabSession(this.sessionId).catch(() => {});
        return;
      }
      this.joined = true;
      this.client = new RoomClient({
        sessionId: this.sessionId,
        myId: this.myId,
        iceServers: res.iceServers,
        onUpdate: (snapshot) => {
          this.patch({ snapshot });
          this.syncRecorderTiles();
        },
        onClosed: (reason, message) => void this.handleClosed(reason, message),
      });
      this.syncOutgoing();
      this.client.start();
      this.patch({ phase: "live", session: res.session });
    } catch (err) {
      this.patch({ phase: "lobby", error: errorMessage(err, "Couldn't join this session") });
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

  toggleMic = (): void => this.media.toggleMic();
  toggleCamera = (): void => void this.media.toggleCamera();
  toggleShare = (): void => {
    if (this.media.sharing) this.media.stopShare();
    else void this.media.startShare();
  };

  async sendMessage(body: string): Promise<void> {
    await this.client?.sendMessage(body);
  }

  // --- leaving / ending ---

  private async handleClosed(reason: "ended" | "error", message: string): Promise<void> {
    // Whatever was being recorded is still worth keeping.
    await this.finishRecording();
    this.media.stopAll();
    if (this.joined) {
      this.joined = false;
      void leaveCollabSession(this.sessionId).catch(() => {});
    }
    if (this.disposed) return;
    this.patch(reason === "ended" ? { phase: "ended", endedMessage: message } : { phase: "error", error: message });
  }

  async leave(): Promise<void> {
    await this.finishRecording();
    this.client?.stop();
    this.client = null;
    if (this.joined) {
      this.joined = false;
      await leaveCollabSession(this.sessionId).catch(() => {});
    }
    this.media.stopAll();
    if (!this.disposed) this.patch({ phase: "ended", endedMessage: "You left the session." });
  }

  async endForEveryone(): Promise<void> {
    await endCollabSession(this.sessionId);
    await this.leave();
  }

  // Called on unmount (or when the user navigates away mid-call): tear down
  // without waiting on anything, but still try to save a recording in flight.
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeMedia();
    this.client?.stop();
    this.client = null;
    void this.finishRecording();
    this.media.stopAll();
    if (this.joined) {
      this.joined = false;
      void leaveCollabSession(this.sessionId).catch(() => {});
    }
  }

  // --- recording ---

  get recordingSupported(): boolean {
    return recordingSupported();
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

    const names = new Map(this.state.snapshot.participants.map((p) => [p.staffId, p.name]));
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
        label: names.get(p.staffId) ?? "Participant",
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
      await uploadCollabRecording(this.sessionId, result.blob, result.durationSeconds);
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
