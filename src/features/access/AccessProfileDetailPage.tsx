import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAccessProfile, patchAccessProfilePermission, publishAccessProfile, type AccessProfileDetail, type AccessScope } from "../../api/accessProfile";
import { Checkbox, Select } from "../../components/controls";
import { IconChevronLeft } from "../layout/icons";

const SCOPE_OPTIONS: { value: AccessScope | ""; label: string }[] = [
  { value: "", label: "— (unscoped)" },
  { value: "SELF", label: "Self" },
  { value: "LIMITED_TEAM", label: "Limited Team" },
  { value: "TEAM", label: "Team" },
  { value: "ORG_UNIT", label: "Org Unit" },
  { value: "ASSIGNED_ORG_UNITS", label: "Assigned Org Units" },
  { value: "DEPARTMENT", label: "Department" },
];

export function AccessProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AccessProfileDetail | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchAccessProfile(Number(id)).then((res) => setProfile(res.profile));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile) return <p className="text-sm text-muted">Loading…</p>;

  async function handleToggle(permissionId: number, allowed: boolean) {
    await patchAccessProfilePermission(profile!.id, permissionId, { allowed });
    setDirty(true);
    load();
  }

  async function handleScopeChange(permissionId: number, scope: AccessScope | "") {
    await patchAccessProfilePermission(profile!.id, permissionId, { scope: scope || null });
    setDirty(true);
    load();
  }

  async function handlePublish() {
    const summary = prompt("Summarize this change for the Policy Versions log:");
    if (!summary) return;
    setPublishing(true);
    try {
      await publishAccessProfile(profile!.id, summary);
      setDirty(false);
      load();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/manager/access/profiles")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconChevronLeft width={16} height={16} /> Back to Access Profiles
      </button>

      <h1 className="text-2xl font-bold text-ink">
        {profile.department} — {profile.jobTitle}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="Department" value={profile.department} />
        <SummaryBox label="Job Title" value={profile.jobTitle} />
        <SummaryBox label="Default Scope" value={profile.defaultScope} />
        <SummaryBox label="Current Version" value={`v${profile.version}`} />
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Modular rule.</strong> New features register new permission keys in the Permission Catalog. They stay unassigned
        until explicitly added here and published in a new policy version.
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink">Permissions</h3>
            <p className="text-xs text-muted">Action and data scope are configured separately.</p>
          </div>
          <button
            onClick={handlePublish}
            disabled={publishing || !dirty}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-50"
            title={dirty ? undefined : "No unpublished changes"}
          >
            {publishing ? "Publishing…" : "Publish Changes"}
          </button>
        </div>

        <div className="space-y-5">
          {profile.modules.map((mod) => (
            <div key={mod.module} className="overflow-hidden rounded-md border border-border">
              <div className="flex items-center justify-between bg-bg px-4 py-2.5">
                <span className="font-semibold text-ink">{mod.module}</span>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal">{mod.permissions.length} permissions</span>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-muted">
                    <th className="px-4 py-2">Permission</th>
                    <th className="px-4 py-2">Allowed</th>
                    <th className="px-4 py-2">Scope</th>
                    <th className="px-4 py-2">Key</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mod.permissions.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-ink">{p.name}</td>
                      <td className="px-4 py-2.5">
                        <Checkbox checked={p.allowed} onChange={(v) => handleToggle(p.id, v)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Select fitContent value={p.scope ?? ""} onChange={(e) => handleScopeChange(p.id, e.target.value as AccessScope | "")}>
                          {SCOPE_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="rounded bg-bg px-1.5 py-0.5 text-xs text-ink">{p.key}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            !p.allowed ? "bg-gray-100 text-gray-600" : p.status === "RESTRICTED" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                          }`}
                        >
                          {!p.allowed ? "Not Assigned" : p.status === "RESTRICTED" ? "Restricted" : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-bg/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
