import { ApiError } from "../../api/client";
import type { CollabParticipant, CollabSessionStatus, IceConfig, OutboundSignal, RoomApi, RoomMessage, RoomSignal } from "../../api/collab";
import { collabLog } from "./debug";

// The live half of a Teams room: a full-mesh WebRTC connection to every other
// person in the room. There is no signaling socket - offers, answers and ICE
// candidates are relayed through the server's signal/poll endpoints (see
// RoomApi), and this class polls roughly once a second.
//
// Who offers is fixed: the person with the lexicographically smaller id is
// always the offerer, so two offers can never cross. Camera/screen changes
// swap tracks with RTCRtpSender.replaceTrack instead of renegotiating; the
// only renegotiation a connection ever sees is an ICE restart (same tracks,
// new network path), which the offerer starts. Each connection carries a
// random `connId` so a signal meant for a connection that has since been
// torn down (e.g. the other person refreshed their tab) can't be applied to
// its replacement.
//
// Recovery, in order of cost (see supervise()):
//   - a blip ("disconnected" for a few seconds) is waited out;
//   - a working connection that drops gets an ICE restart;
//   - an attempt that can't be completed, or a restart that doesn't take, is
//     thrown away and rebuilt, backing off between tries;
//   - the answering side, which can't start any of that, asks the offering
//     side to (a "nudge") instead of waiting in silence.

const POLL_INTERVAL_MS = 800;
// While a connection is being set up, each step of the handshake waits for
// the other side's next poll - so for those few seconds, poll faster.
const NEGOTIATING_POLL_MS = 300;
const NEGOTIATING_WINDOW_MS = 6_000;
// A server call that hasn't answered by now is abandoned and retried. Without
// a deadline, one request stuck on a dead connection stalled the whole room:
// nothing was polled or sent again until the browser gave up on it, minutes
// later.
const REQUEST_TIMEOUT_MS = 10_000;
// After this long still "connecting" we tell the user something's off rather
// than leaving a spinner that might never resolve.
const SLOW_AFTER_MS = 7_000;
// ...and after this long with nothing to show for it, that we can't connect.
const FAILED_AFTER_MS = 22_000;
// Offer sent, no answer back.
const ANSWER_TIMEOUT_MS = 12_000;
// Both descriptions in hand, ICE still hasn't found a path.
const ICE_TIMEOUT_MS = 15_000;
// "disconnected" often heals by itself inside this.
const DISCONNECT_GRACE_MS = 4_000;
// An ICE restart that hasn't brought the connection back.
const RESTART_TIMEOUT_MS = 10_000;
const MAX_ICE_RESTARTS = 2;
// A connection that used to work and has been down this long reads as
// "can't connect" rather than "reconnecting".
const RECONNECT_FAILED_AFTER_MS = 25_000;
// How long the answering side waits for an offer before asking for one, and
// how often it asks again.
const NUDGE_AFTER_MS = 5_000;
const NUDGE_EVERY_MS = 5_000;
// How long a call that's still flowing is kept after the server stops
// hearing from its other end (their signaling is struggling; media isn't).
const AWAY_GRACE_MS = 45_000;
// How far back each poll re-asks - see safeCursors().
const CURSOR_OVERLAP_MS = 4_000;
// Wait before the 1st, 2nd, ... rebuild of a connection that keeps failing.
const RETRY_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000];
// A pointer nobody has refreshed for this long is gone (its sender repeats
// it about once a second while they're still pointing).
const POINTER_TTL_MS = 3_000;
const POINTER_MIN_INTERVAL_MS = 40;
// What we announce over the data channel. 2 = understands pointer messages.
const PROTOCOL_VERSION = 2;

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

export interface PeerMediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

// How the connection to one person is going, for the UI:
//   connected    - media is flowing
//   connecting   - negotiating (normal for a few seconds)
//   slow         - still not up after SLOW_AFTER_MS; likely a network problem
//   reconnecting - it was working and dropped; bringing it back
//   failed       - no luck for a good while (still retrying in the background)
export type PeerLink = "connected" | "connecting" | "slow" | "reconnecting" | "failed";

export interface RemotePeer extends PeerMediaState {
  staffId: string;
  name: string;
  // An external visitor rather than a staff member.
  guest: boolean;
  stream: MediaStream;
  connectionState: RTCPeerConnectionState;
  link: PeerLink;
}

export interface RoomSnapshot {
  participants: CollabParticipant[];
  peers: RemotePeer[];
  messages: RoomMessage[];
  // The server can't be reached (signaling) - calls already up keep going.
  reconnecting: boolean;
  // Whether the server offers a TURN relay (see IceConfig) - decides what
  // advice to give when connections won't come up.
  relayConfigured: boolean;
}

// Someone pointing at a shared screen. x/y are fractions of the shared
// picture (0-1 from its top-left corner), so they land on the same spot
// whatever size each person is viewing it at.
export interface RoomPointer {
  from: string;
  name: string;
  // Whose shared screen is being pointed at.
  target: string;
  x: number;
  y: number;
  at: number;
}

