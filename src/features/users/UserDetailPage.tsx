import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchUser,
  resendInvite,
  updateUser,
  updateUserSettings,
  type UserDetail,
  type UserSettings,
  type EmploymentStatus,
  type EmploymentType,
  type WorkLocation,
} from "../../api/users";
import {
  fetchDepartments,
  fetchJobTitles,
  fetchOrgTree,
  fetchEligibleManagers,
  type Department,
  type JobTitle,
  type OrgUnitNode,
  type EligibleManager,
} from "../../api/orgHierarchy";
import { fetchAccessPreview, type AccessPreview } from "../../api/accessProfile";
import { fetchPermissions, type PermissionCatalogItem } from "../../api/permission";
import { fetchTemporaryExceptions, createTemporaryException, revokeTemporaryException, type TemporaryException } from "../../api/temporaryAccessException";
import { IconChevronLeft, IconMail, IconPlus, IconTrash, IconUser } from "../layout/icons";
import { Select, Switch, Checkbox } from "../../components/controls";
import { OrganizationFields, type OrgValue } from "./OrganizationFields";
import { AccessPreviewCard } from "./AccessPreviewCard";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";
const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "Vietnamese"];
const TIME_ZONE_OPTIONS = ["Eastern Time", "Central Time", "Mountain Time", "Pacific Time"];
type Tab = "User Details" | "Organization" | "Access" | "Settings";

