import { ApiError } from "../../api/client";
import {
  pollCollabRoom,
  sendCollabMessage,
  sendCollabSignals,
  type CollabParticipant,
  type CollabSessionStatus,
  type IceConfig,
  type RoomMessage,
  type RoomSignal,
} from "../../api/collab";

// The live half of a Teams room: a full-mesh WebRTC connection to every other
// person in the room. There is no signaling socket - offers, answers and ICE
// candidates are relayed through the server's /collab/sessions/:id/signal and
// /poll endpoints, and this class polls roughly once a second.
//
// Negotiation never happens twice on one connection: the person with the
// lexicographically smaller staff id is always the offerer, and camera/screen
// changes swap tracks with RTCRtpSender.replaceTrack instead of
// renegotiating. Each connection carries a random `connId` so a signal meant
// for a connection that has since been torn down (e.g. the other person
// refreshed their tab) can't be applied to its replacement.

const POLL_INTERVAL_MS = 800;
// A connection that hasn't come up after this long is abandoned and retried
// from scratch - ICE can wedge in "checking" when a NAT mapping goes stale.
const CONNECT_TIMEOUT_MS = 20_000;
// After this long still "connecting" we tell the user something's off rather
// than leaving a spinner that might never resolve.
const SLOW_AFTER_MS = 7_000;

export interface PeerMediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
}

// How the connection to one person is going, for the UI:
//   connected  - media is flowing
//   connecting - negotiating (normal for a few seconds)
//   slow       - still not up after SLOW_AFTER_MS; likely a network problem
//   failed     - an attempt gave up (timed out / ICE failed); retrying
export type PeerLink = "connected" | "connecting" | "slow" | "failed";

export interface RemotePeer extends PeerMediaState {
  staffId: string;
  stream: MediaStream;
  connectionState: RTCPeerConnectionState;
  link: PeerLink;
}

export interface RoomSnapshot {
  participants: CollabParticipant[];
  peers: RemotePeer[];
  messages: RoomMessage[];
  reconnecting: boolean;
  // Whether the server offers a TURN relay (see IceConfig) - decides what
  // advice to give when connections won't come up.
  relayConfigured: boolean;
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
  media: PeerMediaState;
  // Until the peer's data channel reports its real state, fall back to
  // guessing from whether video is actually arriving.
  gotMediaState: boolean;
  startedAt: number;
  // ICE candidates we gathered before our offer/answer was queued for
  // sending - they must go out after it, or the other side has no peer to
  // attach them to and drops them.
  outboundReady: boolean;
  earlyLocal: RTCIceCandidateInit[];
  localCandidateTypes: Set<string>;
  remoteCandidateCount: number;
}

interface SignalPayload {
  connId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  action?: string;
}

export interface RoomClientOptions extends IceConfig {
  sessionId: string;
  myId: string;
  onUpdate: (snapshot: RoomSnapshot) => void;
  // The host asked us to mute or stop sharing (server-verified: only the
  // moderation endpoint can create these signals).
  onControl: (action: "mute" | "stop-share") => void;
  // Session ended for everyone, or the server no longer lets us poll it.
  onClosed: (reason: "ended" | "error", message: string) => void;
}

export class RoomClient {
  private sessionId: string;
  private myId: string;
  private iceConfig: IceConfig;
  private onUpdate: (snapshot: RoomSnapshot) => void;
  private onClosed: (reason: "ended" | "error", message: string) => void;
  private onControl: (action: "mute" | "stop-share") => void;

  private peers = new Map<string, Peer>();
  // Per person we're trying to reach: when we first started and how many
  // attempts have failed. Outlives individual RTCPeerConnections so the UI
  // keeps saying "can't connect" across retries instead of flickering.
  private health = new Map<string, { since: number; failures: number }>();
  // Stand-in streams for people in the room we have no live connection to yet.
  private placeholders = new Map<string, MediaStream>();
  // Candidates that arrive before the offer that introduces their connection.
  private orphanCandidates = new Map<string, RTCIceCandidateInit[]>();
  private outbound: { to: string; kind: Exclude<RoomSignal["kind"], "control">; payload: string }[] = [];
  private signalSince = 0;
  private messageSince = 0;
  private participants: CollabParticipant[] = [];
  private messages: RoomMessage[] = [];
  private stopped = false;
  private started = false;
  private failures = 0;
  private reconnecting = false;
  private wake: (() => void) | null = null;
  private flushTimer: number | null = null;
  private flushing = false;

