import { useCallback, useEffect, useState } from "react";
import { fetchDepartments, fetchOrgTree, fetchTeams, createTeam, type Department, type OrgUnitNode, type TeamListItem } from "../../api/orgHierarchy";
import { IconPlus } from "../layout/icons";
import { Select } from "../../components/controls";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";

// Flattens an org tree down to the level Team.orgUnitId actually attaches
// to - the leaf tier (Sales' Conference under VP Organization; the single
// tier everywhere else) - see OrganizationFields.tsx for the same shape.
function flattenLeafOrgUnits(nodes: OrgUnitNode[]): { id: number; label: string }[] {
  return nodes.flatMap((root) => (root.children.length ? root.children.map((c) => ({ id: c.id, label: `${root.name} / ${c.name}` })) : [{ id: root.id, label: root.name }]));
}

export function TeamsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [leafOrgUnits, setLeafOrgUnits] = useState<{ id: number; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ orgUnitId: "", name: "", capacity: "6" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments().then((res) => {
      setDepartments(res.departments);
      if (res.departments.length) setDepartmentId(res.departments[0].id);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchTeams(departmentId || undefined)
      .then((res) => setTeams(res.teams))
      .finally(() => setLoading(false));
  }, [departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!departmentId) return;
    fetchOrgTree(departmentId).then((res) => setLeafOrgUnits(flattenLeafOrgUnits(res.orgUnits)));
  }, [departmentId]);

  async function handleCreate() {
    if (!form.orgUnitId || !form.name.trim()) return;
    setSubmitting(true);
    try {
      await createTeam({ orgUnitId: Number(form.orgUnitId), name: form.name, capacity: Number(form.capacity) || 6 });
      setForm({ orgUnitId: "", name: "", capacity: "6" });
      setShowCreate(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Teams</h1>
          <p className="mt-0.5 text-sm text-muted">Manage team membership and keep capacity honest.</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
        >
          <IconPlus width={16} height={16} /> Create Team
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-white p-4">
        <Select
          fitContent
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>

      {showCreate && (
        <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-white p-5 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Org Unit</label>
            <Select value={form.orgUnitId} onChange={(e) => setForm((p) => ({ ...p, orgUnitId: e.target.value }))}>
              <option value="">Select org unit</option>
              {leafOrgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Team Name</label>
            <input className={INPUT_CLASS} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Capacity</label>
            <input type="number" className={INPUT_CLASS} value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} />
          </div>
          <div className="sm:col-span-3">
            <button
              onClick={handleCreate}
              disabled={submitting || !form.orgUnitId || !form.name.trim()}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create Team"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Org Unit</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && teams.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    No teams yet.
                  </td>
                </tr>
              )}
              {!loading &&
                teams.map((t) => {
                  const memberCount = t.staff.length;
                  const full = memberCount >= t.capacity;
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                      <td className="px-4 py-3 text-muted">{t.orgUnit.name}</td>
                      <td className="px-4 py-3 text-muted">
                        {t.staff
                          .map((s) => [s.firstName, s.lastName].filter(Boolean).join(" "))
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${full ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {memberCount} / {t.capacity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
