import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUser } from "../../api/users";
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
import { Select, Checkbox } from "../../components/controls";
import { OrganizationFields, type OrgValue } from "./OrganizationFields";
import { AccessPreviewCard } from "./AccessPreviewCard";

const INPUT_CLASS = "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal";
const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "Vietnamese"];
const TIME_ZONE_OPTIONS = ["Eastern Time", "Central Time", "Mountain Time", "Pacific Time"];
const STEPS = ["User Details", "Organization", "Access Preview", "Review & Create"] as const;

interface BasicForm {
  firstName: string;
  lastName: string;
  preferredName: string;
  phone: string;
  email: string;
  languagesSpoken: string[];
  timeZone: string;
  employmentStatus: "ACTIVE" | "INACTIVE" | "LEAVE";
  employmentType: "EMPLOYEE" | "CONTRACTOR";
  workLocation: "REMOTE" | "OFFICE" | "HYBRID";
  hireDate: string;
  calendarLink: string;
  serviceCompany: "DEBTCONQUEST" | "MEJOR_ALIVIO";
}

const EMPTY_BASIC: BasicForm = {
  firstName: "",
  lastName: "",
  preferredName: "",
  phone: "",
  email: "",
  languagesSpoken: ["English"],
  timeZone: "Eastern Time",
  employmentStatus: "ACTIVE",
  employmentType: "EMPLOYEE",
  workLocation: "OFFICE",
  hireDate: "",
  calendarLink: "",
  serviceCompany: "DEBTCONQUEST",
};