function parseLanguages(csv: string | null): string[] {
  return csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function DetailsTab({ user, onSaved }: { user: UserDetail; onSaved: (u: UserDetail) => void }) {
  const [form, setForm] = useState({
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    preferredName: user.preferredName ?? "",
    phone: user.phone ?? "",
    email: user.email,
    languagesSpoken: parseLanguages(user.languagesSpoken),
    timeZone: user.timeZone ?? "Eastern Time",
    employmentStatus: user.employmentStatus,
    isActive: user.isActive,
    calendarLink: user.calendarLink ?? "",
    employmentType: user.employmentType ?? "EMPLOYEE",
    workLocation: user.workLocation ?? "OFFICE",
    hireDate: user.hireDate ? user.hireDate.slice(0, 10) : "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      preferredName: user.preferredName ?? "",
      phone: user.phone ?? "",
      email: user.email,
      languagesSpoken: parseLanguages(user.languagesSpoken),
      timeZone: user.timeZone ?? "Eastern Time",
      employmentStatus: user.employmentStatus,
      isActive: user.isActive,
      calendarLink: user.calendarLink ?? "",
      employmentType: user.employmentType ?? "EMPLOYEE",
      workLocation: user.workLocation ?? "OFFICE",
      hireDate: user.hireDate ? user.hireDate.slice(0, 10) : "",
    });
  }, [user]);

  function toggleLanguage(lang: string) {
    setForm((p) => ({ ...p, languagesSpoken: p.languagesSpoken.includes(lang) ? p.languagesSpoken.filter((l) => l !== lang) : [...p.languagesSpoken, lang] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateUser(user.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        preferredName: form.preferredName || null,
        phone: form.phone,
        email: form.email,
        languagesSpoken: form.languagesSpoken,
        timeZone: form.timeZone,
        employmentStatus: form.employmentStatus,
        isActive: form.isActive,
        calendarLink: form.calendarLink || null,
        employmentType: form.employmentType,
        workLocation: form.workLocation,
        hireDate: form.hireDate || null,
      });
      onSaved(res.user);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Basic Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Id</label>
            <input className={`${INPUT_CLASS} bg-bg text-muted`} value={user.staffNumber} disabled />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">First Name</label>
            <input className={INPUT_CLASS} value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Last Name</label>
            <input className={INPUT_CLASS} value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Preferred Name</label>
            <input className={INPUT_CLASS} value={form.preferredName} onChange={(e) => setForm((p) => ({ ...p, preferredName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Work Phone</label>
            <input className={INPUT_CLASS} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Work Email</label>
            <input className={INPUT_CLASS} type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Time Zone</label>
            <Select value={form.timeZone} onChange={(e) => setForm((p) => ({ ...p, timeZone: e.target.value }))}>
              {TIME_ZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Employee Status</label>
            <Select value={form.employmentStatus} onChange={(e) => setForm((p) => ({ ...p, employmentStatus: e.target.value as EmploymentStatus }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="LEAVE">Leave</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Languages Spoken</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-white px-3 py-2.5">
              {LANGUAGE_OPTIONS.map((lang) => (
                <Checkbox key={lang} label={lang} checked={form.languagesSpoken.includes(lang)} onChange={() => toggleLanguage(lang)} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Switch label="Login Enabled" checked={form.isActive} onChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
        </div>
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Employment Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Employment Type</label>
            <Select value={form.employmentType} onChange={(e) => setForm((p) => ({ ...p, employmentType: e.target.value as EmploymentType }))}>
              <option value="EMPLOYEE">Employee</option>
              <option value="CONTRACTOR">Contractor</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Hire Date</label>
            <input type="date" className={INPUT_CLASS} value={form.hireDate} onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Work Location</label>
            <Select value={form.workLocation} onChange={(e) => setForm((p) => ({ ...p, workLocation: e.target.value as WorkLocation }))}>
              <option value="REMOTE">Remote</option>
              <option value="OFFICE">Office</option>
              <option value="HYBRID">Hybrid</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Calendar Link</label>
            <input className={INPUT_CLASS} value={form.calendarLink} onChange={(e) => setForm((p) => ({ ...p, calendarLink: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function OrganizationTab({ user, onSaved }: { user: UserDetail; onSaved: (u: UserDetail) => void }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | undefined>(user.departmentId ?? undefined);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [jobTitleId, setJobTitleId] = useState<number | undefined>(user.jobTitleId ?? undefined);
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);
  const [org, setOrg] = useState<OrgValue>({ orgUnitId: user.orgUnitId ?? undefined, teamId: user.teamId ?? undefined, assignedOrgUnitIds: user.assignedOrgUnitIds });
  const [reportsToStaffId, setReportsToStaffId] = useState<string | undefined>(user.reportsToStaffId ?? undefined);
  const [eligibleManagers, setEligibleManagers] = useState<EligibleManager[]>([]);
  const [preview, setPreview] = useState<AccessPreview | null>(user.accessPreview);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments().then((res) => setDepartments(res.departments));
  }, []);

  useEffect(() => {
    if (!departmentId) return;
    Promise.all([fetchJobTitles(departmentId), fetchOrgTree(departmentId)]).then(([jt, tree]) => {
      setJobTitles(jt.jobTitles);
      setOrgTree(tree.orgUnits);
    });
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId || !jobTitleId) return;
    fetchEligibleManagers({ departmentId, jobTitleId, orgUnitId: org.orgUnitId, teamId: org.teamId }).then((res) => setEligibleManagers(res.managers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, jobTitleId, org.orgUnitId, org.teamId]);

  useEffect(() => {
    if (!departmentId || !jobTitleId) return;
    fetchAccessPreview({ departmentId, jobTitleId, orgUnitId: org.orgUnitId, teamId: org.teamId, assignedOrgUnitIds: org.assignedOrgUnitIds }).then((res) => setPreview(res.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, jobTitleId, org.orgUnitId, org.teamId, org.assignedOrgUnitIds.join(",")]);

  const department = departments.find((d) => d.id === departmentId);
  const jobTitle = jobTitles.find((t) => t.id === jobTitleId);
  const changed = departmentId !== user.departmentId || jobTitleId !== user.jobTitleId;

  async function handleSave() {
    if (!departmentId || !jobTitleId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateUser(user.id, {
        departmentId,
        jobTitleId,
        orgUnitId: org.orgUnitId ?? null,
        teamId: org.teamId ?? null,
        assignedOrgUnitIds: org.assignedOrgUnitIds,
        reportsToStaffId: reportsToStaffId ?? null,
      });
      onSaved(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {changed && (
        <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>This will update {user.department ?? "(no department)"} — {user.jobTitle ?? "(no title)"} → {department?.name} — {jobTitle?.name}.</strong>{" "}
          Access is recalculated automatically and logged to the Access Audit Log as a {user.departmentId !== departmentId ? "transfer" : "promotion"} on save.
        </div>
      )}

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Department &amp; Title</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Department</label>
            <Select
              value={departmentId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setDepartmentId(id);
                setJobTitleId(undefined);
                setOrg({ assignedOrgUnitIds: [] });
              }}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Job Title</label>
            <Select
              value={jobTitleId ?? ""}
              onChange={(e) => {
                setJobTitleId(Number(e.target.value));
                setOrg({ assignedOrgUnitIds: [] });
              }}
            >
              <option value="">Select Job Title</option>
              {jobTitles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Organizational Assignment</h3>
        {department && jobTitle && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <OrganizationFields department={department} orgTree={orgTree} jobTitle={jobTitle} value={org} onChange={(patch) => setOrg((p) => ({ ...p, ...patch }))} />
          </div>
        )}
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Reporting Relationship</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Reports To</label>
            <Select value={reportsToStaffId ?? ""} onChange={(e) => setReportsToStaffId(e.target.value || undefined)}>
              <option value="">{department?.reportsToLabel ? `(top of ${department.name} — reports to ${department.reportsToLabel})` : "None"}</option>
              {eligibleManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <AccessPreviewCard preview={preview} />

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={handleSave} disabled={saving || !changed} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
          {saving ? "Saving…" : changed ? "Confirm & Save" : "No Changes"}
        </button>
      </div>
    </div>
  );
}

function AccessTab({ user }: { user: UserDetail }) {
  const [exceptions, setExceptions] = useState<TemporaryException[]>([]);
  const [showRequest, setShowRequest] = useState(false);
  const [permissions, setPermissions] = useState<PermissionCatalogItem[]>([]);
  const [form, setForm] = useState({ permissionId: "", reason: "", expiresAt: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    fetchTemporaryExceptions(user.id).then((res) => setExceptions(res.exceptions));
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showRequest && permissions.length === 0) fetchPermissions().then((res) => setPermissions(res.permissions));
  }, [showRequest, permissions.length]);

  async function handleRequest() {
    if (!form.permissionId || !form.reason || !form.expiresAt) return;
    setSubmitting(true);
    try {
      await createTemporaryException(user.id, { permissionId: Number(form.permissionId), reason: form.reason, expiresAt: new Date(form.expiresAt).toISOString() });
      setForm({ permissionId: "", reason: "", expiresAt: "" });
      setShowRequest(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: number) {
    if (!confirm("Revoke this temporary exception?")) return;
    await revokeTemporaryException(user.id, id);
    load();
  }

  return (
    <div className="space-y-5">
      <AccessPreviewCard preview={user.accessPreview} />

      <div className="rounded-card border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink">Temporary Access Exceptions</h3>
            <p className="text-xs text-muted">Rare, approved, time-limited, and fully audited - not a substitute for the right title.</p>
          </div>
          <button
            onClick={() => setShowRequest((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
          >
            <IconPlus width={16} height={16} /> Request Exception
          </button>
        </div>

        {showRequest && (
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-border bg-bg/40 p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Permission</label>
              <Select value={form.permissionId} onChange={(e) => setForm((p) => ({ ...p, permissionId: e.target.value }))}>
                <option value="">Select permission</option>
                {permissions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.module} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Reason</label>
              <input className={INPUT_CLASS} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Expires</label>
              <input type="date" className={INPUT_CLASS} value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} />
            </div>
            <div className="sm:col-span-3">
              <button
                onClick={handleRequest}
                disabled={submitting || !form.permissionId || !form.reason || !form.expiresAt}
                className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Grant Exception"}
              </button>
            </div>
          </div>
        )}

        {exceptions.length === 0 ? (
          <p className="text-sm text-muted">No active temporary exceptions.</p>
        ) : (
          <div className="divide-y divide-border">
            {exceptions.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">
                    {e.permission.module} — {e.permission.name}
                  </p>
                  <p className="text-xs text-muted">
                    {e.reason} · expires {new Date(e.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button title="Revoke" className="rounded p-1 text-muted hover:bg-bg hover:text-error" onClick={() => handleRevoke(e.id)}>
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ user, onSaved }: { user: UserDetail; onSaved: (u: UserDetail) => void }) {
  const [settings, setSettings] = useState<UserSettings>(user.settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => setSettings(user.settings), [user]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateUserSettings(user.id, settings);
      onSaved(res.user);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Get Lead Configuration</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Switch label="New User" checked={settings.newUserLeadRouting} onChange={(v) => setSettings((p) => ({ ...p, newUserLeadRouting: v }))} />
            <div className="max-w-xs">
              <label className="mb-1 block text-xs text-muted">Get Lead Daily Max</label>
              <input
                type="number"
                className={INPUT_CLASS}
                value={settings.getLeadDailyMax ?? ""}
                onChange={(e) => setSettings((p) => ({ ...p, getLeadDailyMax: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </div>
          </div>
          <Switch
            label="Include the Leads in Bouncing Pool"
            checked={settings.includeInBouncingPool}
            onChange={(v) => setSettings((p) => ({ ...p, includeInBouncingPool: v }))}
          />
        </div>
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Lead Distribution</h3>
        <div className="max-w-xs">
          <label className="mb-1 block text-xs text-muted">Daily Max</label>
          <input
            type="number"
            className={INPUT_CLASS}
            value={settings.leadDistributionDailyMax ?? ""}
            onChange={(e) => setSettings((p) => ({ ...p, leadDistributionDailyMax: e.target.value === "" ? null : Number(e.target.value) }))}
          />
        </div>
      </div>

      <p className="text-xs text-muted">
        These settings are stored but not yet wired to any actual lead-routing logic - no automatic distribution/bouncing-pool system exists in the app yet.
      </p>

      <div className="flex justify-end gap-3">
        <button onClick={() => setSettings(user.settings)} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [tab, setTab] = useState<Tab>("User Details");
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchUser(id)
      .then((res) => setUser(res.user))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load user"));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!user) return <p className="text-sm text-muted">Loading…</p>;

  async function handleResendInvite() {
    if (!user) return;
    setResending(true);
    try {
      await resendInvite(user.id);
      alert(`Invite email sent to ${user.email}.`);
    } catch {
      alert("Failed to send invite email.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/manager/users")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconChevronLeft width={16} height={16} /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-4 text-2xl font-bold text-ink underline decoration-teal decoration-2 underline-offset-8">User - {user.name}</h1>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-muted">
              <IconUser width={24} height={24} />
            </div>
            <div>
              <p className="font-bold text-ink">
                {user.department ?? "(no department)"} — {user.jobTitle ?? "(no title)"}
              </p>
              <p className="text-sm text-muted">{user.email}</p>
              {user.accessProfile && <p className="font-mono text-xs text-muted">{user.accessProfile.code} · v{user.accessProfile.version}</p>}
              {!user.hasPassword && <p className="text-xs text-amber-700">No password set yet - invite email not yet accepted.</p>}
            </div>
          </div>
        </div>
        <button
          onClick={handleResendInvite}
          disabled={resending}
          className="flex items-center gap-1.5 rounded-md border border-teal px-3 py-2 text-sm font-medium text-teal hover:bg-bg disabled:opacity-50"
        >
          <IconMail width={14} height={14} /> Resend Invite
        </button>
      </div>

      <div className="flex gap-6 border-b border-border">
        {(["User Details", "Organization", "Access", "Settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 pb-2 text-sm font-semibold ${tab === t ? "border-teal text-teal" : "border-transparent text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "User Details" && <DetailsTab user={user} onSaved={setUser} />}
      {tab === "Organization" && <OrganizationTab user={user} onSaved={setUser} />}
      {tab === "Access" && <AccessTab user={user} />}
      {tab === "Settings" && <SettingsTab user={user} onSaved={setUser} />}
    </div>
  );
}
