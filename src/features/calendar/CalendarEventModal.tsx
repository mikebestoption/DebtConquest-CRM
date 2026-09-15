import { useState, type FormEvent } from "react";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, type CalendarEvent } from "../../api/calendar";
import { ApiError } from "../../api/client";
import type { StaffOption } from "../../api/staff";
import { IconTrash, IconX } from "../layout/icons";
import { Select, Checkbox } from "../../components/controls";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-gray-400 focus:border-teal focus:ring-2 focus:ring-ring";

// yyyy-MM-ddTHH:mm, the format <input type="datetime-local"> both reads and
// emits - built from the Date's own local getters (not toISOString, which
// is UTC) so the field shows the time the way it actually happened locally.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CalendarEventModalProps {
  event: CalendarEvent | null; // null = creating a new event
  defaultDate?: Date; // prefills start/end when creating from a clicked day
  isAdmin: boolean;
  staff: StaffOption[];
  currentStaffId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CalendarEventModal({ event, defaultDate, isAdmin, staff, currentStaffId, onClose, onSaved }: CalendarEventModalProps) {
  const isEdit = event !== null;
  const [title, setTitle] = useState(event?.title ?? "");
  const [staffId, setStaffId] = useState(event?.staffId ?? currentStaffId);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startAt, setStartAt] = useState(toLocalInput(event ? new Date(event.startAt) : (defaultDate ?? new Date())));
  const [endAt, setEndAt] = useState(
    toLocalInput(event ? new Date(event.endAt) : new Date((defaultDate ?? new Date()).getTime() + 60 * 60 * 1000)),
  );
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = {
        staffId: isAdmin ? staffId : undefined,
        title,
        description: description || null,
        location: location || null,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        allDay,
      };
      if (isEdit) {
        await updateCalendarEvent(event.id, input);
      } else {
        await createCalendarEvent(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteCalendarEvent(event.id);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete event");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{isEdit ? "Edit Event" : "New Event"}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-bg" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Title *</label>
            <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} />
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Staff</label>
              <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Checkbox checked={allDay} onChange={setAllDay} label="All day" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Start</label>
              <input
                required
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? startAt.slice(0, 10) : startAt}
                onChange={(e) => setStartAt(allDay ? `${e.target.value}T00:00` : e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">End</label>
              <input
                required
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? endAt.slice(0, 10) : endAt}
                onChange={(e) => setEndAt(allDay ? `${e.target.value}T23:59` : e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLASS} />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-md border border-error px-3 py-2 text-xs font-semibold text-error hover:bg-error hover:text-white disabled:opacity-60"
              >
                <IconTrash width={14} height={14} /> {deleting ? "Deleting…" : "Delete"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-bg">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
              >
                {saving ? "Saving…" : isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
