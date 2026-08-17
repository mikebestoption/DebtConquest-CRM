import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthStore } from "../../state/authStore";
import { fetchMe, updateMe, changePassword, uploadAvatar } from "../../api/auth";
import { ApiError } from "../../api/client";
import { IconCamera, IconUser } from "../layout/icons";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-ring";
const READONLY_CLASS = "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-muted";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ url, name, size = 56, onUpload }: { url: string | null; name: string; size?: number; onUpload?: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white/20 text-white" style={{ fontSize: size * 0.4 }}>
        {url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : onUpload ? initial : <IconUser width={size * 0.45} height={size * 0.45} />}
      </div>
      {onUpload && (
        <>
          <button
            type="button"
            title="Change photo"
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-teal text-white shadow-card hover:bg-teal-hover"
          >
            <IconCamera width={13} height={13} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}

function OverviewTab() {
  const staff = useAuthStore((s) => s.staff);
  const updateStaff = useAuthStore((s) => s.updateStaff);
  const [form, setForm] = useState({ firstName: staff?.firstName ?? "", lastName: staff?.lastName ?? "", phone: staff?.phone ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({ firstName: staff?.firstName ?? "", lastName: staff?.lastName ?? "", phone: staff?.phone ?? "" });
  }, [staff]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await updateMe({ firstName: form.firstName, lastName: form.lastName, phone: form.phone || null });
      updateStaff(res.staff);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!staff) return null;

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-ink">Profile Overview</h3>
        <span className="text-sm text-muted">Last Login: {formatDateTime(staff.lastLoginAt)}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-ink">Subscriber Name</label>
          <div className={READONLY_CLASS}>{staff.serviceCompany ?? "—"}</div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">Roles</label>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {staff.roles.length ? (
              staff.roles.map((r) => (
                <span key={r} className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted">
                  {r}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted">—</span>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">First Name</label>
          <input className={INPUT_CLASS} value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">Last Name</label>
          <input className={INPUT_CLASS} value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">Phone Number</label>
          <input className={INPUT_CLASS} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">Email</label>
          <div className={READONLY_CLASS}>{staff.email}</div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={() => setForm({ firstName: staff.firstName ?? "", lastName: staff.lastName ?? "", phone: staff.phone ?? "" })}
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

const REQUIREMENTS = ["Minimum 12 characters", "At least 1 uppercase letters", "At least 1 lowercase letters", "At least 1 special characters"];

function ResetPasswordTab() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(newPassword);
      setSuccess(true);
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-border bg-white p-5">
      <h3 className="mb-4 font-semibold text-ink">Reset Password</h3>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-ink">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${INPUT_CLASS} pr-9`}
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`${INPUT_CLASS} pr-9`}
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-teal/30 bg-teal/5 p-4">
          <p className="mb-2 text-sm font-semibold text-teal">Password Requirements</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {REQUIREMENTS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {success && <p className="mt-4 text-sm text-green-700">Password updated.</p>}

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            setNewPassword("");
            setConfirm("");
            setError(null);
          }}
          className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !newPassword || !confirm}
          className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const staff = useAuthStore((s) => s.staff);
  const updateStaff = useAuthStore((s) => s.updateStaff);
  const [tab, setTab] = useState<"overview" | "reset-password">("overview");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((res) => updateStaff(res.staff))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!staff) return null;
  const name = [staff.firstName, staff.lastName].filter(Boolean).join(" ") || staff.email;

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    try {
      const res = await uploadAvatar(file);
      updateStaff(res.staff);
    } catch {
      alert("Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink underline decoration-teal decoration-2 underline-offset-8">Profile</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-0 overflow-hidden rounded-card border border-border bg-white">
          <div className="flex items-center gap-3 bg-teal px-5 py-6">
            <Avatar url={staff.avatarUrl} name={name} onUpload={handleAvatarUpload} />
            <span className="font-semibold text-white">{uploading ? "Uploading…" : name}</span>
          </div>
          <nav className="p-2">
            <button
              onClick={() => setTab("overview")}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium ${
                tab === "overview" ? "bg-bg text-teal" : "text-ink hover:bg-bg"
              }`}
            >
              Overview <span>›</span>
            </button>
            <button
              onClick={() => setTab("reset-password")}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium ${
                tab === "reset-password" ? "bg-bg text-teal" : "text-ink hover:bg-bg"
              }`}
            >
              Reset Password <span>›</span>
            </button>
          </nav>
        </div>

        <div>{tab === "overview" ? <OverviewTab /> : <ResetPasswordTab />}</div>
      </div>
    </div>
  );
}
