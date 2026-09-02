import { useState } from "react";
import {
  ACCOUNT_HOLDER_LABELS,
  BEHIND_MONTHS_OPTIONS,
  DEBT_TYPE_OPTIONS,
  RESPONSIBILITY_OPTIONS,
  createCreditor,
  updateCreditor,
  type Creditor,
  type CreditorAccountHolder,
  type CreditorInput,
} from "../../api/creditor";
import { ApiError } from "../../api/client";
import { IconX } from "../layout/icons";
import { Radio, Select } from "../../components/controls";
import { INPUT_CLASS } from "./formFields";
import { US_STATES } from "./usStates";

const ACCOUNT_HOLDERS: CreditorAccountHolder[] = ["APPLICANT", "CO_APPLICANT", "JOINT"];

type Draft = Required<Pick<CreditorInput, "creditorName">> & Omit<CreditorInput, "creditorName">;

function toDraft(c: Creditor | null): Draft {
  if (!c) {
    return {
      accountHolder: "APPLICANT",
      cardholderName: "",
      creditorName: "",
      address1: "",
      address2: "",
      country: "United States",
      state: "",
      city: "",
      zip: "",
      phone: "",
      fax: "",
      accountNo: "",
      balance: 0,
      monthlyPayment: 0,
      lastPaymentDate: "",
      debtType: "",
      overLimit: false,
      behind: false,
      behindMonths: null,
      includeOnProgram: true,
      apr: 0,
      creditorLimit: 0,
      difficultCreditor: false,
      sameBank: false,
      responsibility: "",
      dateOpened: "",
    };
  }
  return {
    accountHolder: c.accountHolder,
    cardholderName: c.cardholderName ?? "",
    creditorName: c.creditorName,
    address1: c.address1 ?? "",
    address2: c.address2 ?? "",
    country: c.country ?? "United States",
    state: c.state ?? "",
    city: c.city ?? "",
    zip: c.zip ?? "",
    phone: c.phone ?? "",
    fax: c.fax ?? "",
    accountNo: c.accountNo ?? "",
    balance: c.balance,
    monthlyPayment: c.monthlyPayment,
    lastPaymentDate: c.lastPaymentDate ?? "",
    debtType: c.debtType ?? "",
    overLimit: c.overLimit,
    behind: c.behind,
    behindMonths: c.behindMonths,
    includeOnProgram: c.includeOnProgram,
    apr: c.apr,
    creditorLimit: c.creditorLimit,
    difficultCreditor: c.difficultCreditor,
    sameBank: c.sameBank,
    responsibility: c.responsibility ?? "",
    dateOpened: c.dateOpened ?? "",
  };
}

function YesNoSelect({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Select value={value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "yes")}>
      <option value="no">No</option>
      <option value="yes">Yes</option>
    </Select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink">{label}</label>
      {children}
    </div>
  );
}

