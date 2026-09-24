import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  fetchBankInfo,
  saveBankInfo,
  verifyBankAccount,
  VERIFICATION_STATUS_LABELS,
  type BankAccountOwner,
  type BankAccountType,
  type BankInfoInput,
  type LeadBankInfo,
} from "../../api/bankInfo";
import type { LeadDetail } from "../../api/leadDetail";
import { Radio, Select } from "../../components/controls";
import { Section, INPUT_CLASS } from "./formFields";
import { IconBuilding, IconChevronLeft, IconInfo, IconPencil, IconShield } from "../layout/icons";

const FIELD_CLASS = `${INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted`;

interface Draft {
  routingNumber: string;
  bankName: string;
  bankPhone: string;
  bankAddress: string;
  accountOwner: BankAccountOwner | "";
  accountType: BankAccountType | "";
  accountNumber: string;
  nameOnAccount: string;
  ssn: string;
  dob: string;
  mothersMaidenName: string;
  enrolledWithSameBank: "" | "yes" | "no";
}

type Errors = Partial<Record<keyof Draft, string>>;

// Applicant-owned accounts default Name On Account / DOB from the lead's own
// Profile, matching Elevate pre-filling those from the applicant record.
function toDraft(info: LeadBankInfo | null, lead: LeadDetail): Draft {
  const applicantName = [lead.applicant.firstName, lead.applicant.lastName].filter(Boolean).join(" ");
  const owner = info?.accountOwner ?? "APPLICANT";
  return {
    routingNumber: info?.routingNumber ?? "",
    bankName: info?.bankName ?? "",
    bankPhone: info?.bankPhone ?? "",
    bankAddress: info?.bankAddress ?? "",
    accountOwner: owner,
    accountType: info?.accountType ?? "",
    accountNumber: "",
    nameOnAccount: info?.nameOnAccount ?? (owner === "APPLICANT" ? applicantName : ""),
    ssn: "",
    dob: info?.dob ?? (owner === "APPLICANT" ? (lead.personal.dob ?? "") : ""),
    mothersMaidenName: info?.mothersMaidenName ?? "",
    enrolledWithSameBank: info?.enrolledWithSameBank == null ? "" : info.enrolledWithSameBank ? "yes" : "no",
  };
}

function validate(draft: Draft, info: LeadBankInfo | null): Errors {
  const errors: Errors = {};
  const routing = draft.routingNumber.replace(/\D/g, "");
  if (!routing) errors.routingNumber = "Routing Number is required";
  else if (routing.length !== 9) errors.routingNumber = "Routing Number must be 9 digits";
  if (!draft.bankName.trim()) errors.bankName = "Bank Name is required";
  if (!draft.bankAddress.trim()) errors.bankAddress = "Address is required";
  if (!draft.accountOwner) errors.accountOwner = "Required";
  if (!draft.accountType) errors.accountType = "Account Type is required";
  const account = draft.accountNumber.replace(/\D/g, "");
  if (!account && !info?.accountNumberLast4) errors.accountNumber = "Bank Account Number is required";
  else if (account && (account.length < 4 || account.length > 17)) errors.accountNumber = "Must be 4-17 digits";
  const ssn = draft.ssn.replace(/\D/g, "");
  if (ssn && ssn.length !== 9) errors.ssn = "SSN must be 9 digits";
  if (!draft.enrolledWithSameBank) errors.enrolledWithSameBank = "Required";
  return errors;
}

