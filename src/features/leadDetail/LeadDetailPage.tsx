import { useCallback, useEffect, useState } from "react";
import { confirmAction } from "../../state/confirmStore";
import { useNavigate, useParams } from "react-router-dom";
import { fetchStaff, type StaffOption } from "../../api/staff";
import { fetchLeadDetail, submitLeadToCompliance, updateLeadDetail, deleteLead, type LeadDetail } from "../../api/leadDetail";
import { PROGRAM_LABELS, SOURCE_LABELS, STATUS_LABELS, WORKLIST_STATUSES, LEAD_PROGRAMS, LEAD_SOURCES } from "../../api/worklist";
import { PillSelect } from "./formFields";
import { ProfileTab } from "./ProfileTab";
import { BudgetTab } from "./BudgetTab";
import { CreditorTab } from "./CreditorTab";
import { BankInfoTab } from "./BankInfoTab";
import { AdditionalInfoTab } from "./AdditionalInfoTab";
import { LiveLeadProvider, useLatest, useLeadRevisions, useLiveReload } from "./liveLead";
import { IconChevronLeft } from "../layout/icons";

const TABS = ["Profile", "Budget", "Creditor", "Bank Info", "Additional Info", "Docs", "History"] as const;
type Tab = (typeof TABS)[number];

