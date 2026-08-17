import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser } from "../../api/users";
import type { Role } from "../../api/roles";
import { RoleAssignModal } from "./RoleAssignModal";
import { IconPlus, IconTrash } from "../layout/icons";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";
const LANGUAGE_OPTIONS = ["English", "Spanish"];

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  languagesSpoken: string;
  calendarLink: string;
  jobTitle: string;
}

const EMPTY_FORM: FormState = { firstName: "", lastName: "", phone: "", email: "", languagesSpoken: "English", calendarLink: "", jobTitle: "" };

export function AddUserPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function handleContinue() {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) next.firstName = "First Name is required.";
    if (!form.lastName.trim()) next.lastName = "Last Name is required.";
    if (!form.phone.trim()) next.phone = "Phone Number is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    setErrors(next);
    if (Object.keys(next).length === 0) setStep(2);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        languagesSpoken: form.languagesSpoken,
        calendarLink: form.calendarLink || undefined,
        jobTitle: form.jobTitle || undefined,
        serviceCompany: "DebtConquest INC",
        roleIds: roles.map((r) => r.id),
      });
      navigate(`/manager/users/${res.user.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => navigate("/manager/users")} className="mb-1 text-sm text-muted hover:text-ink">
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold text-ink underline decoration-teal decoration-2 underline-offset-8">Add New User</h1>
      </div>

      <div className="flex items-center justify-center gap-24 border-b border-border pb-4">
        {(["User Details", "Assign Roles"] as const).map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                step === i + 1 ? "bg-teal text-white" : "bg-bg text-muted"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? "font-semibold text-ink" : "text-muted"}`}>{label}</span>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 font-semibold text-ink">Basic Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <input className={INPUT_CLASS} placeholder="First Name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                {errors.firstName && <p className="mt-1 text-xs text-error">{errors.firstName}</p>}
              </div>
              <div>
                <input className={INPUT_CLASS} placeholder="Last Name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                {errors.lastName && <p className="mt-1 text-xs text-error">{errors.lastName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Languages Spoken</label>
                <select className={INPUT_CLASS} value={form.languagesSpoken} onChange={(e) => set("languagesSpoken", e.target.value)}>
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input className={INPUT_CLASS} placeholder="Phone Number" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                {errors.phone && <p className="mt-1 text-xs text-error">{errors.phone}</p>}
              </div>
              <div>
                <input className={INPUT_CLASS} type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 font-semibold text-ink">Additional Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input className={INPUT_CLASS} placeholder="Calendar Link" value={form.calendarLink} onChange={(e) => set("calendarLink", e.target.value)} />
              <input className={INPUT_CLASS} placeholder="Job Title" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 font-semibold text-ink">Service Company Selection</h3>
            {/* Cosmetic only - single fixed company, see server schema.prisma's Staff.serviceCompany comment. */}
            <select className={INPUT_CLASS} defaultValue="DebtConquest INC" disabled>
              <option>DebtConquest INC</option>
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => navigate("/manager/users")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
              Cancel
            </button>
            <button onClick={handleContinue} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Assigned Roles ({roles.length})</h3>
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
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted">
                      No data is available for display. Please click "Assign Role".
                    </td>
                  </tr>
                ) : (
                  roles.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-ink">{r.name}</td>
                      <td className="px-4 py-3 text-muted">{r.description ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          title="Remove"
                          className="rounded p-1 text-muted hover:bg-bg hover:text-error"
                          onClick={() => setRoles((prev) => prev.filter((role) => role.id !== r.id))}
                        >
                          <IconTrash width={14} height={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
              Back
            </button>
            <div className="flex gap-3">
              <button onClick={() => navigate("/manager/users")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
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
        </div>
      )}

      {showAssign && (
        <RoleAssignModal
          excludeRoleIds={roles.map((r) => r.id)}
          onClose={() => setShowAssign(false)}
          onAssign={(newRoles) => {
            setRoles((prev) => [...prev, ...newRoles]);
            setShowAssign(false);
          }}
        />
      )}
    </div>
  );
}
