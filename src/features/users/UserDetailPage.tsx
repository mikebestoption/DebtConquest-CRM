import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { assignRoles, fetchUser, resendInvite, updateUser, updateUserSettings, unassignRole, type UserDetail, type UserSettings } from "../../api/users";
import { RoleAssignModal } from "./RoleAssignModal";
import { Toggle } from "../leadDetail/formFields";
import { IconChevronLeft, IconMail, IconPlus, IconTrash, IconUser } from "../layout/icons";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";
const LANGUAGE_OPTIONS = ["English", "Spanish"];
type Tab = "User Details" | "Roles" | "Settings";

function DetailsTab({ user, onSaved }: { user: UserDetail; onSaved: (u: UserDetail) => void }) {
  const [form, setForm] = useState({
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    email: user.email,
    languagesSpoken: user.languagesSpoken ?? "English",
    isActive: user.isActive,
    calendarLink: user.calendarLink ?? "",
    jobTitle: user.jobTitle ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      phone: user.phone ?? "",
      email: user.email,
      languagesSpoken: user.languagesSpoken ?? "English",
      isActive: user.isActive,
      calendarLink: user.calendarLink ?? "",
      jobTitle: user.jobTitle ?? "",
    });
  }, [user]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateUser(user.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        languagesSpoken: form.languagesSpoken,
        isActive: form.isActive,
        calendarLink: form.calendarLink || null,
        jobTitle: form.jobTitle || null,
      });
      onSaved(res.user);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Basic Details</h3>
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
            <label className="mb-1 block text-xs text-muted">Phone Number</label>
            <input className={INPUT_CLASS} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Email</label>
            <input className={INPUT_CLASS} type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Languages Spoken</label>
            <select className={INPUT_CLASS} value={form.languagesSpoken} onChange={(e) => setForm((p) => ({ ...p, languagesSpoken: e.target.value }))}>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-xs text-muted">Login</span>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" className="accent-teal" checked={form.isActive} onChange={() => setForm((p) => ({ ...p, isActive: true }))} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" className="accent-teal" checked={!form.isActive} onChange={() => setForm((p) => ({ ...p, isActive: false }))} />
              Inactive
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Additional Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Calendar Link</label>
            <input className={INPUT_CLASS} value={form.calendarLink} onChange={(e) => setForm((p) => ({ ...p, calendarLink: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Job Title</label>
            <input className={INPUT_CLASS} value={form.jobTitle} onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <h3 className="mb-4 font-semibold text-ink">Service Company Selection</h3>
        <select className={INPUT_CLASS} defaultValue={user.serviceCompany ?? "DebtConquest INC"} disabled>
          <option>{user.serviceCompany ?? "DebtConquest INC"}</option>
        </select>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() =>
            setForm({
              firstName: user.firstName ?? "",
              lastName: user.lastName ?? "",
              phone: user.phone ?? "",
              email: user.email,
              languagesSpoken: user.languagesSpoken ?? "English",
              isActive: user.isActive,
              calendarLink: user.calendarLink ?? "",
              jobTitle: user.jobTitle ?? "",
            })
          }
          className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg"
        >
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function RolesTab({ user, onSaved }: { user: UserDetail; onSaved: (u: UserDetail) => void }) {
  const navigate = useNavigate();
  const [showAssign, setShowAssign] = useState(false);

  async function handleRemove(roleId: number) {
    const res = await unassignRole(user.id, roleId);
    onSaved(res.user);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Assigned Roles ({user.roleAssignments.length})</h3>
        <button
          onClick={() => setShowAssign(true)}
          className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
        >
          <IconPlus width={16} height={16} /> Assign Role
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted">
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {user.roleAssignments.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  No data is available for display. Please click "Assign Role".
                </td>
              </tr>
            ) : (
              user.roleAssignments.map((r) => (
                <tr key={r.roleId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink">{r.name}</td>
                  <td className="px-4 py-3 text-muted">{r.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button title="Remove" className="rounded p-1 text-muted hover:bg-bg hover:text-error" onClick={() => handleRemove(r.roleId)}>
                      <IconTrash width={14} height={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate("/manager/users")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
          Cancel
        </button>
        <button onClick={() => navigate("/manager/users")} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
          Save
        </button>
      </div>

      {showAssign && (
        <RoleAssignModal
          excludeRoleIds={user.roleAssignments.map((r) => r.roleId)}
          onClose={() => setShowAssign(false)}
          onAssign={async (roles) => {
            const res = await assignRoles(user.id, roles.map((r) => r.id));
            onSaved(res.user);
            setShowAssign(false);
          }}
        />
      )}
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
            <Toggle label="New User" checked={settings.newUserLeadRouting} onChange={(v) => setSettings((p) => ({ ...p, newUserLeadRouting: v }))} />
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
          <Toggle
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
          <h1 className="mb-4 text-2xl font-bold text-ink underline decoration-teal decoration-2 underline-offset-8">
            User - {user.name}
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-muted">
              <IconUser width={24} height={24} />
            </div>
            <div>
              <p className="font-bold text-ink">{user.serviceCompany ?? "DebtConquest INC"}</p>
              <p className="text-sm text-muted">{user.email}</p>
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
        {(["User Details", "Roles", "Settings"] as const).map((t) => (
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
      {tab === "Roles" && <RolesTab user={user} onSaved={setUser} />}
      {tab === "Settings" && <SettingsTab user={user} onSaved={setUser} />}
    </div>
  );
}
