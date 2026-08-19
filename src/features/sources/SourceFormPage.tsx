import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createSource, fetchSource, updateSource, type SourceInput } from "../../api/sources";
import { fetchRoles, type Role } from "../../api/roles";
import { LEAD_PROGRAMS, PROGRAM_LABELS, WORKLIST_STATUSES, STATUS_LABELS } from "../../api/worklist";
import { ApiError } from "../../api/client";
import { Checkbox, Radio, Select } from "../../components/controls";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";

interface FormState {
  name: string;
  defaultProgram: string;
  description: string;
  defaultPostStatus: string;
  allowToEnrol: boolean;
  isActive: boolean;
  visibleToRoleIds: number[];
  listId: string;
  externalId: string;
}

const EMPTY: FormState = {
  name: "",
  defaultProgram: "",
  description: "",
  defaultPostStatus: "",
  allowToEnrol: true,
  isActive: true,
  visibleToRoleIds: [],
  listId: "",
  externalId: "",
};

export function SourceFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [roles, setRoles] = useState<Role[]>([]);
  const [errors, setErrors] = useState<Partial<Record<"name" | "defaultProgram" | "defaultPostStatus", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    fetchRoles()
      .then((res) => setRoles(res.roles))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchSource(Number(id))
      .then((res) => {
        const s = res.source;
        setForm({
          name: s.name,
          defaultProgram: s.defaultProgram ?? "",
          description: s.description ?? "",
          defaultPostStatus: s.defaultPostStatus ?? "",
          allowToEnrol: s.allowToEnrol,
          isActive: s.isActive,
          visibleToRoleIds: s.visibleToRoleIds,
          listId: s.listId ?? "",
          externalId: s.externalId ?? "",
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load source"))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleRole(roleId: number) {
    setForm((p) => ({
      ...p,
      visibleToRoleIds: p.visibleToRoleIds.includes(roleId) ? p.visibleToRoleIds.filter((r) => r !== roleId) : [...p.visibleToRoleIds, roleId],
    }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Source Name is required.";
    if (!form.defaultProgram) next.defaultProgram = "Default Program is required.";
    if (!form.defaultPostStatus) next.defaultPostStatus = "Default Poststatus is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const input: SourceInput = {
        name: form.name,
        defaultProgram: form.defaultProgram as SourceInput["defaultProgram"],
        description: form.description || null,
        defaultPostStatus: form.defaultPostStatus as SourceInput["defaultPostStatus"],
        allowToEnrol: form.allowToEnrol,
        isActive: form.isActive,
        visibleToRoleIds: form.visibleToRoleIds,
        listId: form.listId || null,
        externalId: form.externalId || null,
      };
      if (isEdit) {
        await updateSource(Number(id), input);
      } else {
        await createSource(input);
      }
      navigate("/manager/leads/sources");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save source");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => navigate("/manager/leads/sources")} className="mb-1 text-sm text-muted hover:text-ink">
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold text-ink underline decoration-teal decoration-2 underline-offset-8">
          {isEdit ? "Edit Source" : "Add New Source"}
        </h1>
      </div>

      <div className="flex items-center justify-center gap-3 border-b border-border pb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-sm font-semibold text-white">1</div>
        <span className="text-sm font-semibold text-ink">Add Source</span>
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Basic Details</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-sm text-ink">Company Name</label>
            {/* Cosmetic only - single fixed company, see server schema.prisma's SourceDefinition.companyName comment. */}
            <Select defaultValue="DebtConquest INC" disabled>
              <option>DebtConquest INC</option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">
              Source Name <span className="text-error">*</span>
            </label>
            <input className={INPUT_CLASS} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">
              Default Program <span className="text-error">*</span>
            </label>
            <Select value={form.defaultProgram} onChange={(e) => setForm((p) => ({ ...p, defaultProgram: e.target.value }))}>
              <option value="">—</option>
              {LEAD_PROGRAMS.map((p) => (
                <option key={p} value={p}>
                  {PROGRAM_LABELS[p]}
                </option>
              ))}
            </Select>
            {errors.defaultProgram && <p className="mt-1 text-xs text-error">{errors.defaultProgram}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">Description</label>
            <textarea className={INPUT_CLASS} rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">
              Default Poststatus <span className="text-error">*</span>
            </label>
            <Select value={form.defaultPostStatus} onChange={(e) => setForm((p) => ({ ...p, defaultPostStatus: e.target.value }))}>
              <option value="">—</option>
              {WORKLIST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            {errors.defaultPostStatus && <p className="mt-1 text-xs text-error">{errors.defaultPostStatus}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-sm text-ink">Allow To Enrol</span>
              <div className="flex gap-6">
                <Radio name="allow-to-enrol" label="Yes" checked={form.allowToEnrol} onChange={() => setForm((p) => ({ ...p, allowToEnrol: true }))} />
                <Radio name="allow-to-enrol" label="No" checked={!form.allowToEnrol} onChange={() => setForm((p) => ({ ...p, allowToEnrol: false }))} />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm text-ink">Active</span>
              <div className="flex gap-6">
                <Radio name="source-active" label="Yes" checked={form.isActive} onChange={() => setForm((p) => ({ ...p, isActive: true }))} />
                <Radio name="source-active" label="No" checked={!form.isActive} onChange={() => setForm((p) => ({ ...p, isActive: false }))} />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">Visible only to Roles</label>
            <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
              {roles.length === 0 && <span className="text-sm text-muted">No roles found.</span>}
              {roles.map((r) => (
                <Checkbox key={r.id} checked={form.visibleToRoleIds.includes(r.id)} onChange={() => toggleRole(r.id)} label={r.name} />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Leave all unchecked for visible to everyone.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">List Id</label>
            <input className={INPUT_CLASS} value={form.listId} onChange={(e) => setForm((p) => ({ ...p, listId: e.target.value }))} />
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink">External Id</label>
            <input className={INPUT_CLASS} value={form.externalId} onChange={(e) => setForm((p) => ({ ...p, externalId: e.target.value }))} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate("/manager/leads/sources")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
