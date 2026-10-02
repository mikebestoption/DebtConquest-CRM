import { API_BASE, ApiError, apiRequest } from "./client";

// Mirrors server/src/routes/crm/collab.route.ts - the Teams module's Huddle
// Room / Meeting / Support Session live rooms and their Recordings.

export type CollabSessionType = "HUDDLE" | "MEETING" | "SUPPORT";
export type CollabSessionStatus = "SCHEDULED" | "WAITING" | "LIVE" | "ENDED" | "CANCELLED";

export interface CollabParticipant {
  // The participant's id in the room: a staff id, or - for an external
  // visitor who joined through the guest link - their guest id.
  staffId: string;
  name: string;
  role: "HOST" | "INVITEE";
  inRoom: boolean;
  // Changes every time they (re)join - lets peers notice a refresh and
  // renegotiate instead of clinging to a dead connection.
  joinedAt: string | null;
  // An external visitor rather than a staff member.
  guest?: boolean;
  // Left on purpose (or was removed), as opposed to merely not having been
  // heard from lately - someone whose own signaling is struggling is not
  // `inRoom` either, but a call to them that still works should be kept.
  left?: boolean;
}

export interface CollabSession {
  id: string;
  type: CollabSessionType;
  status: CollabSessionStatus;
  title: string;
  description: string | null;
  host: { id: string; name: string };
  lead: { id: string; leadNumber: number; name: string } | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  participants: CollabParticipant[];
  inRoomCount: number;
  recordingCount: number;
  canManage: boolean;
  isOpen: boolean;
  // Whether this session has an external-visitor link, and (host/admin
  // only) the secret that goes in it - see guestLinkUrl.
  guestLinkEnabled?: boolean;
  guestToken?: string | null;
}

