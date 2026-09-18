import { apiRequest } from "./client";

// Mirrors server/src/routes/crm/collab.route.ts - the Teams module's Huddle
// Room / Meeting / Support Session live rooms and their Recordings.

export type CollabSessionType = "HUDDLE" | "MEETING" | "SUPPORT";
export type CollabSessionStatus = "SCHEDULED" | "WAITING" | "LIVE" | "ENDED" | "CANCELLED";

export interface CollabParticipant {
  staffId: string;
  name: string;
  role: "HOST" | "INVITEE";
  inRoom: boolean;
  // Changes every time they (re)join - lets peers notice a refresh and
  // renegotiate instead of clinging to a dead connection.
  joinedAt: string | null;
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
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
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

export function joinCollabSession(id: string): Promise<{ status: string; session: CollabSession; iceServers: IceServer[] }> {
  return apiRequest(`/collab/sessions/${id}/join`, { method: "POST" });
}

export function leaveCollabSession(id: string): Promise<{ status: string }> {
  return apiRequest(`/collab/sessions/${id}/leave`, { method: "POST" });
}

export function pollCollabRoom(id: string, signalSince: number, messageSince: number): Promise<PollResult> {
  return apiRequest(`/collab/sessions/${id}/poll?signalSince=${signalSince}&messageSince=${messageSince}`);
}

export function sendCollabSignals(
  id: string,
  signals: { to: string; kind: Exclude<RoomSignal["kind"], "control">; payload: string }[],
): Promise<{ status: string; accepted: number }> {
  return apiRequest(`/collab/sessions/${id}/signal`, { method: "POST", body: JSON.stringify({ signals }) });
}

export type ControlAction = "mute" | "stop-share" | "remove";

// Host/admin moderation - the server enforces who may call this.
export function controlCollabSession(
  id: string,
  input: { action: ControlAction; targetId?: string; all?: boolean },
): Promise<{ status: string; affected: number }> {
  return apiRequest(`/collab/sessions/${id}/control`, { method: "POST", body: JSON.stringify(input) });
}

export function sendCollabMessage(id: string, body: string): Promise<{ status: string }> {
  return apiRequest(`/collab/sessions/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
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

export function fetchCollabConfig(): Promise<{ status: string; iceServers: IceServer[]; maxParticipants: number }> {
  return apiRequest("/collab/config");
}