export function AddUserPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [basic, setBasic] = useState<BasicForm>(EMPTY_BASIC);
  const [basicErrors, setBasicErrors] = useState<Partial<Record<keyof BasicForm, string>>>({});

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number>();
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [jobTitleId, setJobTitleId] = useState<number>();
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);
  const [org, setOrg] = useState<OrgValue>({ assignedOrgUnitIds: [] });
  const [reportsToStaffId, setReportsToStaffId] = useState<string>();
  const [eligibleManagers, setEligibleManagers] = useState<EligibleManager[]>([]);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [preview, setPreview] = useState<AccessPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments().then((res) => {
      setDepartments(res.departments);
      if (res.departments.length) setDepartmentId(res.departments[0].id);
    });
  }, []);

  useEffect(() => {
    if (!departmentId) return;
    setJobTitleId(undefined);
    setOrg({ assignedOrgUnitIds: [] });
    Promise.all([fetchJobTitles(departmentId), fetchOrgTree(departmentId)]).then(([jt, tree]) => {
      setJobTitles(jt.jobTitles);
      setOrgTree(tree.orgUnits);
      if (jt.jobTitles.length) setJobTitleId(jt.jobTitles[0].id);
    });
  }, [departmentId]);

  useEffect(() => {
    setOrg({ assignedOrgUnitIds: [] });
  }, [jobTitleId]);

  const department = departments.find((d) => d.id === departmentId);
  const jobTitle = jobTitles.find((t) => t.id === jobTitleId);

  // Organization step's Reports To suggestion - "the system already knows
  // VP -> Conference -> Team -> Supervisor" - re-resolved every time the
  // org assignment narrows enough to change who that is.
  useEffect(() => {
    if (!departmentId || !jobTitleId) return;
    fetchEligibleManagers({ departmentId, jobTitleId, orgUnitId: org.orgUnitId, teamId: org.teamId }).then((res) => {
      setEligibleManagers(res.managers);
      setReportsToStaffId((prev) => (prev && res.managers.some((m) => m.id === prev) ? prev : res.managers[0]?.id));
    });
  }, [departmentId, jobTitleId, org.orgUnitId, org.teamId]);

  // Access Preview - recomputed live so Step 3 (and Step 2's context) never
  // shows a stale profile.
  useEffect(() => {
    if (!departmentId || !jobTitleId) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    fetchAccessPreview({ departmentId, jobTitleId, orgUnitId: org.orgUnitId, teamId: org.teamId, assignedOrgUnitIds: org.assignedOrgUnitIds })
      .then((res) => setPreview(res.preview))
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, jobTitleId, org.orgUnitId, org.teamId, org.assignedOrgUnitIds.join(",")]);

  function setBasicField<K extends keyof BasicForm>(key: K, value: BasicForm[K]) {
    setBasic((p) => ({ ...p, [key]: value }));
  }

  function toggleLanguage(lang: string) {
    setBasic((p) => ({
      ...p,
      languagesSpoken: p.languagesSpoken.includes(lang) ? p.languagesSpoken.filter((l) => l !== lang) : [...p.languagesSpoken, lang],
    }));
  }

  function handleContinueStep1() {
    const next: Partial<Record<keyof BasicForm, string>> = {};
    if (!basic.firstName.trim()) next.firstName = "First Name is required.";
    if (!basic.lastName.trim()) next.lastName = "Last Name is required.";
    if (!basic.phone.trim()) next.phone = "Work Phone is required.";
    if (!basic.email.trim()) next.email = "Work Email is required.";
    setBasicErrors(next);
    if (Object.keys(next).length === 0) setStep(2);
  }

  function handleContinueStep2() {
    if (!departmentId || !jobTitleId || !jobTitle || !department) {
      setOrgError("Select a Department and Job Title.");
      return;
    }
    if (jobTitle.usesTeam && !org.teamId) {
      setOrgError("Select a Team.");
      return;
    }
    if (jobTitle.usesOrgUnit && !jobTitle.usesMultipleOrgUnits && !org.orgUnitId) {
      setOrgError(`Select a ${department.orgUnitChildLabel ?? department.orgUnitLabel}.`);
      return;
    }
    if (jobTitle.usesMultipleOrgUnits && !org.orgUnitId) {
      setOrgError(`Select a ${department.orgUnitLabel}.`);
      return;
    }
    setOrgError(null);
    setStep(3);
  }

  async function handleSubmit() {
    if (!departmentId || !jobTitleId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createUser({
        firstName: basic.firstName,
        lastName: basic.lastName,
        preferredName: basic.preferredName || undefined,
        phone: basic.phone,
        email: basic.email,
        languagesSpoken: basic.languagesSpoken,
        timeZone: basic.timeZone,
        employmentStatus: basic.employmentStatus,
        employmentType: basic.employmentType,
        workLocation: basic.workLocation,
        hireDate: basic.hireDate || undefined,
        calendarLink: basic.calendarLink || undefined,
        serviceCompany: basic.serviceCompany,
        departmentId,
        jobTitleId,
        orgUnitId: org.orgUnitId,
        teamId: org.teamId,
        assignedOrgUnitIds: org.assignedOrgUnitIds.length ? org.assignedOrgUnitIds : undefined,
        reportsToStaffId,
      });
      navigate(`/manager/users/${res.user.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  const reportsToName = eligibleManagers.find((m) => m.id === reportsToStaffId);

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => navigate("/manager/users")} className="mb-1 text-sm text-muted hover:text-ink">
          ‹ Back to Users
        </button>
        <h1 className="text-2xl font-bold text-ink underline decoration-teal decoration-2 underline-offset-8">Add New User</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Department and Job Title determine this person's access automatically - there's no permissions step to fill in by hand.
        </p>
      </div>

      <div className="flex items-center justify-center gap-16 border-b border-border pb-4">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                step === i + 1 ? "bg-teal text-white" : step > i + 1 ? "bg-teal/15 text-teal" : "bg-bg text-muted"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? "font-semibold text-ink" : "text-muted"}`}>{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-1 font-semibold text-ink">Basic Information</h3>
            <p className="mb-4 text-sm text-muted">Who this person is, and how the team reaches them.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted">First Name *</label>
                <input className={INPUT_CLASS} value={basic.firstName} onChange={(e) => setBasicField("firstName", e.target.value)} />
                {basicErrors.firstName && <p className="mt-1 text-xs text-error">{basicErrors.firstName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Last Name *</label>
                <input className={INPUT_CLASS} value={basic.lastName} onChange={(e) => setBasicField("lastName", e.target.value)} />
                {basicErrors.lastName && <p className="mt-1 text-xs text-error">{basicErrors.lastName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Preferred Name</label>
                <input className={INPUT_CLASS} placeholder="Optional" value={basic.preferredName} onChange={(e) => setBasicField("preferredName", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Work Email *</label>
                <input className={INPUT_CLASS} type="email" value={basic.email} onChange={(e) => setBasicField("email", e.target.value)} />
                {basicErrors.email && <p className="mt-1 text-xs text-error">{basicErrors.email}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Work Phone *</label>
                <input className={INPUT_CLASS} placeholder="(555) 555-1212" value={basic.phone} onChange={(e) => setBasicField("phone", e.target.value)} />
                {basicErrors.phone && <p className="mt-1 text-xs text-error">{basicErrors.phone}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Time Zone</label>
                <Select value={basic.timeZone} onChange={(e) => setBasicField("timeZone", e.target.value)}>
                  {TIME_ZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Employee ID</label>
                <input className={`${INPUT_CLASS} bg-bg text-muted`} value="Auto-generated on create" disabled />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Employee Status</label>
                <Select value={basic.employmentStatus} onChange={(e) => setBasicField("employmentStatus", e.target.value as BasicForm["employmentStatus"])}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LEAVE">Leave</option>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-xs text-muted">Languages Spoken</label>
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-white px-3 py-2.5">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <Checkbox key={lang} label={lang} checked={basic.languagesSpoken.includes(lang)} onChange={() => toggleLanguage(lang)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-1 font-semibold text-ink">Employment Information</h3>
            <p className="mb-4 text-sm text-muted">Contract and logistics - this does not affect access.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Service Company</label>
                <Select value={basic.serviceCompany} onChange={(e) => setBasicField("serviceCompany", e.target.value as BasicForm["serviceCompany"])}>
                  <option value="DEBTCONQUEST">DebtConquest, Inc.</option>
                  <option value="MEJOR_ALIVIO">Mejor Alivio</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Employment Type</label>
                <Select value={basic.employmentType} onChange={(e) => setBasicField("employmentType", e.target.value as BasicForm["employmentType"])}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="CONTRACTOR">Contractor</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Hire Date</label>
                <input type="date" className={INPUT_CLASS} value={basic.hireDate} onChange={(e) => setBasicField("hireDate", e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Work Location</label>
                <Select value={basic.workLocation} onChange={(e) => setBasicField("workLocation", e.target.value as BasicForm["workLocation"])}>
                  <option value="REMOTE">Remote</option>
                  <option value="OFFICE">Office</option>
                  <option value="HYBRID">Hybrid</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Calendar Link</label>
                <input className={INPUT_CLASS} placeholder="https://..." value={basic.calendarLink} onChange={(e) => setBasicField("calendarLink", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => navigate("/manager/users")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
              Cancel
            </button>
            <button onClick={handleContinueStep1} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>Automatic access assignment.</strong> Department and Job Title determine the employee's Access Profile. The
            fields below determine the records that profile can see.
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-4 font-semibold text-ink">Department &amp; Title</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Department *</label>
                <Select value={departmentId ?? ""} onChange={(e) => setDepartmentId(Number(e.target.value))}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Job Title *</label>
                <Select value={jobTitleId ?? ""} onChange={(e) => setJobTitleId(Number(e.target.value))}>
                  {jobTitles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted">Controlled list only - titles can't be typed freehand.</p>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-1 font-semibold text-ink">Organizational Assignment</h3>
            <p className="mb-4 text-sm text-muted">{department ? `${department.name}'s hierarchy: ` : ""}the fields below adapt to this department's own structure.</p>
            {department && jobTitle && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <OrganizationFields department={department} orgTree={orgTree} jobTitle={jobTitle} value={org} onChange={(patch) => setOrg((p) => ({ ...p, ...patch }))} />
              </div>
            )}
          </div>

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-1 font-semibold text-ink">Reporting Relationship</h3>
            <p className="mb-4 text-sm text-muted">Suggested from the org tree above.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Reports To</label>
                {eligibleManagers.length > 0 ? (
                  <Select value={reportsToStaffId ?? ""} onChange={(e) => setReportsToStaffId(e.target.value)}>
                    {eligibleManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.title}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <input className={`${INPUT_CLASS} bg-bg text-muted`} disabled value={department?.reportsToLabel ? `(top of ${department.name} — reports to ${department.reportsToLabel})` : "No one holds the next title up yet"} />
                )}
              </div>
            </div>
          </div>

          {orgError && <p className="text-sm text-error">{orgError}</p>}

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
              Back
            </button>
            <div className="flex gap-3">
              <button onClick={() => navigate("/manager/users")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
                Cancel
              </button>
              <button onClick={handleContinueStep2} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-md border border-teal/30 bg-teal-50/50 p-4 text-sm text-teal-900">
            <strong>No manual role selection required.</strong> This access is inherited from Department + Job Title. Changing
            the title later automatically recalculates it.
          </div>

          <AccessPreviewCard preview={preview} loading={previewLoading} />

          <div className="rounded-card border border-border bg-white p-5">
            <h3 className="mb-1 font-semibold text-ink">Temporary Access Exceptions</h3>
            <p className="mb-3 text-sm text-muted">Exceptions should be rare, approved, time-limited, and fully audited - available once this user is created.</p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
              Back
            </button>
            <div className="flex gap-3">
              <button onClick={() => navigate("/manager/users")} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
                Cancel
              </button>
              <button onClick={() => setStep(4)} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-card border border-border bg-white p-5">
              <h3 className="mb-4 font-semibold text-ink">User Summary</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <ReviewItem label="Name" value={`${basic.firstName} ${basic.lastName}`} />
                <ReviewItem label="Email" value={basic.email} />
                <ReviewItem label="Department" value={department?.name ?? "—"} />
                <ReviewItem label="Job Title" value={jobTitle?.name ?? "—"} />
                <ReviewItem label="Data Scope" value={preview?.dataScopeLabel ?? "—"} />
                <ReviewItem label="Reports To" value={reportsToName ? `${reportsToName.name}` : "—"} />
                <ReviewItem label="Status" value={basic.employmentStatus === "ACTIVE" ? "Active" : basic.employmentStatus === "LEAVE" ? "Leave" : "Inactive"} />
              </dl>
            </div>

            <div className="rounded-card border border-border bg-white p-5">
              <h3 className="mb-4 font-semibold text-ink">Automatically Assigned Access</h3>
              <div className="mb-3 rounded-md border border-border bg-bg/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Access Profile</p>
                <p className="mt-1 font-mono text-sm font-bold text-ink">{preview?.accessProfile?.code ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border bg-bg/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Policy Version</p>
                <p className="mt-1 text-sm font-bold text-ink">v{preview?.accessProfile?.version ?? "—"}</p>
              </div>
              <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                Future changes to this user's Department or Job Title will automatically recalculate their access and write an
                audit-log entry.
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
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
                {submitting ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
    </div>
  );
}