// Where an external visitor opens a session: a public page of this app, no
// CRM login. Only as good as its secret - share it like a meeting invite.
export function guestLinkUrl(guestToken: string): string {
  return `${window.location.origin}/meet/${guestToken}`;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Everything the browser needs to build RTCPeerConnections.
export interface IceConfig {
  iceServers: IceServer[];
  // "relay" forces all media through the TURN server.
  iceTransportPolicy: "all" | "relay";
  // Whether the server has a TURN relay configured at all - without one,
  // people on restrictive networks simply can't connect to each other.
  relayConfigured: boolean;
}

export interface CreateSessionInput {
  type: CollabSessionType;
  title: string;
  description?: string | null;
  scheduledStart?: string;
  scheduledEnd?: string;
  inviteeIds?: string[];
  leadNumber?: number | null;
}

export interface UpdateSessionInput {
  title?: string;
  description?: string | null;
  scheduledStart?: string;
  scheduledEnd?: string;
  inviteeIds?: string[];
}

export interface RoomSignal {
  id: number;
  from: string;
  kind: "offer" | "answer" | "candidate" | "control";
  payload: string;
}

export interface RoomMessage {
  id: number;
  staffId: string;
  name: string;
  body: string;
  createdAt: string;
}

export interface PollResult {
  status: string;
  sessionStatus: CollabSessionStatus;
  participants: CollabParticipant[];
  signals: RoomSignal[];
  messages: RoomMessage[];
}

export interface CollabRecording {
  id: string;
  sessionId: string;
  sessionType: CollabSessionType;
  sessionTitle: string;
  host: { id: string; name: string };
  recordedBy: { id: string; name: string };
  mimeType: string;
  isVideo: boolean;
  sizeBytes: number;
  durationSeconds: number;
  createdAt: string;
  canDelete: boolean;
}

export interface RecordingsQuery {
  type?: CollabSessionType;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

function toSearchParams(q: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export function fetchCollabSessions(query: {
  type: CollabSessionType;
  view?: "active" | "past";
  search?: string;
}): Promise<{ status: string; sessions: CollabSession[] }> {
  return apiRequest(`/collab/sessions?${toSearchParams(query)}`);
}

export function fetchCollabSession(id: string): Promise<{ status: string; session: CollabSession }> {
  return apiRequest(`/collab/sessions/${id}`);
}

export function createCollabSession(input: CreateSessionInput): Promise<{ status: string; session: CollabSession }> {
  return apiRequest("/collab/sessions", { method: "POST", body: JSON.stringify(input) });
}

export function updateCollabSession(id: string, patch: UpdateSessionInput): Promise<{ status: string; session: CollabSession }> {
  return apiRequest(`/collab/sessions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function endCollabSession(id: string): Promise<{ status: string }> {
  return apiRequest(`/collab/sessions/${id}/end`, { method: "POST" });
}

// What joining hands back: the session, how to build peer connections, and
// `instance` - this join's id, sent with every later room call so the server
// can tell this tab from an older one of the same person (a second tab, the
// page before a refresh). An older instance is refused with a 409.
export type JoinResult = { status: string; session: CollabSession; instance?: number } & IceConfig;

export function joinCollabSession(id: string): Promise<JoinResult> {
  return apiRequest(`/collab/sessions/${id}/join`, { method: "POST" });
}

export interface OutboundSignal {
  to: string;
  kind: Exclude<RoomSignal["kind"], "control">;
  payload: string;
}

// The server calls one visit to a room makes. A signed-in staff member and
// an external visitor reach different endpoints with different credentials
// but the room itself (roomRuntime.ts / roomClient.ts) doesn't care which -
// it's handed one of these. `signal` lets the caller put a deadline on a
// call: a request that never answers must not stall the room.
export interface RoomApi {
  poll(cursors: { signalSince: number; messageSince: number }, signal?: AbortSignal): Promise<PollResult>;
  sendSignals(signals: OutboundSignal[], signal?: AbortSignal): Promise<{ status: string; accepted: number }>;
  sendMessage(body: string): Promise<{ status: string }>;
  // `keepalive` lets the call outlive the page (it's sent while unloading).
  leave(keepalive?: boolean): Promise<{ status: string }>;
}

function pollQuery(cursors: { signalSince: number; messageSince: number }, instance: number | undefined): string {
  return `signalSince=${cursors.signalSince}&messageSince=${cursors.messageSince}${instance === undefined ? "" : `&instance=${instance}`}`;
}

export function staffRoomApi(sessionId: string, instance: number | undefined): RoomApi {
  const base = `/collab/sessions/${sessionId}`;
  return {
    poll: (cursors, signal) => apiRequest(`${base}/poll?${pollQuery(cursors, instance)}`, { signal }),
    sendSignals: (signals, signal) => apiRequest(`${base}/signal`, { method: "POST", body: JSON.stringify({ signals, instance }), signal }),
    sendMessage: (body) => apiRequest(`${base}/messages`, { method: "POST", body: JSON.stringify({ body, instance }) }),
    leave: (keepalive) => apiRequest(`${base}/leave`, { method: "POST", body: JSON.stringify({ instance }), keepalive }),
  };
}

// --- External visitors (guest link) ---

// Visitors have no staff login: their calls carry a guest key, and must
// stay clear of apiRequest, which signs the CRM user out on a 401 - a
// visitor's expired key is no reason to log a staff member out of the CRM
// in the same browser.
async function guestRequest<T>(path: string, guestKey: string | null, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (guestKey) headers.set("Authorization", `Bearer ${guestKey}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export function fetchGuestSession(guestToken: string): Promise<{ status: string; session: CollabSession }> {
  return guestRequest(`/collab/guest/${encodeURIComponent(guestToken)}`, null);
}

// `guestId` is the id a returning visitor had before (refresh, reconnect),
// so they come back as the same participant.
export function joinAsGuest(guestToken: string, name: string, guestId: string | undefined): Promise<JoinResult & { guestId: string; guestKey: string }> {
  return guestRequest(`/collab/guest/${encodeURIComponent(guestToken)}/join`, null, { method: "POST", body: JSON.stringify({ name, guestId }) });
}

export function guestRoomApi(guestKey: string, instance: number | undefined): RoomApi {
  const base = "/collab/guest/room";
  return {
    poll: (cursors, signal) => guestRequest(`${base}/poll?${pollQuery(cursors, instance)}`, guestKey, { signal }),
    sendSignals: (signals, signal) => guestRequest(`${base}/signal`, guestKey, { method: "POST", body: JSON.stringify({ signals, instance }), signal }),
    sendMessage: (body) => guestRequest(`${base}/messages`, guestKey, { method: "POST", body: JSON.stringify({ body, instance }) }),
    leave: (keepalive) => guestRequest(`${base}/leave`, guestKey, { method: "POST", body: JSON.stringify({ instance }), keepalive }),
  };
}

// Host/admin: creates the session's guest link (or returns the existing one).
export function createGuestLink(id: string): Promise<{ status: string; guestToken: string }> {
  return apiRequest(`/collab/sessions/${id}/guest-link`, { method: "POST" });
}

// Host/admin: turns the guest link off and drops any visitors in the room.
export function revokeGuestLink(id: string): Promise<{ status: string }> {
  return apiRequest(`/collab/sessions/${id}/guest-link`, { method: "DELETE" });
}

export type ControlAction = "mute" | "stop-share" | "remove";

// Host/admin moderation - the server enforces who may call this.
export function controlCollabSession(
  id: string,
  input: { action: ControlAction; targetId?: string; all?: boolean },
): Promise<{ status: string; affected: number }> {
  return apiRequest(`/collab/sessions/${id}/control`, { method: "POST", body: JSON.stringify(input) });
}

export function uploadCollabRecording(id: string, blob: Blob, durationSeconds: number): Promise<{ status: string; recording: { id: string } }> {
  const form = new FormData();
  form.append("file", blob, "recording");
  return apiRequest(`/collab/sessions/${id}/recordings?duration=${Math.max(0, Math.round(durationSeconds))}`, { method: "POST", body: form });
}

export function fetchCollabRecordings(
  query: RecordingsQuery,
): Promise<{ status: string; total: number; page: number; pageSize: number; recordings: CollabRecording[] }> {
  return apiRequest(`/collab/recordings?${toSearchParams(query)}`);
}

export function fetchRecordingUrl(id: string, download = false): Promise<{ status: string; url: string }> {
  return apiRequest(`/collab/recordings/${id}/url${download ? "?download=1" : ""}`);
}

export function deleteCollabRecording(id: string): Promise<{ status: string }> {
  return apiRequest(`/collab/recordings/${id}`, { method: "DELETE" });
}

export function fetchCollabConfig(): Promise<{ status: string; maxParticipants: number } & IceConfig> {
  return apiRequest("/collab/config");
}