interface Peer {
  staffId: string;
  connId: string;
  remoteJoinedAt: string | null;
  pc: RTCPeerConnection;
  stream: MediaStream;
  channel: RTCDataChannel | null;
  pendingCandidates: RTCIceCandidateInit[];
  hasRemote: boolean;
  // When the remote description went in - ICE has had since then to connect.
  remoteAt: number | null;
  media: PeerMediaState;
  // Until the peer's data channel reports its real state, fall back to
  // guessing from whether video is actually arriving.
  gotMediaState: boolean;
  // PROTOCOL_VERSION the other side announced (1 = predates it).
  remoteVersion: number;
  startedAt: number;
  everConnected: boolean;
  // When it last stopped being connected (null while it's fine, or before
  // it ever was).
  troubleSince: number | null;
  // 0 = first negotiation; +1 for every ICE restart on this connection.
  gen: number;
  // When the ICE restart now in progress was started.
  restartAt: number | null;
  restarts: number;
  // ICE candidates we gathered before our offer/answer was queued for
  // sending - they must go out after it, or the other side has no peer to
  // attach them to and drops them.
  outboundReady: boolean;
  earlyLocal: RTCIceCandidateInit[];
  localCandidateTypes: Set<string>;
  remoteCandidateCount: number;
}

// Per person we're trying to reach. Outlives individual RTCPeerConnections
// so the UI tells one story across retries instead of starting over with
// every new attempt.
interface Health {
  // When we started trying to reach them.
  since: number;
  failures: number;
  everConnected: boolean;
  // When a connection that had been working was lost (null while it's up).
  downSince: number | null;
  nextAttemptAt: number;
  lastNudgeAt: number;
  // When the server stopped hearing from them without their having left.
  awaySince: number | null;
}

interface SignalPayload {
  connId: string;
  // Absent/0 = the connection's first negotiation; n = its nth ICE restart.
  gen?: number;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  // The answering side asking the offering side to (re)connect. Travels as
  // a "candidate" signal with no candidate in it, so a server or client that
  // predates it just ignores it. connId = the connection the sender holds
  // ("" for none); the value is why it's asking, for the logs.
  nudge?: string;
  action?: string;
}

type QueuedSignal = OutboundSignal & { connId: string };

export type ClosedReason = "ended" | "error" | "superseded";

export interface RoomClientOptions extends IceConfig {
  api: RoomApi;
  myId: string;
  onUpdate: (snapshot: RoomSnapshot) => void;
  // The host asked us to mute or stop sharing (server-verified: only the
  // moderation endpoint can create these signals).
  onControl: (action: "mute" | "stop-share") => void;
  // The visit is over: the session ended for everyone, the server no longer
  // lets us in, or this person joined again from another tab or device.
  onClosed: (reason: ClosedReason, message: string) => void;
}