const STATUS_OPTIONS = WORKLIST_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const PROGRAM_OPTIONS = LEAD_PROGRAMS.map((p) => ({ value: p, label: PROGRAM_LABELS[p] }));
// The real Source dropdown only ever showed DebtConquest/Mejor Alivio/Web -
// OTHER stays a valid value in the shared LeadSource enum/worklist filters
// (some already-stored lead might have it) but isn't offered as a choice
// here, matching the reference UI.
const SOURCE_OPTIONS = LEAD_SOURCES.filter((s) => s !== "OTHER").map((s) => ({ value: s, label: SOURCE_LABELS[s] }));

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const [error, setError] = useState<string | null>(null);

  // Live sync with the customer's app: what changed on the server since this
  // page loaded it - see liveLead.ts.
  const rev = useLeadRevisions(id);
  const latest = useLatest();

  const load = useCallback(async () => {
    if (!id) return;
    const ticket = latest.begin();
    try {
      const [leadRes, staffRes] = await Promise.all([fetchLeadDetail(id), fetchStaff()]);
      setStaff(staffRes.staff);
      if (latest.isCurrent(ticket)) setLead(leadRes.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lead");
    }
  }, [id, latest]);

  useEffect(() => {
    load();
  }, [load]);

  // The customer changed something in their app (or a colleague did, in
  // another window): show it. Quietly - a refresh that fails just leaves
  // what's on screen until the next one.
  const refreshLead = useCallback(async () => {
    if (!id) return;
    const ticket = latest.begin();
    try {
      const { lead: fresh } = await fetchLeadDetail(id);
      if (latest.isCurrent(ticket)) setLead(fresh);
    } catch {
      // Still showing the last known lead.
    }
  }, [id, latest]);
  // The header summary draws on the debts, creditors and bank details too.
  useLiveReload(["lead", "debts", "creditors", "creditReports", "bankInfo"], refreshLead, false, rev);

  // A save from this page: nothing loaded before it may replace its result.
  const applySaved = useCallback(
    (saved: LeadDetail) => {
      latest.invalidate();
      setLead(saved);
    },
    [latest],
  );

  async function patchHeader(patch: Parameters<typeof updateLeadDetail>[1]) {
    if (!id) return;
    latest.invalidate();
    const { lead: updated } = await updateLeadDetail(id, patch);
    applySaved(updated);
  }

  async function handleSubmitToCompliance() {
    if (!id) return;
    const ok = await confirmAction({
      title: "Submit to Compliance?",
      message: "This lead will be marked as submitted to Compliance. It can't be undone.",
      confirmLabel: "Submit",
      tone: "warning",
    });
    if (!ok) return;
    await submitLeadToCompliance(id);
    await load();
  }

  async function handleDeleteLead() {
    if (!id || !lead) return;
    const name = [lead.applicant.firstName, lead.applicant.lastName].filter(Boolean).join(" ") || `ID-${lead.leadNumber}`;
    const ok = await confirmAction({
      title: `Permanently delete ${name}?`,
      message: "This also deletes all of their data - debts, creditors, credit reports and documents. This can't be undone.",
      confirmLabel: "Delete lead",
      tone: "danger",
      requireText: "DELETE",
    });
    if (!ok) return;
    await deleteLead(id);
    navigate("/worklist");
  }

  if (error) {
    return <p className="p-6 text-sm text-error">{error}</p>;
  }
  if (!lead) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }

  const staffOptions = staff.map((s) => ({ value: s.id, label: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email }));
  const name = [lead.applicant.firstName, lead.applicant.lastName].filter(Boolean).join(" ") || "(no name)";
  const initial = (lead.applicant.firstName ?? "?").charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      <button onClick={() => navigate("/worklist")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
        <IconChevronLeft width={16} height={16} /> Back to Worklist
      </button>

      <div className="rounded-card border border-border bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-deep text-sm font-bold text-white">{initial}</div>
            <h1 className="text-xl page-title">{name}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSubmitToCompliance}
              disabled={lead.complianceSubmitted}
              className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-hover disabled:opacity-60"
            >
              {lead.complianceSubmitted ? "Submitted to Compliance" : "Submit To Compliance"}
            </button>

            <button
              onClick={() => patchHeader({ rejected: false })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${!lead.rejected ? "bg-teal text-white" : "bg-gray-200 text-gray-500"}`}
            >
              Assigned
            </button>
            <button
              onClick={() => patchHeader({ rejected: true })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${lead.rejected ? "bg-error text-white" : "bg-gray-200 text-gray-500"}`}
            >
              Reject Lead
            </button>
            <button
              onClick={handleDeleteLead}
              title="Permanently delete this lead and all of its data"
              className="rounded-md border border-error px-3 py-1.5 text-xs font-medium text-error hover:bg-error hover:text-white"
            >
              Delete Lead
            </button>
          </div>
        </div>

        <p className="mb-3 text-xs text-muted">Created Date {new Date(lead.createdAt).toLocaleDateString()}</p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span className="font-bold text-ink">ID-{lead.leadNumber}</span>

          <span className="text-muted">Elevate ID: {lead.elevateClientId ?? "—"}</span>

          <span className="flex items-center gap-2 text-muted">
            Queue:
            <PillSelect value={lead.queue} onChange={(v) => patchHeader({ queue: v })} options={[{ value: "Main", label: "Main" }]} />
          </span>

          <span className="flex items-center gap-2 text-muted">
            Status:
            <PillSelect value={lead.crmStatus} onChange={(v) => patchHeader({ crmStatus: v as LeadDetail["crmStatus"] })} options={STATUS_OPTIONS} />
          </span>

          <span className="flex items-center gap-2 text-muted">
            Program:
            <PillSelect value={lead.program ?? ""} onChange={(v) => patchHeader({ program: (v || null) as LeadDetail["program"] })} options={PROGRAM_OPTIONS} />
          </span>

          <span className="flex items-center gap-2 text-muted">
            Source:
            <PillSelect value={lead.source ?? ""} onChange={(v) => patchHeader({ source: (v || null) as LeadDetail["source"] })} options={SOURCE_OPTIONS} />
          </span>

          <span className="flex items-center gap-2 text-muted">
            Assigned Sales Rep:
            <PillSelect value={lead.assignedStaff?.id ?? ""} onChange={(v) => patchHeader({ assignedStaffId: v || null })} options={staffOptions} placeholder="Unassigned" />
          </span>
        </div>

        <div className="mt-4 flex gap-6 overflow-x-auto border-t border-border pt-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 whitespace-nowrap border-b-2 pb-2 text-sm font-semibold ${activeTab === tab ? "border-teal text-teal" : "border-transparent text-muted hover:text-ink"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <LiveLeadProvider value={rev}>
        {activeTab === "Profile" && <ProfileTab lead={lead} onSaveStart={latest.invalidate} onSaved={applySaved} />}
        {activeTab === "Budget" && <BudgetTab leadId={lead.id} />}
        {activeTab === "Creditor" && <CreditorTab leadId={lead.id} onOpenAdditionalInfo={() => setActiveTab("Additional Info")} />}
        {activeTab === "Bank Info" && <BankInfoTab lead={lead} />}
        {activeTab === "Additional Info" && <AdditionalInfoTab leadId={lead.id} />}
        {activeTab !== "Profile" && activeTab !== "Budget" && activeTab !== "Creditor" && activeTab !== "Bank Info" && activeTab !== "Additional Info" && (
          <div className="rounded-card border border-dashed border-border bg-white p-10 text-center text-sm text-muted">{activeTab} - coming soon</div>
        )}
      </LiveLeadProvider>
    </div>
  );
}
