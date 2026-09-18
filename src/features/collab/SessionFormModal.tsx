import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { createCollabSession, updateCollabSession, type CollabSession, type CollabSessionType } from "../../api/collab";
import { fetchStaff, type StaffOption } from "../../api/staff";
import { Checkbox } from "../../components/controls";
import { IconSearch, IconX } from "../layout/icons";
import { staffDisplayName, toLocalInput } from "./format";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-gray-400 focus:border-teal focus:ring-2 focus:ring-ring";

interface SessionFormModalProps {
  type: CollabSessionType;
  session: CollabSession | null; // null = creating
  currentStaffId: string;
  defaultTitle: string;
  // Meetings: open with "start now" already ticked (the Meet Now button).
  startNow?: boolean;
  onClose: () => void;
  onSaved: (session: CollabSession, created: boolean) => void;
}

const COPY: Record<CollabSessionType, { create: string; edit: string; titleLabel: string; titlePlaceholder: string; submit: string }> = {
  HUDDLE: { create: "Start a Huddle", edit: "Edit Huddle", titleLabel: "Huddle name", titlePlaceholder: "e.g. Morning sales stand-up", submit: "Start huddle" },
  MEETING: { create: "New Meeting", edit: "Edit Meeting", titleLabel: "Meeting title", titlePlaceholder: "e.g. Weekly pipeline review", submit: "Schedule" },
  SUPPORT: { create: "Request Support", edit: "Edit Request", titleLabel: "What do you need help with?", titlePlaceholder: "e.g. Client can't upload credit report", submit: "Request support" },
};

export function SessionFormModal({ type, session, currentStaffId, defaultTitle, startNow, onClose, onSaved }: SessionFormModalProps) {
  const isEdit = session !== null;
  const copy = COPY[type];
  // An instant meeting has no schedule to edit later.
  const hasSchedule = !isEdit || session.scheduledStart !== null;
  const [title, setTitle] = useState(session?.title ?? defaultTitle);
  const [description, setDescription] = useState(session?.description ?? "");
  const [instant, setInstant] = useState(!isEdit && !!startNow);
  const [startAt, setStartAt] = useState(() => {
    if (session?.scheduledStart) return toLocalInput(new Date(session.scheduledStart));
    // Next half-hour boundary.
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return toLocalInput(d);
  });
  const [endAt, setEndAt] = useState(() => {
    if (session?.scheduledEnd) return toLocalInput(new Date(session.scheduledEnd));
    const d = new Date();
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return toLocalInput(new Date(d.getTime() + 30 * 60 * 1000));
  });
  const [leadNumber, setLeadNumber] = useState("");
  const [invitees, setInvitees] = useState<string[]>(session?.participants.filter((p) => p.role === "INVITEE").map((p) => p.staffId) ?? []);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffSearch, setStaffSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (type !== "MEETING") return;
    fetchStaff()
      .then((res) => setStaff(res.staff.filter((s) => s.id !== currentStaffId)))
      .catch(() => setStaff([]));
  }, [type, currentStaffId]);

  const visibleStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return q ? staff.filter((s) => staffDisplayName(s).toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) : staff;
  }, [staff, staffSearch]);

  const showSchedule = type === "MEETING" && !instant && hasSchedule;

  function toggleInvitee(id: string, on: boolean) {
    setInvitees((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const scheduled = showSchedule;
    if (scheduled && new Date(endAt) <= new Date(startAt)) {
      setError("End time must be after the start time.");
      return;
    }
    const leadNo = leadNumber.trim() ? Number(leadNumber) : null;
    if (leadNo !== null && (!Number.isInteger(leadNo) || leadNo <= 0)) {
      setError("Lead number must be a positive whole number.");
      return;
    }

    setSaving(true);
    try {
      const schedule = scheduled ? { scheduledStart: new Date(startAt).toISOString(), scheduledEnd: new Date(endAt).toISOString() } : {};
      if (isEdit) {
        const res = await updateCollabSession(session.id, {
          title,
          description: description || null,
          ...(type === "MEETING" ? { ...schedule, inviteeIds: invitees } : {}),
        });
        onSaved(res.session, false);
      } else {
        const res = await createCollabSession({
          type,
          title,
          description: description || null,
          ...(type === "MEETING" ? { ...schedule, inviteeIds: invitees } : {}),
          ...(type === "SUPPORT" ? { leadNumber: leadNo } : {}),
        });
        onSaved(res.session, true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex overflow-y-auto bg-black/40 p-4">
      <div className="m-auto w-full max-w-lg rounded-card bg-white p-4 shadow-card sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{isEdit ? copy.edit : copy.create}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-bg" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{copy.titleLabel} *</label>
            <input required autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.titlePlaceholder} className={INPUT_CLASS} />
          </div>

          {type === "MEETING" && (
            <>
              {!isEdit && <Checkbox checked={instant} onChange={setInstant} label="Start now (instant meeting)" />}
              {showSchedule && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Start</label>
                    <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">End</label>
                    <input required type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={INPUT_CLASS} />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Invite people ({invitees.length} selected)</label>
                <div className="relative mb-2">
                  <IconSearch width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} placeholder="Search staff" className={`${INPUT_CLASS} pl-9`} />
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border p-2">
                  {visibleStaff.length === 0 && <p className="px-1 py-2 text-sm text-muted">No staff found.</p>}
                  {visibleStaff.map((s) => (
                    <div key={s.id} className="rounded px-1 py-1 hover:bg-bg">
                      <Checkbox checked={invitees.includes(s.id)} onChange={(on) => toggleInvitee(s.id, on)} label={staffDisplayName(s)} />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">Invited people see the meeting here and on their Calendar.</p>
              </div>
            </>
          )}

          {type === "SUPPORT" && !isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Related lead # (optional)</label>
              <input inputMode="numeric" value={leadNumber} onChange={(e) => setLeadNumber(e.target.value)} placeholder="e.g. 1042" className={INPUT_CLASS} />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">{type === "SUPPORT" ? "Details" : "Description"}</label>
            <textarea rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLASS} />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-bg">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
              {saving ? "Saving…" : isEdit ? "Save" : type === "MEETING" && instant ? "Start meeting" : copy.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