function Field({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

function SummaryCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[180px] flex-1 shrink-0 flex-col items-center gap-1 border-r border-border px-5 py-4 text-center last:border-0">
      <span className="text-lg font-bold text-ink">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function SummaryBar({
  info,
  editing,
  verifying,
  onVerify,
  onEdit,
}: {
  info: LeadBankInfo | null;
  editing: boolean;
  verifying: boolean;
  onVerify: () => void;
  onEdit: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  const status = info?.verificationStatus ?? "NOT_VERIFIED";
  const statusClass = status === "VERIFIED" ? "text-teal" : status === "FAILED" ? "text-error" : "text-ink";

  return (
    <div className="rounded-card border border-border bg-white">
      <div className="flex items-center gap-1 px-2">
        <button onClick={() => scroll(-1)} className="shrink-0 rounded p-1 text-muted hover:bg-bg" aria-label="Scroll left">
          <IconChevronLeft width={16} height={16} />
        </button>
        <div ref={scrollRef} className="flex flex-1 items-center overflow-x-auto">
          <div className="flex shrink-0 items-center gap-2 border-r border-border px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal text-white">
              <IconBuilding width={16} height={16} />
            </div>
            <span className="whitespace-nowrap font-semibold text-teal">Banking Details</span>
          </div>
          <SummaryCell value={info?.routingNumber || "—"} label="Routing Number" />
          <SummaryCell value={info?.bankName || "—"} label="Bank Name" />
          <SummaryCell value={info?.accountNumberLast4 ? `••••${info.accountNumberLast4}` : "—"} label="Account Number" />
          <SummaryCell value={info?.nameOnAccount || "—"} label="Name On Account" />
          <div className="flex shrink-0 items-center gap-2 px-5 py-4">
            <button
              onClick={onVerify}
              disabled={!info || editing || verifying}
              title={!info ? "Save bank info before verifying" : editing ? "Save or cancel your edits first" : undefined}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
            >
              <IconShield width={14} height={14} />
              {verifying ? "Verifying…" : "Verify Bank Account"}
            </button>
            <button
              onClick={onEdit}
              disabled={editing}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-teal hover:text-white disabled:opacity-60"
            >
              <IconPencil width={14} height={14} />
              Edit
            </button>
          </div>
        </div>
        <button onClick={() => scroll(1)} className="shrink-0 rotate-180 rounded p-1 text-muted hover:bg-bg" aria-label="Scroll right">
          <IconChevronLeft width={16} height={16} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border bg-bg px-5 py-2 text-xs">
        <IconInfo width={14} height={14} className="text-muted" />
        <span className="font-semibold text-ink">
          Account Verification Status: <span className={statusClass}>{VERIFICATION_STATUS_LABELS[status]}</span>
        </span>
        {info?.verifiedAt && (
          <span className="text-muted">
            · checked {new Date(info.verifiedAt).toLocaleString()}
            {info.verifiedBy && ` by ${info.verifiedBy}`}
          </span>
        )}
        {status === "FAILED" && info?.verificationMessage && <span className="w-full text-error">{info.verificationMessage}</span>}
      </div>
    </div>
  );
}

export function BankInfoTab({ lead }: { lead: LeadDetail }) {
  const [info, setInfo] = useState<LeadBankInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(null, lead));
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchBankInfo(lead.id)
      .then(({ bankInfo }) => {
        setInfo(bankInfo);
        setDraft(toDraft(bankInfo, lead));
        // Nothing on file yet - open straight into the form.
        setEditing(bankInfo === null);
        setLoaded(true);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load bank info"));
    // Only refetch when switching leads, not on every header edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleOwnerChange(owner: BankAccountOwner) {
    const applicantName = [lead.applicant.firstName, lead.applicant.lastName].filter(Boolean).join(" ");
    setDraft((d) => ({
      ...d,
      accountOwner: owner,
      // Swap the applicant pre-fill in/out, but never clobber typed values.
      nameOnAccount: owner === "APPLICANT" ? d.nameOnAccount || applicantName : d.nameOnAccount === applicantName ? "" : d.nameOnAccount,
      dob: owner === "APPLICANT" ? d.dob || (lead.personal.dob ?? "") : d.dob === lead.personal.dob ? "" : d.dob,
    }));
    setErrors((e) => ({ ...e, accountOwner: undefined }));
  }

  function handleCancel() {
    setDraft(toDraft(info, lead));
    setErrors({});
    setActionError(null);
    setEditing(info === null);
  }

  async function handleSave() {
    const found = validate(draft, info);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setActionError("Please fill in the required fields.");
      return;
    }
    const input: BankInfoInput = {
      routingNumber: draft.routingNumber.replace(/\D/g, ""),
      bankName: draft.bankName.trim(),
      bankPhone: draft.bankPhone.trim() || null,
      bankAddress: draft.bankAddress.trim(),
      accountOwner: draft.accountOwner as BankAccountOwner,
      accountType: draft.accountType as BankAccountType,
      ...(draft.accountNumber.trim() ? { accountNumber: draft.accountNumber.replace(/\D/g, "") } : {}),
      nameOnAccount: draft.nameOnAccount.trim() || null,
      ...(draft.ssn.trim() ? { ssn: draft.ssn.replace(/\D/g, "") } : {}),
      dob: draft.dob || null,
      mothersMaidenName: draft.mothersMaidenName.trim() || null,
      enrolledWithSameBank: draft.enrolledWithSameBank === "yes",
    };
    setSaving(true);
    setActionError(null);
    try {
      const { bankInfo } = await saveBankInfo(lead.id, input);
      setInfo(bankInfo);
      setDraft(toDraft(bankInfo, lead));
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save bank info");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setActionError(null);
    try {
      const { bankInfo } = await verifyBankAccount(lead.id);
      setInfo(bankInfo);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to verify bank account");
    } finally {
      setVerifying(false);
    }
  }

  if (loadError) return <p className="text-sm text-error">{loadError}</p>;
  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;

  const disabled = !editing;

  return (
    <div className={`space-y-5 ${editing ? "pb-20" : ""}`}>
      <SummaryBar info={info} editing={editing} verifying={verifying} onVerify={handleVerify} onEdit={() => setEditing(true)} />

      {actionError && !editing && <p className="text-sm text-error">{actionError}</p>}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Section title="Bank Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Routing Number" required error={errors.routingNumber}>
                <input
                  className={FIELD_CLASS}
                  inputMode="numeric"
                  maxLength={9}
                  disabled={disabled}
                  value={draft.routingNumber}
                  onChange={(e) => set("routingNumber", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
            </div>
            <Field label="Bank Name" required error={errors.bankName}>
              <input className={FIELD_CLASS} disabled={disabled} value={draft.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Phone Number">
              <input className={FIELD_CLASS} type="tel" disabled={disabled} value={draft.bankPhone} onChange={(e) => set("bankPhone", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address" required error={errors.bankAddress}>
                <input className={FIELD_CLASS} disabled={disabled} value={draft.bankAddress} onChange={(e) => set("bankAddress", e.target.value)} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Account Details">
          <div className="space-y-4">
            <Field label="These account details belongs to:" required error={errors.accountOwner}>
              <div className="flex gap-6 pt-1">
                <Radio name="accountOwner" label="Applicant" disabled={disabled} checked={draft.accountOwner === "APPLICANT"} onChange={() => handleOwnerChange("APPLICANT")} />
                <Radio name="accountOwner" label="Third Party" disabled={disabled} checked={draft.accountOwner === "THIRD_PARTY"} onChange={() => handleOwnerChange("THIRD_PARTY")} />
              </div>
            </Field>

            <Field label="Account Type" required error={errors.accountType}>
              <div className="flex gap-6 pt-1">
                <Radio name="accountType" label="Checking" disabled={disabled} checked={draft.accountType === "CHECKING"} onChange={() => set("accountType", "CHECKING")} />
                <Radio name="accountType" label="Savings" disabled={disabled} checked={draft.accountType === "SAVINGS"} onChange={() => set("accountType", "SAVINGS")} />
              </div>
            </Field>

            <Field
              label="Bank Account Number"
              required
              error={errors.accountNumber}
              hint={info?.accountNumberLast4 && editing ? "Leave blank to keep the number on file" : undefined}
            >
              <input
                className={FIELD_CLASS}
                inputMode="numeric"
                autoComplete="off"
                maxLength={17}
                disabled={disabled}
                placeholder={info?.accountNumberLast4 ? `on file: ••••${info.accountNumberLast4}` : undefined}
                value={draft.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, ""))}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name On Account">
                <input className={FIELD_CLASS} disabled={disabled} value={draft.nameOnAccount} onChange={(e) => set("nameOnAccount", e.target.value)} />
              </Field>
              <Field label="SSN" error={errors.ssn} hint={info?.ssnLast4 && editing ? "Leave blank to keep the SSN on file" : undefined}>
                <input
                  className={FIELD_CLASS}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={disabled}
                  placeholder={
                    info?.ssnLast4
                      ? `on file: •••-••-${info.ssnLast4}`
                      : draft.accountOwner === "APPLICANT" && lead.personal.ssnLast4
                        ? `uses applicant's •••-••-${lead.personal.ssnLast4}`
                        : undefined
                  }
                  value={draft.ssn}
                  onChange={(e) => set("ssn", e.target.value)}
                />
              </Field>
              <Field label="Date Of Birth">
                <input className={FIELD_CLASS} type="date" disabled={disabled} value={draft.dob} onChange={(e) => set("dob", e.target.value)} />
              </Field>
              <Field label="Mothers Maiden Name">
                <input className={FIELD_CLASS} disabled={disabled} value={draft.mothersMaidenName} onChange={(e) => set("mothersMaidenName", e.target.value)} />
              </Field>
              <Field label="Account enrolled with this same bank?" required error={errors.enrolledWithSameBank}>
                <Select
                  disabled={disabled}
                  value={draft.enrolledWithSameBank}
                  onChange={(e) => set("enrolledWithSameBank", e.target.value as Draft["enrolledWithSameBank"])}
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </Field>
            </div>
          </div>
        </Section>
      </div>

      {editing && (
        <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-border bg-bg/95 px-1 py-3 backdrop-blur">
          {actionError && <p className="mr-auto text-sm text-error">{actionError}</p>}
          <button onClick={handleCancel} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-white">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
