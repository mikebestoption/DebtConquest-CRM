import { useEffect, useState, type FormEvent } from "react";
import {
  LEAD_PROGRAMS,
  LEAD_SOURCES,
  PROGRAM_LABELS,
  SOURCE_LABELS,
  createLead,
  type CreateLeadInput,
  type LeadProgram,
  type LeadSource,
} from "../../api/worklist";
import { fetchStaff, type StaffOption } from "../../api/staff";
import { ApiError } from "../../api/client";
import { IconX } from "../layout/icons";
import { Select } from "../../components/controls";

interface AddLeadModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-teal";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export function AddLeadModal({ onClose, onCreated }: AddLeadModalProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [form, setForm] = useState<CreateLeadInput>({ firstName: "", lastName: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStaff()
      .then((res) => setStaff(res.staff))
      .catch(() => setStaff([]));
  }, []);

  function patch(partial: Partial<CreateLeadInput>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createLead(form);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-card bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Add New Lead</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-bg" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input
                required
                value={form.firstName}
                onChange={(e) => patch({ firstName: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Last Name" required>
              <input required value={form.lastName} onChange={(e) => patch({ lastName: e.target.value })} className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cell Phone" required>
              <input required value={form.phone} onChange={(e) => patch({ phone: e.target.value })} className={INPUT_CLASS} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email ?? ""} onChange={(e) => patch({ email: e.target.value || undefined })} className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="State">
              <Select value={form.state ?? ""} onChange={(e) => patch({ state: e.target.value || undefined })}>
                <option value="">—</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Program">
              <Select value={form.program ?? ""} onChange={(e) => patch({ program: (e.target.value || undefined) as LeadProgram | undefined })}>
                <option value="">—</option>
                {LEAD_PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {PROGRAM_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Select value={form.source ?? "WEB"} onChange={(e) => patch({ source: e.target.value as LeadSource })}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Assign To">
            <Select value={form.assignedStaffId ?? ""} onChange={(e) => patch({ assignedStaffId: e.target.value || undefined })}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                </option>
              ))}
            </Select>
          </Field>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-bg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
    </label>
  );
}
