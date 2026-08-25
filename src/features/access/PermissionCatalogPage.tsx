import { useCallback, useEffect, useState } from "react";
import { fetchPermissions, registerPermission, type PermissionCatalogItem } from "../../api/permission";
import { IconPlus } from "../layout/icons";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";

const STATUS_PILL: Record<PermissionCatalogItem["status"], string> = {
  ACTIVE: "bg-green-50 text-green-700",
  RESTRICTED: "bg-amber-50 text-amber-700",
  UNASSIGNED: "bg-gray-100 text-gray-600",
};

export function PermissionCatalogPage() {
  const [search, setSearch] = useState("");
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ module: "", key: "", name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchPermissions({ search: search || undefined })
      .then((res) => setPermissions(res.permissions))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRegister() {
    if (!form.module.trim() || !form.key.trim() || !form.name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await registerPermission({ module: form.module, key: form.key, name: form.name, description: form.description || undefined });
      setForm({ module: "", key: "", name: "", description: "" });
      setShowRegister(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register permission");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Permission Catalog</h1>
          <p className="mt-0.5 text-sm text-muted">The single source of truth for every permission any feature has registered.</p>
        </div>
        <button
          onClick={() => setShowRegister((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
        >
          <IconPlus width={16} height={16} /> Register Permission
        </button>
      </div>

      <input
        type="text"
        placeholder="Search permission key or description"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-72 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
      />

      {showRegister && (
        <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-white p-5 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-muted">Module</label>
            <input className={INPUT_CLASS} value={form.module} onChange={(e) => setForm((p) => ({ ...p, module: e.target.value }))} placeholder="Settlement Offers" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Key</label>
            <input className={INPUT_CLASS} value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} placeholder="settlement_offer.approve" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input className={INPUT_CLASS} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Approve Settlement Offer" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Description</label>
            <input className={INPUT_CLASS} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          {formError && <p className="text-sm text-error sm:col-span-4">{formError}</p>}
          <div className="sm:col-span-4">
            <button
              onClick={handleRegister}
              disabled={submitting || !form.module.trim() || !form.key.trim() || !form.name.trim()}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
            >
              {submitting ? "Registering…" : "Register Permission"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Permission Key</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Added In</th>
                <th className="px-4 py-3">Profiles Using</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading &&
                permissions.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-ink">{p.module}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-ink">{p.key}</code>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.name}{p.description ? ` — ${p.description}` : ""}</td>
                    <td className="px-4 py-3 text-muted">{p.addedInVersion ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.profilesUsing}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[p.status]}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Default-safe behavior.</strong> Newly registered permissions are never automatically granted. An administrator
        adds them to the right Access Profiles and publishes a new policy version.
      </div>
    </div>
  );
}
