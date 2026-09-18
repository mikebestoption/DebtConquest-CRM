import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  deleteCollabRecording,
  fetchCollabRecordings,
  fetchRecordingUrl,
  type CollabRecording,
  type CollabSessionType,
} from "../../api/collab";
import { ApiError } from "../../api/client";
import { Select } from "../../components/controls";
import { Pagination } from "../worklist/Pagination";
import { IconDownload, IconPlayCircle, IconSearch, IconTrash, IconX } from "../layout/icons";
import { TYPE_META, formatBytes, formatDateTime, formatDuration } from "./format";

const PAGE_SIZE = 20;
const INPUT_CLASS = "rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-ring";

// Recordings saved from Huddle Room / Meeting / Support Session calls (see
// roomRuntime.ts for how they're captured). You see the ones you made, the
// ones from sessions you hosted or joined, and - for admins - all of them.
export function RecordingsPage() {
  const [recordings, setRecordings] = useState<CollabRecording[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CollabSessionType | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ recording: CollabRecording; url: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCollabRecordings({
      page,
      pageSize: PAGE_SIZE,
      type: type || undefined,
      search: search.trim() || undefined,
      // Date inputs are local calendar days: from = start of that day, to = end of it.
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    })
      .then((res) => {
        setRecordings(res.recordings);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load recordings"))
      .finally(() => setLoading(false));
  }, [page, type, search, from, to]);

  useEffect(() => {
    const t = window.setTimeout(load, search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  // Any filter change goes back to the first page.
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  async function handlePlay(r: CollabRecording) {
    setBusyId(r.id);
    setError(null);
    try {
      const { url } = await fetchRecordingUrl(r.id);
      setPlaying({ recording: r, url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open the recording");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(r: CollabRecording) {
    setBusyId(r.id);
    setError(null);
    try {
      const { url } = await fetchRecordingUrl(r.id, true);
      // The signed URL asks S3 for an attachment, so this just saves the file.
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download the recording");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(r: CollabRecording) {
    if (!window.confirm(`Delete the recording of "${r.sessionTitle}"? This cannot be undone.`)) return;
    setBusyId(r.id);
    setError(null);
    try {
      await deleteCollabRecording(r.id);
      // Deleting the last row of a later page would otherwise leave you on an empty page.
      if (recordings.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete the recording");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Recordings</h1>
        <p className="mt-0.5 text-sm text-muted">
          Recordings saved from your huddles, meetings and support sessions. Start one from the Record button inside any room.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-white p-4">
        <div className="relative w-full sm:w-64">
          <IconSearch width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => withReset(setSearch)(e.target.value)}
            placeholder="Search title, host or recorder"
            className={`${INPUT_CLASS} w-full pl-9`}
          />
        </div>
        <Select fitContent value={type} onChange={(e) => withReset(setType)(e.target.value as CollabSessionType | "")} aria-label="Session type">
          <option value="">All types</option>
          {(Object.keys(TYPE_META) as CollabSessionType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </Select>
        <div>
          <label className="mb-1 block text-xs text-muted">From</label>
          <input type="date" value={from} max={to || undefined} onChange={(e) => withReset(setFrom)(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">To</label>
          <input type="date" value={to} min={from || undefined} onChange={(e) => withReset(setTo)(e.target.value)} className={INPUT_CLASS} />
        </div>
        {(search || type || from || to) && (
          <button
            onClick={() => {
              setPage(1);
              setSearch("");
              setType("");
              setFrom("");
              setTo("");
            }}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-bg"
          >
            Clear
          </button>
        )}
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-error">{error}</div>}

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Recorded by</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Length</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && recordings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    {search || type || from || to ? "No recordings match these filters." : "No recordings yet."}
                  </td>
                </tr>
              )}
              {!loading &&
                recordings.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{r.sessionTitle}</div>
                      <div className="text-xs text-muted">Host: {r.host.name}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <Link to={TYPE_META[r.sessionType].path} className="hover:text-teal hover:underline">
                        {TYPE_META[r.sessionType].label}
                      </Link>
                      {!r.isVideo && <span className="ml-1.5 rounded bg-bg px-1.5 py-0.5 text-xs font-semibold text-teal-100">Audio</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.recordedBy.name}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 text-muted">{formatDuration(r.durationSeconds)}</td>
                    <td className="px-4 py-3 text-muted">{formatBytes(r.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconAction label="Play" disabled={busyId === r.id} onClick={() => void handlePlay(r)}>
                          <IconPlayCircle width={18} height={18} />
                        </IconAction>
                        <IconAction label="Download" disabled={busyId === r.id} onClick={() => void handleDownload(r)}>
                          <IconDownload width={18} height={18} />
                        </IconAction>
                        {r.canDelete && (
                          <IconAction label="Delete" danger disabled={busyId === r.id} onClick={() => void handleDelete(r)}>
                            <IconTrash width={18} height={18} />
                          </IconAction>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {playing && <PlayerModal recording={playing.recording} url={playing.url} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function IconAction({ label, onClick, children, danger, disabled }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded p-1.5 disabled:opacity-50 ${danger ? "text-error hover:bg-red-50" : "text-muted hover:bg-bg hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function PlayerModal({ recording, url, onClose }: { recording: CollabRecording; url: string; onClose: () => void }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-card bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">{recording.sessionTitle}</h2>
            <p className="text-xs text-muted">
              {TYPE_META[recording.sessionType].label} · {formatDateTime(recording.createdAt)} · recorded by {recording.recordedBy.name}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-bg" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>
        {recording.isVideo ? (
          <video src={url} controls autoPlay onError={() => setFailed(true)} className="max-h-[70vh] w-full rounded-md bg-black" />
        ) : (
          <audio src={url} controls autoPlay onError={() => setFailed(true)} className="w-full" />
        )}
        {failed && <p className="mt-2 text-sm text-error">This recording couldn't be played in your browser. Try downloading it instead.</p>}
      </div>
    </div>
  );
}