// A deadline for one server call. Falls back to a manual timer where
// AbortSignal.timeout isn't available yet.
function deadline(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// Calls `fn` once after `ms`; returns a function that cancels it.
function after(ms: number, fn: () => void): () => void {
  const timer = window.setTimeout(fn, ms);
  return () => window.clearTimeout(timer);
}

export class RoomClient {
  private api: RoomApi;
  private myId: string;
  private iceConfig: IceConfig;
  private onUpdate: (snapshot: RoomSnapshot) => void;
  private onClosed: (reason: ClosedReason, message: string) => void;
  private onControl: (action: "mute" | "stop-share") => void;

  private peers = new Map<string, Peer>();
  private health = new Map<string, Health>();
  // Stand-in streams for people in the room we have no live connection to yet.
  private placeholders = new Map<string, MediaStream>();
  // Candidates that arrive before the offer that introduces their connection.
  private orphanCandidates = new Map<string, RTCIceCandidateInit[]>();
  // Names outlive the participant list (a visitor's list only has who's
  // currently around), so a tile we're still connected to keeps its name.
  private names = new Map<string, { name: string; guest: boolean }>();
  private outbound: QueuedSignal[] = [];
  private participants: CollabParticipant[] = [];
  private messages: RoomMessage[] = [];
  private signalHigh = 0;
  private messageHigh = 0;
  private cursorTrail: { at: number; signal: number; message: number }[] = [];
  private seenSignals = new Set<number>();
  private stopped = false;
  private started = false;
  private failures = 0;
  private reconnecting = false;
  private wake: (() => void) | null = null;
  private cancelFlush: (() => void) | null = null;
  private flushing = false;
  // Smoothed duration of a poll round trip - see slack().
  private rtt = 0;

  private audioTrack: MediaStreamTrack | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private localMedia: PeerMediaState = { audio: false, video: false, screen: false };

  // One pointer per person, keyed by who's pointing.
  private pointers = new Map<string, RoomPointer>();
  private pointerSnapshot: RoomPointer[] = [];
  private pointerListeners = new Set<() => void>();
  private lastPointerSent = 0;

  constructor(options: RoomClientOptions) {
    this.api = options.api;
    this.myId = options.myId;
    this.iceConfig = { iceServers: options.iceServers, iceTransportPolicy: options.iceTransportPolicy, relayConfigured: options.relayConfigured };
    this.onUpdate = options.onUpdate;
    this.onClosed = options.onClosed;
    this.onControl = options.onControl;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    collabLog("room client started", { me: this.myId, relay: this.iceConfig.relayConfigured, policy: this.iceConfig.iceTransportPolicy });
    void this.loop();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelFlush?.();
    for (const staffId of [...this.peers.keys()]) this.closePeer(staffId, "leaving the room", true);
    this.wake?.();
  }

  // Swap what's being sent to everyone (mic mute is handled by the track's
  // own `enabled`; this is for a track appearing/disappearing/replaced).
  setOutgoing(audio: MediaStreamTrack | null, video: MediaStreamTrack | null, state: PeerMediaState): void {
    this.audioTrack = audio;
    this.videoTrack = video;
    this.localMedia = state;
    for (const peer of this.peers.values()) {
      this.applyLocalTracks(peer.pc);
      this.sendMediaState(peer);
    }
  }

  async sendMessage(body: string): Promise<void> {
    await this.api.sendMessage(body);
    // Don't wait out the rest of the poll interval to show our own message.
    this.wake?.();
  }

  // "Try again now": drop every connection that isn't working and start
  // over with a clean slate instead of waiting out the automatic retries.
  retry(): void {
    if (this.stopped) return;
    const now = Date.now();
    for (const [staffId, peer] of [...this.peers]) {
      if (peer.pc.connectionState !== "connected") this.closePeer(staffId, "manual retry", true);
    }
    for (const h of this.health.values()) {
      h.since = now;
      h.failures = 0;
      h.nextAttemptAt = 0;
      h.lastNudgeAt = 0;
      if (h.downSince !== null) h.downSince = now;
    }
    this.emit();
    this.wake?.();
  }

  // --- polling loop ---

  private async loop(): Promise<void> {
    while (!this.stopped) {
      const startedAt = Date.now();
      try {
        await this.tick();
        this.failures = 0;
        if (this.reconnecting) {
          this.reconnecting = false;
          collabLog("signaling restored");
          this.emit();
        }
      } catch (err) {
        if (this.stopped) return;
        if (this.fatal(err)) return;
        this.failures++;
        collabLog("poll failed", { failures: this.failures, error: String(err) });
        if (this.failures >= 3 && !this.reconnecting) {
          this.reconnecting = true;
          this.emit();
        }
      }
      if (this.stopped) return;
      // Ease off while the server is unreachable instead of hammering it.
      const interval = this.failures >= 3 ? 2_000 : this.negotiating() ? NEGOTIATING_POLL_MS : POLL_INTERVAL_MS;
      await new Promise<void>((resolve) => {
        const cancel = after(Math.max(150, interval - (Date.now() - startedAt)), resolve);
        this.wake = () => {
          cancel();
          resolve();
        };
      });
      this.wake = null;
    }
  }

  // A handshake is under way: a connection that's young and not up yet, or
  // someone in the room we're still waiting to hear from.
  private negotiating(): boolean {
    const now = Date.now();
    for (const peer of this.peers.values()) {
      if (peer.pc.connectionState !== "connected" && now - (peer.restartAt ?? peer.startedAt) < NEGOTIATING_WINDOW_MS) return true;
    }
    for (const p of this.participants) {
      if (!p.inRoom || p.staffId === this.myId || this.peers.has(p.staffId)) continue;
      const h = this.health.get(p.staffId);
      if (h && now - h.since < NEGOTIATING_WINDOW_MS) return true;
    }
    return false;
  }

  // The server has said this visit is over - retrying can never succeed.
  private fatal(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false;
    if (err.status === 409) {
      // Joined again from another tab or device; that one owns the room now.
      this.stop();
      this.onClosed("superseded", err.message);
      return true;
    }
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      // Removed from the room, or it's gone.
      this.stop();
      this.onClosed("error", err.message);
      return true;
    }
    return false;
  }

  // Extra time every limit below is given on a slow link. Each step of a
  // handshake waits on a server round trip, so with seconds of latency a
  // fixed limit would cancel attempts that are simply slow - over and over,
  // never connecting. A few round trips' worth, capped.
  private slack(): number {
    return Math.min(30_000, 5 * this.rtt);
  }

  private async tick(): Promise<void> {
    const sentAt = Date.now();
    const res = await this.api.poll(this.safeCursors(), deadline(REQUEST_TIMEOUT_MS));
    if (this.stopped) return;
    const now = Date.now();
    this.rtt = this.rtt === 0 ? now - sentAt : this.rtt * 0.7 + (now - sentAt) * 0.3;

    this.participants = res.participants;
    for (const p of res.participants) this.names.set(p.staffId, { name: p.name, guest: !!p.guest });

    for (const signal of res.signals) {
      this.signalHigh = Math.max(this.signalHigh, signal.id);
      if (this.seenSignals.has(signal.id)) continue;
      this.seenSignals.add(signal.id);
      try {
        await this.handleSignal(signal);
      } catch (err) {
        // A malformed or stale signal must not stall the ones behind it.
        collabLog("signal not applied", { from: signal.from, kind: signal.kind, error: String(err) });
      }
      if (this.stopped) return;
    }
    if (res.messages.length) {
      const seen = new Set(this.messages.map((m) => m.id));
      for (const m of res.messages) {
        this.messageHigh = Math.max(this.messageHigh, m.id);
        if (!seen.has(m.id)) this.messages.push(m);
      }
    }
    this.advanceCursors(now);

    if (this.isClosedStatus(res.sessionStatus)) {
      this.stop();
      this.onClosed("ended", res.sessionStatus === "CANCELLED" ? "This session was cancelled." : "The host ended this session.");
      return;
    }

    await this.supervise();
    this.expirePointers(now);
    this.emit();
    // Not awaited: a slow send must not hold up the next heartbeat (which is
    // what keeps us listed as in the room).
    void this.flushOutbound();
  }

  private isClosedStatus(status: CollabSessionStatus): boolean {
    return status === "ENDED" || status === "CANCELLED";
  }

  // Rows from different senders can commit out of id order, so a strict
  // "everything after the highest id I've seen" cursor can skip one that
  // commits late - a lost offer or answer, and a connection that then sits
  // there until it times out. Each poll therefore asks again from where we
  // were a few seconds ago, and ids already handled are skipped.
  private safeCursors(): { signalSince: number; messageSince: number } {
    const cutoff = Date.now() - CURSOR_OVERLAP_MS;
    let safe = { signal: 0, message: 0 };
    for (const entry of this.cursorTrail) {
      if (entry.at > cutoff) break;
      safe = entry;
    }
    return { signalSince: safe.signal, messageSince: safe.message };
  }

  private advanceCursors(now: number): void {
    this.cursorTrail.push({ at: now, signal: this.signalHigh, message: this.messageHigh });
    // Keep the newest entry that's older than the overlap (the cursor in
    // use) and drop everything behind it.
    const cutoff = now - CURSOR_OVERLAP_MS;
    while (this.cursorTrail.length > 1 && this.cursorTrail[1].at <= cutoff) this.cursorTrail.shift();
    const { signalSince } = this.safeCursors();
    for (const id of this.seenSignals) if (id <= signalSince) this.seenSignals.delete(id);
  }

  // --- keeping the connections healthy ---

  private healthFor(staffId: string): Health {
    let h = this.health.get(staffId);
    if (!h) {
      h = { since: Date.now(), failures: 0, everConnected: false, downSince: null, nextAttemptAt: 0, lastNudgeAt: 0, awaySince: null };
      this.health.set(staffId, h);
    }
    return h;
  }

  // Runs every poll: makes the set of connections match who's in the room,
  // and gets each one that isn't working moving again.
  private async supervise(): Promise<void> {
    const now = Date.now();
    const slack = this.slack();
    const listed = new Map(this.participants.filter((p) => p.staffId !== this.myId).map((p) => [p.staffId, p]));

    for (const [staffId, peer] of [...this.peers]) {
      const p = listed.get(staffId);
      // `left` only comes from newer servers; without it, "not in the room"
      // can only be read as gone.
      const gone = !p || p.left === true || (p.left === undefined && !p.inRoom);
      if (gone) {
        this.closePeer(staffId, "they left");
        continue;
      }
      // Rejoined since this connection was made (a refreshed tab leaves us
      // holding a connection to a peer that no longer exists).
      if (peer.remoteJoinedAt === null) peer.remoteJoinedAt = p.joinedAt;
      else if (p.joinedAt !== peer.remoteJoinedAt) {
        this.closePeer(staffId, "they rejoined");
        continue;
      }
      const h = this.healthFor(staffId);
      if (p.inRoom) {
        h.awaySince = null;
        continue;
      }
      // Joined and hasn't left, but the server hasn't heard from them
      // lately: their signaling is struggling (or their tab is suspended).
      // A call that's still flowing isn't torn down over that.
      h.awaySince ??= now;
      if (peer.pc.connectionState !== "connected" || now - h.awaySince > AWAY_GRACE_MS) this.closePeer(staffId, "they dropped out");
    }

    for (const p of listed.values()) {
      if (!p.inRoom) continue;
      const staffId = p.staffId;
      const h = this.healthFor(staffId);
      const peer = this.peers.get(staffId);
      const iOffer = this.myId < staffId;

      if (!peer) {
        if (iOffer) {
          if (now >= h.nextAttemptAt) await this.startOffer(staffId, p.joinedAt);
        } else if (now - h.since > NUDGE_AFTER_MS + slack && now - h.lastNudgeAt > NUDGE_EVERY_MS + slack) {
          // The other side makes the offers. If none has come, ours may have
          // been lost on the way, or they think they already have us.
          this.nudge(staffId, null, "no-offer");
        }
        continue;
      }

      const state = peer.pc.connectionState;
      if (state === "connected") continue;

      if (!peer.everConnected) {
        // Still on the first negotiation.
        const waitingForAnswer = !peer.hasRemote;
        const waited = now - (waitingForAnswer ? peer.startedAt : (peer.remoteAt ?? peer.startedAt));
        if (state !== "failed" && waited <= (waitingForAnswer ? ANSWER_TIMEOUT_MS : ICE_TIMEOUT_MS) + slack) continue;
        const why = state === "failed" ? "failed" : waitingForAnswer ? "got no answer" : "never found a network path";
        if (iOffer) {
          this.failAttempt(staffId, peer, why);
        } else {
          // Drop our half so the next offer starts clean, and say so.
          h.failures++;
          this.noteFailure(staffId, peer, why);
          this.closePeer(staffId, why);
          this.nudge(staffId, null, "attempt-failed");
        }
        continue;
      }

      // It was working and isn't now.
      peer.troubleSince ??= now;
      h.downSince ??= peer.troubleSince;
      const down = now - peer.troubleSince;
      if (state === "disconnected" && down < DISCONNECT_GRACE_MS) continue;
      if (iOffer) {
        if (peer.restartAt === null || now - peer.restartAt > RESTART_TIMEOUT_MS + slack) await this.recover(staffId, peer);
      } else {
        if (now - h.lastNudgeAt > NUDGE_EVERY_MS + slack) this.nudge(staffId, peer.connId, state);
        // The offering side should long since have restarted or rebuilt it.
        if (down > DISCONNECT_GRACE_MS + (MAX_ICE_RESTARTS + 1) * (RESTART_TIMEOUT_MS + slack)) this.closePeer(staffId, "no recovery from the other side");
      }
    }
  }

  // Bring back a connection that was working: restart ICE on it while there
  // are restarts left, then give up on it and build a new one.
  private async recover(staffId: string, peer: Peer): Promise<void> {
    if (peer.restarts >= MAX_ICE_RESTARTS || peer.pc.signalingState !== "stable") {
      this.failAttempt(staffId, peer, "couldn't be restored");
      return;
    }
    peer.restarts++;
    peer.gen++;
    peer.restartAt = Date.now();
    collabLog("ICE restart", { peer: staffId, attempt: peer.restarts, state: peer.pc.connectionState });
    try {
      const offer = await peer.pc.createOffer({ iceRestart: true });
      await peer.pc.setLocalDescription(offer);
      this.queueSignal(staffId, "offer", { connId: peer.connId, gen: peer.gen, sdp: peer.pc.localDescription!.toJSON() });
    } catch {
      this.failAttempt(staffId, peer, "couldn't be restarted");
    }
  }

  // Give up on this attempt; supervise() starts the next one after a pause
  // that grows while they keep failing.
  private failAttempt(staffId: string, peer: Peer, why: string): void {
    const h = this.healthFor(staffId);
    h.failures++;
    h.nextAttemptAt = Date.now() + RETRY_DELAYS_MS[Math.min(h.failures - 1, RETRY_DELAYS_MS.length - 1)] + Math.random() * 300;
    this.noteFailure(staffId, peer, why);
    this.closePeer(staffId, why);
  }

  private noteFailure(staffId: string, peer: Peer, why: string): void {
    // Diagnostics for whoever ends up debugging a network: the candidate
    // types tell you at a glance whether a relay was ever in play.
    console.warn(
      `[teams] connection to ${staffId} ${why}. local candidates: ${[...peer.localCandidateTypes].join(", ") || "none"}; ` +
        `remote candidates received: ${peer.remoteCandidateCount}; ice: ${peer.pc.iceConnectionState}; relay configured: ${this.iceConfig.relayConfigured}`,
    );
  }

  private nudge(to: string, have: string | null, reason: string): void {
    this.healthFor(to).lastNudgeAt = Date.now();
    collabLog("asking the other side to (re)connect", { peer: to, have, reason });
    this.queueSignal(to, "candidate", { connId: have ?? "", nudge: reason });
  }

  private logSelectedPath(staffId: string, pc: RTCPeerConnection): void {
    void pc
      .getStats()
      .then((stats) => {
        let pair: { localCandidateId?: string; remoteCandidateId?: string } | undefined;
        stats.forEach((r) => {
          if (r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
          // Firefox reports no transport: its candidate pairs say which one is in use.
          else if (!pair && r.type === "candidate-pair" && r.selected) pair = r;
        });
        const local = pair?.localCandidateId ? stats.get(pair.localCandidateId) : undefined;
        const remote = pair?.remoteCandidateId ? stats.get(pair.remoteCandidateId) : undefined;
        console.info(`[teams] connected to ${staffId} via local ${local?.candidateType ?? "?"} / remote ${remote?.candidateType ?? "?"}`);
      })
      .catch(() => {});
  }

  // --- peers ---

  private createConnection(): RTCPeerConnection {
    try {
      return new RTCPeerConnection({ iceServers: this.iceConfig.iceServers, iceTransportPolicy: this.iceConfig.iceTransportPolicy });
    } catch (err) {
      // One malformed relay entry makes the browser refuse the whole list.
      // Better a call over the built-in STUN servers than no call at all.
      console.warn("[teams] the configured ICE servers were rejected by the browser - falling back to STUN only", err);
      this.iceConfig = { iceServers: FALLBACK_ICE_SERVERS, iceTransportPolicy: "all", relayConfigured: false };
      return new RTCPeerConnection({ iceServers: FALLBACK_ICE_SERVERS });
    }
  }

  private makePeer(staffId: string, connId: string, remoteJoinedAt: string | null): Peer {
    const pc = this.createConnection();
    const stream = new MediaStream();
    const peer: Peer = {
      staffId,
      connId,
      remoteJoinedAt,
      pc,
      stream,
      channel: null,
      pendingCandidates: [],
      hasRemote: false,
      remoteAt: null,
      media: { audio: true, video: false, screen: false },
      gotMediaState: false,
      remoteVersion: 1,
      startedAt: Date.now(),
      everConnected: false,
      troubleSince: null,
      gen: 0,
      restartAt: null,
      restarts: 0,
      outboundReady: false,
      earlyLocal: [],
      localCandidateTypes: new Set(),
      remoteCandidateCount: 0,
    };

    pc.ontrack = (e) => {
      collabLog("track", { peer: staffId, kind: e.track.kind });
      if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track);
      if (e.track.kind === "video") {
        e.track.addEventListener("unmute", () => {
          if (!peer.gotMediaState) peer.media.video = true;
          this.emit();
        });
        e.track.addEventListener("mute", () => {
          if (!peer.gotMediaState) peer.media.video = false;
          this.emit();
        });
      }
      this.emit();
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      peer.localCandidateTypes.add(e.candidate.type ?? "unknown");
      const candidate = e.candidate.toJSON();
      if (peer.outboundReady) this.queueSignal(staffId, "candidate", { connId, candidate });
      else peer.earlyLocal.push(candidate);
    };
    pc.onicecandidateerror = (e) => {
      // 701 with a TURN url here is the first sign of a relay that can't be
      // reached or rejects its credentials.
      collabLog("ICE candidate error", { peer: staffId, code: e.errorCode, text: e.errorText, url: e.url });
    };
    pc.onconnectionstatechange = () => {
      if (this.peers.get(staffId) !== peer) return;
      const state = pc.connectionState;
      collabLog("connection state", { peer: staffId, state, ice: pc.iceConnectionState });
      const h = this.healthFor(staffId);
      if (state === "connected") {
        peer.everConnected = true;
        peer.troubleSince = null;
        peer.restartAt = null;
        peer.restarts = 0;
        h.everConnected = true;
        h.failures = 0;
        h.downSince = null;
        this.logSelectedPath(staffId, pc);
      } else if (peer.everConnected) {
        // Lost a working connection. supervise() decides what to do about
        // it - run it now rather than at the end of the poll interval.
        peer.troubleSince ??= Date.now();
        h.downSince ??= peer.troubleSince;
        this.wake?.();
      } else if (state === "failed") {
        this.wake?.();
      }
      this.emit();
    };
    pc.oniceconnectionstatechange = () => {
      collabLog("ICE state", { peer: staffId, ice: pc.iceConnectionState });
      this.emit();
    };
    pc.onsignalingstatechange = () => collabLog("signaling state", { peer: staffId, state: pc.signalingState });
    pc.ondatachannel = (e) => this.attachChannel(peer, e.channel);

    this.peers.set(staffId, peer);
    return peer;
  }

  // Our offer/answer is now queued, so candidates gathered meanwhile can follow it.
  private releaseEarlyCandidates(peer: Peer): void {
    peer.outboundReady = true;
    for (const candidate of peer.earlyLocal.splice(0)) this.queueSignal(peer.staffId, "candidate", { connId: peer.connId, candidate });
  }

  private attachChannel(peer: Peer, channel: RTCDataChannel): void {
    peer.channel = channel;
    channel.onopen = () => this.sendMediaState(peer);
    // The answering side receives the channel already open (onopen never
    // fires for it), so announce our state right away in that case too.
    this.sendMediaState(peer);
    channel.onmessage = (e) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(String(e.data)) as Record<string, unknown>;
      } catch {
        return; // ignore garbage
      }
      if (data.t === "ptr") {
        this.onRemotePointer(peer.staffId, data);
        return;
      }
      peer.media = { audio: !!data.audio, video: !!data.video, screen: !!data.screen };
      peer.gotMediaState = true;
      peer.remoteVersion = typeof data.v === "number" ? data.v : 1;
      // Someone who stops sharing isn't being pointed at any more.
      if (!peer.media.screen) this.dropPointersAt(peer.staffId);
      this.emit();
    };
  }

  private sendMediaState(peer: Peer): void {
    if (peer.channel?.readyState === "open") peer.channel.send(JSON.stringify({ ...this.localMedia, v: PROTOCOL_VERSION }));
  }

  private applyLocalTracks(pc: RTCPeerConnection): void {
    for (const t of pc.getTransceivers()) {
      const kind = t.receiver.track.kind;
      const track = kind === "audio" ? this.audioTrack : this.videoTrack;
      if (t.direction !== "sendrecv" && t.direction !== "stopped") t.direction = "sendrecv";
      void t.sender.replaceTrack(track).catch(() => {});
    }
  }

  private async startOffer(staffId: string, remoteJoinedAt: string | null): Promise<void> {
    let peer: Peer;
    try {
      peer = this.makePeer(staffId, crypto.randomUUID(), remoteJoinedAt);
    } catch (err) {
      // Couldn't even create a connection object - try again later rather
      // than failing the whole poll cycle on it.
      const h = this.healthFor(staffId);
      h.failures++;
      h.nextAttemptAt = Date.now() + RETRY_DELAYS_MS[Math.min(h.failures - 1, RETRY_DELAYS_MS.length - 1)];
      console.warn(`[teams] couldn't start a connection to ${staffId}`, err);
      return;
    }
    const { pc, connId } = peer;
    collabLog("offering", { peer: staffId, connId });
    try {
      this.attachChannel(peer, pc.createDataChannel("state"));
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      this.applyLocalTracks(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.queueSignal(staffId, "offer", { connId, gen: 0, sdp: pc.localDescription!.toJSON() });
      this.releaseEarlyCandidates(peer);
    } catch {
      this.failAttempt(staffId, peer, "couldn't create an offer");
    }
  }

  private async handleSignal(signal: RoomSignal): Promise<void> {
    const data = JSON.parse(signal.payload) as SignalPayload;
    const from = signal.from;

    if (signal.kind === "control") {
      if (data.action === "mute" || data.action === "stop-share") this.onControl(data.action);
      return;
    }
    if (signal.kind === "offer") {
      await this.handleOffer(from, data);
      return;
    }
    if (signal.kind === "candidate" && data.nudge !== undefined) {
      await this.handleNudge(from, data);
      return;
    }

    const peer = this.peers.get(from);
    if (!peer && signal.kind === "candidate" && data.candidate && data.connId) {
      const key = `${from}:${data.connId}`;
      const list = this.orphanCandidates.get(key) ?? [];
      list.push(data.candidate);
      this.orphanCandidates.set(key, list);
      // Bounded: stale keys from abandoned connections shouldn't pile up.
      if (this.orphanCandidates.size > 20) this.orphanCandidates.delete(this.orphanCandidates.keys().next().value as string);
      return;
    }
    if (!peer || peer.connId !== data.connId) return;

    if (signal.kind === "answer") {
      if (!data.sdp) return;
      const gen = data.gen ?? 0;
      // An answer to an earlier (re)offer than the one outstanding, or one
      // we've already applied.
      if (gen !== peer.gen || peer.pc.signalingState !== "have-local-offer") return;
      collabLog("answer received", { peer: from, gen });
      await peer.pc.setRemoteDescription(data.sdp);
      peer.hasRemote = true;
      peer.remoteAt = Date.now();
      await this.drainCandidates(peer);
    } else if (signal.kind === "candidate" && data.candidate) {
      peer.remoteCandidateCount++;
      if (peer.hasRemote) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
      else peer.pendingCandidates.push(data.candidate);
    }
  }

  private async handleOffer(from: string, data: SignalPayload): Promise<void> {
    if (!data.sdp || !data.connId) return;
    const gen = data.gen ?? 0;
    const existing = this.peers.get(from);

    if (existing?.connId === data.connId) {
      if (gen <= existing.gen) return; // duplicate delivery
      // An ICE restart on the connection we already share: same tracks and
      // data channel, just a new network path.
      collabLog("ICE restart offer received", { peer: from, gen });
      existing.gen = gen;
      try {
        await existing.pc.setRemoteDescription(data.sdp);
        const answer = await existing.pc.createAnswer();
        await existing.pc.setLocalDescription(answer);
        this.queueSignal(from, "answer", { connId: data.connId, gen, sdp: existing.pc.localDescription!.toJSON() });
      } catch {
        // Couldn't apply it - drop our half and ask for a clean connection.
        this.closePeer(from, "couldn't apply an ICE restart");
        this.nudge(from, null, "restart-failed");
      }
      return;
    }
    if (gen > 0) {
      // A restart of a connection we don't hold (any more).
      this.nudge(from, existing?.connId ?? null, "unknown-connection");
      return;
    }

    if (existing) this.closePeer(from, "replaced by a new offer", true);
    const remote = this.participants.find((p) => p.staffId === from);
    const peer = this.makePeer(from, data.connId, remote?.joinedAt ?? null);
    const { pc } = peer;
    collabLog("offer received", { peer: from, connId: data.connId });
    try {
      await pc.setRemoteDescription(data.sdp);
      peer.hasRemote = true;
      peer.remoteAt = Date.now();
      this.applyLocalTracks(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
    } catch {
      // Left in place it would look like a connection in progress for as
      // long as its timeout; say so now and let the offerer try again.
      this.closePeer(from, "couldn't answer the offer");
      this.nudge(from, null, "answer-failed");
      return;
    }
    this.queueSignal(from, "answer", { connId: data.connId, gen: 0, sdp: pc.localDescription!.toJSON() });
    this.releaseEarlyCandidates(peer);
    // Candidates that beat the offer here.
    const orphaned = this.orphanCandidates.get(`${from}:${data.connId}`);
    if (orphaned) {
      peer.pendingCandidates.push(...orphaned);
      this.orphanCandidates.delete(`${from}:${data.connId}`);
    }
    await this.drainCandidates(peer);
  }

  // The answering side says it has no working connection to us.
  private async handleNudge(from: string, data: SignalPayload): Promise<void> {
    // Only the side that makes the offers can do anything about it.
    if (!(this.myId < from)) return;
    const h = this.healthFor(from);
    const peer = this.peers.get(from);
    const theyHave = data.connId || null;
    collabLog("asked to (re)connect", { peer: from, theyHave, weHave: peer?.connId ?? null, reason: data.nudge });
    if (!peer) {
      h.nextAttemptAt = 0; // supervise() offers on this same tick
      return;
    }
    const now = Date.now();
    if (theyHave !== peer.connId) {
      // They don't hold this connection: our offer never reached them, or
      // they gave up on their half. One that only just went out may simply
      // still be on its way.
      if (now - peer.startedAt < 3_000 + this.slack()) return;
      this.closePeer(from, "the other side doesn't have this connection");
      h.nextAttemptAt = 0;
      return;
    }
    // Same connection, but it isn't working at their end. While it's still
    // being set up our own timeouts cover it; once it has worked, restart it
    // now rather than waiting to notice the problem ourselves.
    if (!peer.everConnected) return;
    if (peer.restartAt !== null && now - peer.restartAt < RESTART_TIMEOUT_MS + this.slack()) return;
    peer.troubleSince ??= now;
    await this.recover(from, peer);
  }

  private async drainCandidates(peer: Peer): Promise<void> {
    const pending = peer.pendingCandidates.splice(0);
    for (const c of pending) await peer.pc.addIceCandidate(c).catch(() => {});
  }

  private closePeer(staffId: string, why: string, silent = false): void {
    const peer = this.peers.get(staffId);
    if (!peer) return;
    this.peers.delete(staffId);
    collabLog("closing connection", { peer: staffId, connId: peer.connId, why });
    if (peer.everConnected) {
      const h = this.health.get(staffId);
      if (h) h.downSince ??= Date.now();
    }
    peer.pc.onconnectionstatechange = null;
    peer.pc.oniceconnectionstatechange = null;
    peer.pc.onsignalingstatechange = null;
    peer.pc.onicecandidate = null;
    peer.pc.onicecandidateerror = null;
    peer.pc.ontrack = null;
    peer.pc.ondatachannel = null;
    if (peer.channel) {
      peer.channel.onopen = null;
      peer.channel.onmessage = null;
      peer.channel.close();
    }
    peer.pc.close();
    // Nothing still queued for this connection is worth sending.
    this.outbound = this.outbound.filter((s) => s.connId !== peer.connId);
    // Their pointer arrived over this connection and goes with it.
    this.dropPointer(staffId);
    if (!silent) this.emit();
  }

  // --- outbound signaling ---

  private queueSignal(to: string, kind: OutboundSignal["kind"], payload: SignalPayload): void {
    this.outbound.push({ to, kind, payload: JSON.stringify(payload), connId: payload.connId });
    // ICE candidates trickle in between polls - send them promptly instead of
    // waiting for the next tick, which would add up to a second of latency to
    // every hop of the handshake.
    if (this.cancelFlush === null && !this.stopped) {
      this.cancelFlush = after(120, () => {
        this.cancelFlush = null;
        void this.flushOutbound();
      });
    }
  }

  private async flushOutbound(): Promise<void> {
    if (this.flushing || this.stopped || this.outbound.length === 0) return;
    this.flushing = true;
    const batch = this.outbound.splice(0, 50);
    try {
      await this.api.sendSignals(
        batch.map(({ to, kind, payload }) => ({ to, kind, payload })),
        deadline(REQUEST_TIMEOUT_MS),
      );
    } catch (err) {
      this.flushing = false;
      if (this.stopped || this.fatal(err)) return;
      // Back to the front of the queue, in order, for the next attempt -
      // minus anything whose connection was closed while this was in flight.
      const live = new Set([...this.peers.values()].map((p) => p.connId));
      this.outbound.unshift(...batch.filter((s) => s.connId === "" || live.has(s.connId)));
      collabLog("signals not sent, will retry", { count: batch.length, error: String(err) });
      return;
    }
    this.flushing = false;
    if (this.outbound.length) void this.flushOutbound();
  }

  // --- pointing at a shared screen ---

  subscribePointers = (listener: () => void): (() => void) => {
    this.pointerListeners.add(listener);
    return () => {
      this.pointerListeners.delete(listener);
    };
  };

  // Same array instance until something changes (useSyncExternalStore).
  getPointers = (): RoomPointer[] => this.pointerSnapshot;

  // Point at `target`'s shared screen (x/y as fractions of the picture), or
  // pass null to stop. Sent to everyone over the data channels, so the whole
  // room - the person sharing above all - sees the same marker.
  sendPointer(target: string, at: { x: number; y: number } | null): void {
    if (this.stopped) return;
    const now = Date.now();
    if (at && now - this.lastPointerSent < POINTER_MIN_INTERVAL_MS) return;
    this.lastPointerSent = at ? now : 0;
    const message = JSON.stringify(at ? { t: "ptr", to: target, x: Number(at.x.toFixed(4)), y: Number(at.y.toFixed(4)) } : { t: "ptr", to: target, off: true });
    for (const peer of this.peers.values()) {
      // Only to peers that said they understand it - to an older build a
      // pointer message would read as a camera/mic state update.
      if (peer.remoteVersion >= 2 && peer.channel?.readyState === "open") peer.channel.send(message);
    }
    if (at) this.setPointer(this.myId, target, at.x, at.y);
    else this.dropPointer(this.myId);
  }

  private onRemotePointer(from: string, data: Record<string, unknown>): void {
    if (typeof data.to !== "string") return;
    if (data.off === true) {
      this.dropPointer(from);
      return;
    }
    const { x, y } = data;
    if (typeof x !== "number" || typeof y !== "number" || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return;
    this.setPointer(from, data.to, x, y);
  }

  private setPointer(from: string, target: string, x: number, y: number): void {
    const name = from === this.myId ? "You" : (this.names.get(from)?.name ?? "Participant");
    this.pointers.set(from, { from, name, target, x, y, at: Date.now() });
    this.publishPointers();
  }

  private dropPointer(from: string): void {
    if (this.pointers.delete(from)) this.publishPointers();
  }

  private dropPointersAt(target: string): void {
    let changed = false;
    for (const [from, p] of this.pointers) {
      if (p.target === target) {
        this.pointers.delete(from);
        changed = true;
      }
    }
    if (changed) this.publishPointers();
  }

  private expirePointers(now: number): void {
    let changed = false;
    for (const [from, p] of this.pointers) {
      if (now - p.at > POINTER_TTL_MS) {
        this.pointers.delete(from);
        changed = true;
      }
    }
    if (changed) this.publishPointers();
  }

  private publishPointers(): void {
    this.pointerSnapshot = [...this.pointers.values()];
    for (const l of this.pointerListeners) l();
  }

  // --- what the UI sees ---

  private linkFor(staffId: string, peer: Peer | undefined): PeerLink {
    if (peer?.pc.connectionState === "connected") return "connected";
    const h = this.health.get(staffId);
    const now = Date.now();
    const slack = this.slack();
    if (h?.everConnected) return now - (h.downSince ?? now) > RECONNECT_FAILED_AFTER_MS + slack ? "failed" : "reconnecting";
    const waited = now - (h?.since ?? now);
    return waited > FAILED_AFTER_MS + slack ? "failed" : waited > SLOW_AFTER_MS + slack ? "slow" : "connecting";
  }

  private emit(): void {
    if (this.stopped) return;
    // Everyone in the room, plus anyone we still hold a connection to (out
    // of touch with the server, but the call itself still up).
    const ids = new Set<string>();
    for (const p of this.participants) if (p.inRoom && p.staffId !== this.myId) ids.add(p.staffId);
    for (const staffId of this.peers.keys()) ids.add(staffId);

    const peers: RemotePeer[] = [...ids].map((staffId) => {
      const peer = this.peers.get(staffId);
      let stream = peer?.stream;
      if (!stream) {
        // In the room but no live connection (yet, or between retries): show a
        // tile with the right status rather than letting it vanish.
        stream = this.placeholders.get(staffId) ?? new MediaStream();
        this.placeholders.set(staffId, stream);
      }
      const who = this.names.get(staffId);
      return {
        staffId,
        name: who?.name ?? "Participant",
        guest: who?.guest ?? false,
        stream,
        connectionState: peer?.pc.connectionState ?? "new",
        link: this.linkFor(staffId, peer),
        ...(peer?.media ?? { audio: true, video: false, screen: false }),
      };
    });
    // Forget people who left.
    for (const id of [...this.placeholders.keys()]) if (!ids.has(id)) this.placeholders.delete(id);
    for (const id of [...this.health.keys()]) if (!ids.has(id)) this.health.delete(id);

    this.onUpdate({
      participants: this.participants,
      peers,
      messages: [...this.messages],
      reconnecting: this.reconnecting,
      relayConfigured: this.iceConfig.relayConfigured,
    });
  }
}