  private audioTrack: MediaStreamTrack | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private localMedia: PeerMediaState = { audio: false, video: false, screen: false };

  constructor(options: RoomClientOptions) {
    this.sessionId = options.sessionId;
    this.myId = options.myId;
    this.iceConfig = { iceServers: options.iceServers, iceTransportPolicy: options.iceTransportPolicy, relayConfigured: options.relayConfigured };
    this.onUpdate = options.onUpdate;
    this.onClosed = options.onClosed;
    this.onControl = options.onControl;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    for (const staffId of [...this.peers.keys()]) this.closePeer(staffId, false);
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
    await sendCollabMessage(this.sessionId, body);
    // Don't wait out the rest of the poll interval to show our own message.
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
          this.emit();
        }
      } catch (err) {
        if (this.stopped) return;
        // 403/404: we've been removed from the room or it's gone - retrying
        // can never succeed.
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          this.stop();
          this.onClosed("error", err.message);
          return;
        }
        this.failures++;
        if (this.failures >= 3 && !this.reconnecting) {
          this.reconnecting = true;
          this.emit();
        }
      }
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, Math.max(150, POLL_INTERVAL_MS - (Date.now() - startedAt)));
        this.wake = () => {
          window.clearTimeout(timer);
          resolve();
        };
      });
      this.wake = null;
    }
  }

  private async tick(): Promise<void> {
    const res = await pollCollabRoom(this.sessionId, this.signalSince, this.messageSince);
    if (this.stopped) return;

    this.participants = res.participants;

    for (const signal of res.signals) {
      this.signalSince = Math.max(this.signalSince, signal.id);
      try {
        await this.handleSignal(signal);
      } catch {
        // A malformed or stale signal must not stall the ones behind it.
      }
    }
    if (res.messages.length) {
      const seen = new Set(this.messages.map((m) => m.id));
      for (const m of res.messages) {
        this.messageSince = Math.max(this.messageSince, m.id);
        if (!seen.has(m.id)) this.messages.push(m);
      }
    }

    this.expireStalledPeers();
    await this.reconcile();
    this.emit();
    await this.flushOutbound();

    if (this.isClosedStatus(res.sessionStatus)) {
      this.stop();
      this.onClosed("ended", res.sessionStatus === "CANCELLED" ? "This session was cancelled." : "The host ended this session.");
    }
  }

  private isClosedStatus(status: CollabSessionStatus): boolean {
    return status === "ENDED" || status === "CANCELLED";
  }

  // --- peers ---

  // Abandon attempts that never got anywhere. The offerer's next reconcile()
  // starts a fresh one (new connId); the other side picks it up from its offer.
  private expireStalledPeers(): void {
    const now = Date.now();
    for (const [staffId, peer] of [...this.peers]) {
      if (peer.pc.connectionState !== "connected" && now - peer.startedAt > CONNECT_TIMEOUT_MS) {
        this.noteFailure(staffId, peer, "timed out");
        this.closePeer(staffId, false);
      }
    }
  }

  private noteFailure(staffId: string, peer: Peer, why: string): void {
    const h = this.health.get(staffId) ?? { since: peer.startedAt, failures: 0 };
    h.failures++;
    this.health.set(staffId, h);
    // Diagnostics for whoever ends up debugging a network: the candidate
    // types tell you at a glance whether a relay was ever in play.
    console.warn(
      `[teams] connection to ${staffId} ${why}. local candidates: ${[...peer.localCandidateTypes].join(", ") || "none"}; ` +
        `remote candidates received: ${peer.remoteCandidateCount}; ice: ${peer.pc.iceConnectionState}; relay configured: ${this.iceConfig.relayConfigured}`,
    );
  }

  private logSelectedPath(staffId: string, pc: RTCPeerConnection): void {
    void pc
      .getStats()
      .then((stats) => {
        let pair: { localCandidateId?: string; remoteCandidateId?: string } | undefined;
        stats.forEach((r) => {
          if (r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
        });
        const local = pair?.localCandidateId ? stats.get(pair.localCandidateId) : undefined;
        const remote = pair?.remoteCandidateId ? stats.get(pair.remoteCandidateId) : undefined;
        console.info(`[teams] connected to ${staffId} via local ${local?.candidateType ?? "?"} / remote ${remote?.candidateType ?? "?"}`);
      })
      .catch(() => {});
  }

  // Make the set of open connections match who's actually in the room.
  private async reconcile(): Promise<void> {
    const present = new Map(this.participants.filter((p) => p.inRoom && p.staffId !== this.myId).map((p) => [p.staffId, p]));

    for (const [staffId, peer] of [...this.peers]) {
      const p = present.get(staffId);
      // Gone, or rejoined since this connection was made (a refreshed tab
      // leaves us holding a connection to a peer that no longer exists).
      if (!p || p.joinedAt !== peer.remoteJoinedAt) this.closePeer(staffId, false);
    }

    for (const [staffId, p] of present) {
      if (this.peers.has(staffId)) continue;
      if (this.myId < staffId) await this.startOffer(staffId, p.joinedAt);
      // Otherwise the other side is the offerer; wait for their offer.
    }
  }

  private makePeer(staffId: string, connId: string, remoteJoinedAt: string | null): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceConfig.iceServers, iceTransportPolicy: this.iceConfig.iceTransportPolicy });
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
      media: { audio: true, video: false, screen: false },
      gotMediaState: false,
      startedAt: Date.now(),
      outboundReady: false,
      earlyLocal: [],
      localCandidateTypes: new Set(),
      remoteCandidateCount: 0,
    };

    pc.ontrack = (e) => {
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
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        this.health.delete(staffId);
        this.logSelectedPath(staffId, pc);
      }
      // "failed"/"closed" are terminal. "disconnected" often recovers on its
      // own, so it's left alone. Dropping the peer makes reconcile() rebuild
      // it (offerer) or the offerer's new offer replace it (answerer).
      if ((state === "failed" || state === "closed") && this.peers.get(staffId) === peer) {
        if (state === "failed") this.noteFailure(staffId, peer, "failed");
        this.closePeer(staffId, false);
      } else this.emit();
    };
    pc.oniceconnectionstatechange = () => this.emit();
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
      try {
        const data = JSON.parse(String(e.data)) as Partial<PeerMediaState>;
        peer.media = { audio: !!data.audio, video: !!data.video, screen: !!data.screen };
        peer.gotMediaState = true;
        this.emit();
      } catch {
        // ignore garbage
      }
    };
  }

  private sendMediaState(peer: Peer): void {
    if (peer.channel?.readyState === "open") peer.channel.send(JSON.stringify(this.localMedia));
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
    const connId = crypto.randomUUID();
    const peer = this.makePeer(staffId, connId, remoteJoinedAt);
    const { pc } = peer;
    try {
      this.attachChannel(peer, pc.createDataChannel("state"));
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      this.applyLocalTracks(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.queueSignal(staffId, "offer", { connId, sdp: pc.localDescription!.toJSON() });
      this.releaseEarlyCandidates(peer);
    } catch {
      this.closePeer(staffId, false);
    }
  }

  private async handleSignal(signal: RoomSignal): Promise<void> {
    const data = JSON.parse(signal.payload) as SignalPayload;
    const from = signal.from;

    if (signal.kind === "control") {
      if (data.action === "mute" || data.action === "stop-share") this.onControl(data.action);
      return;
    }
    const remote = this.participants.find((p) => p.staffId === from);

    if (signal.kind === "offer") {
      if (!data.sdp) return;
      const existing = this.peers.get(from);
      if (existing?.connId === data.connId) return; // duplicate delivery
      if (existing) this.closePeer(from, false);

      const peer = this.makePeer(from, data.connId, remote?.joinedAt ?? null);
      const { pc } = peer;
      await pc.setRemoteDescription(data.sdp);
      peer.hasRemote = true;
      this.applyLocalTracks(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.queueSignal(from, "answer", { connId: data.connId, sdp: pc.localDescription!.toJSON() });
      this.releaseEarlyCandidates(peer);
      // Candidates that beat the offer here.
      const orphaned = this.orphanCandidates.get(`${from}:${data.connId}`);
      if (orphaned) {
        peer.pendingCandidates.push(...orphaned);
        this.orphanCandidates.delete(`${from}:${data.connId}`);
      }
      await this.drainCandidates(peer);
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
      if (!data.sdp || peer.hasRemote) return;
      await peer.pc.setRemoteDescription(data.sdp);
      peer.hasRemote = true;
      await this.drainCandidates(peer);
    } else if (signal.kind === "candidate" && data.candidate) {
      peer.remoteCandidateCount++;
      if (peer.hasRemote) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
      else peer.pendingCandidates.push(data.candidate);
    }
  }

  private async drainCandidates(peer: Peer): Promise<void> {
    const pending = peer.pendingCandidates.splice(0);
    for (const c of pending) await peer.pc.addIceCandidate(c).catch(() => {});
  }

  private closePeer(staffId: string, silent: boolean): void {
    const peer = this.peers.get(staffId);
    if (!peer) return;
    this.peers.delete(staffId);
    peer.pc.onconnectionstatechange = null;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.channel?.close();
    peer.pc.close();
    if (!silent) this.emit();
  }

  // --- outbound signaling ---

  private queueSignal(to: string, kind: Exclude<RoomSignal["kind"], "control">, payload: SignalPayload): void {
    this.outbound.push({ to, kind, payload: JSON.stringify(payload) });
    // ICE candidates trickle in between polls - send them promptly instead of
    // waiting for the next tick, which would add up to a second of latency to
    // every hop of the handshake.
    if (this.flushTimer === null && !this.stopped) {
      this.flushTimer = window.setTimeout(() => {
        this.flushTimer = null;
        void this.flushOutbound().catch(() => {});
      }, 120);
    }
  }

  private async flushOutbound(): Promise<void> {
    if (this.flushing || this.outbound.length === 0) return;
    this.flushing = true;
    const batch = this.outbound.splice(0, 50);
    try {
      await sendCollabSignals(this.sessionId, batch);
    } catch (err) {
      // Put them back for the next attempt unless the room's gone for good.
      if (!(err instanceof ApiError && (err.status === 403 || err.status === 404))) this.outbound.unshift(...batch);
      throw err;
    } finally {
      this.flushing = false;
    }
    if (this.outbound.length) await this.flushOutbound();
  }

  private linkFor(staffId: string, peer: Peer | undefined): PeerLink {
    if (peer?.pc.connectionState === "connected") return "connected";
    const h = this.health.get(staffId);
    if (h && h.failures > 0) return "failed";
    const since = peer?.startedAt ?? h?.since ?? Date.now();
    return Date.now() - since > SLOW_AFTER_MS ? "slow" : "connecting";
  }

  private emit(): void {
    if (this.stopped) return;
    const present = this.participants.filter((p) => p.inRoom && p.staffId !== this.myId);
    const peers: RemotePeer[] = present.map((p) => {
      const peer = this.peers.get(p.staffId);
      let stream = peer?.stream;
      if (!stream) {
        // In the room but no live connection (yet, or between retries): show a
        // tile with the right status rather than letting it vanish.
        stream = this.placeholders.get(p.staffId) ?? new MediaStream();
        this.placeholders.set(p.staffId, stream);
      }
      return {
        staffId: p.staffId,
        stream,
        connectionState: peer?.pc.connectionState ?? "new",
        link: this.linkFor(p.staffId, peer),
        ...(peer?.media ?? { audio: true, video: false, screen: false }),
      };
    });
    // Forget people who left.
    const presentIds = new Set(present.map((p) => p.staffId));
    for (const id of [...this.placeholders.keys()]) if (!presentIds.has(id)) this.placeholders.delete(id);
    for (const id of [...this.health.keys()]) if (!presentIds.has(id)) this.health.delete(id);

    this.onUpdate({
      participants: this.participants,
      peers,
      messages: [...this.messages],
      reconnecting: this.reconnecting,
      relayConfigured: this.iceConfig.relayConfigured,
    });
  }
}