export function CreditorModal({
  leadId,
  initial,
  onClose,
  onSaved,
}: {
  leadId: string;
  initial: Creditor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  async function handleSave() {
    if (!draft.creditorName.trim()) {
      setError("Creditor Name is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const input: CreditorInput = {
        ...draft,
        cardholderName: draft.cardholderName || null,
        address1: draft.address1 || null,
        address2: draft.address2 || null,
        country: draft.country || null,
        state: draft.state || null,
        city: draft.city || null,
        zip: draft.zip || null,
        phone: draft.phone || null,
        fax: draft.fax || null,
        accountNo: draft.accountNo || null,
        lastPaymentDate: draft.lastPaymentDate || null,
        debtType: draft.debtType || null,
        behindMonths: draft.behind ? draft.behindMonths : null,
        responsibility: draft.responsibility || null,
        dateOpened: draft.dateOpened || null,
      };
      if (initial) {
        await updateCreditor(initial.id, input);
      } else {
        await createCreditor(leadId, input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save creditor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex max-h-full w-full max-w-4xl flex-col rounded-card bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-ink">{initial ? "Edit Creditor" : "Add Creditor"}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-bg" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <h3 className="mb-4 text-lg font-bold text-ink">{initial ? "Edit Creditor" : "Create Creditor"}</h3>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-ink">Basic Details</p>

              <div>
                <label className="mb-1 block text-sm text-ink">Account Holder</label>
                <div className="flex flex-wrap gap-4">
                  {ACCOUNT_HOLDERS.map((h) => (
                    <Radio key={h} name="accountHolder" checked={draft.accountHolder === h} onChange={() => patch({ accountHolder: h })} label={ACCOUNT_HOLDER_LABELS[h]} />
                  ))}
                </div>
              </div>

              <Field label="Cardholder Name *">
                <input className={INPUT_CLASS} value={draft.cardholderName ?? ""} onChange={(e) => patch({ cardholderName: e.target.value })} />
              </Field>

              <p className="text-sm font-semibold text-ink">Creditor Details</p>

              <Field label="Creditor Name *">
                <input className={INPUT_CLASS} value={draft.creditorName} onChange={(e) => patch({ creditorName: e.target.value })} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Address 1">
                  <input className={INPUT_CLASS} value={draft.address1 ?? ""} onChange={(e) => patch({ address1: e.target.value })} />
                </Field>
                <Field label="Address 2">
                  <input className={INPUT_CLASS} value={draft.address2 ?? ""} onChange={(e) => patch({ address2: e.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <Select value={draft.country ?? ""} onChange={(e) => patch({ country: e.target.value })}>
                    <option value="United States">United States</option>
                  </Select>
                </Field>
                <Field label="State">
                  <Select value={draft.state ?? ""} onChange={(e) => patch({ state: e.target.value })}>
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input className={INPUT_CLASS} value={draft.city ?? ""} onChange={(e) => patch({ city: e.target.value })} />
                </Field>
                <Field label="Zip Code">
                  <input className={INPUT_CLASS} value={draft.zip ?? ""} onChange={(e) => patch({ zip: e.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <input className={INPUT_CLASS} value={draft.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })} />
                </Field>
                <Field label="Fax">
                  <input className={INPUT_CLASS} value={draft.fax ?? ""} onChange={(e) => patch({ fax: e.target.value })} />
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold text-ink">Account Details</p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Account No. *">
                  <input className={INPUT_CLASS} value={draft.accountNo ?? ""} onChange={(e) => patch({ accountNo: e.target.value })} />
                </Field>
                <Field label="Account Balance *">
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    value={draft.balance ?? 0}
                    onChange={(e) => patch({ balance: e.target.value === "" ? 0 : Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly Payment">
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    value={draft.monthlyPayment ?? 0}
                    onChange={(e) => patch({ monthlyPayment: e.target.value === "" ? 0 : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Last Payment Date *">
                  <input type="date" className={INPUT_CLASS} value={draft.lastPaymentDate ?? ""} onChange={(e) => patch({ lastPaymentDate: e.target.value })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Debt Type *">
                  <Select value={draft.debtType ?? ""} onChange={(e) => patch({ debtType: e.target.value })}>
                    <option value="">—</option>
                    {DEBT_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Over Limit">
                  <YesNoSelect value={draft.overLimit ?? false} onChange={(v) => patch({ overLimit: v })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Behind">
                  <YesNoSelect value={draft.behind ?? false} onChange={(v) => patch({ behind: v })} />
                </Field>
                <Field label="How Many Months">
                  <Select
                    disabled={!draft.behind}
                    value={draft.behindMonths != null ? String(draft.behindMonths) : ""}
                    onChange={(e) => patch({ behindMonths: e.target.value === "" ? null : Number(e.target.value.replace("+", "")) })}
                  >
                    <option value="">—</option>
                    {BEHIND_MONTHS_OPTIONS.map((o) => (
                      <option key={o} value={o.replace("+", "")}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Include On Program">
                  <YesNoSelect value={draft.includeOnProgram ?? true} onChange={(v) => patch({ includeOnProgram: v })} />
                </Field>
                <Field label="Apr">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className={INPUT_CLASS}
                      value={draft.apr ?? 0}
                      onChange={(e) => patch({ apr: e.target.value === "" ? 0 : Number(e.target.value) })}
                    />
                    <span className="text-sm text-muted">%</span>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Creditor Limit">
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    value={draft.creditorLimit ?? 0}
                    onChange={(e) => patch({ creditorLimit: e.target.value === "" ? 0 : Number(e.target.value) })}
                  />
                </Field>
                <Field label="Difficult Creditor">
                  <YesNoSelect value={draft.difficultCreditor ?? false} onChange={(v) => patch({ difficultCreditor: v })} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Same Bank">
                  <YesNoSelect value={draft.sameBank ?? false} onChange={(v) => patch({ sameBank: v })} />
                </Field>
                <Field label="Responsibility">
                  <Select value={draft.responsibility ?? ""} onChange={(e) => patch({ responsibility: e.target.value })}>
                    <option value="">—</option>
                    {RESPONSIBILITY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Date Opened">
                <input type="date" className={INPUT_CLASS} value={draft.dateOpened ?? ""} onChange={(e) => patch({ dateOpened: e.target.value })} />
              </Field>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
