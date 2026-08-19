import { useEffect, useRef, useState } from "react";
import {
  BUDGET_FIELD_LABELS,
  BUDGET_SECTIONS,
  fetchLeadBudgetDetail,
  updateLeadBudgetDetail,
  type BudgetExpenses,
  type BudgetHardship,
  type BudgetIncome,
  type LeadBudgetDetail,
} from "../../api/leadBudget";
import { Section, INPUT_CLASS } from "./formFields";
import { IconChevronLeft, IconChevronDown } from "../layout/icons";
import { Select } from "../../components/controls";

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 1 });

// Exactly the options visible in the reference screenshot's opened dropdown
// - the list may scroll further than what was captured, so treat this as a
// starting point to confirm against the real option set.
const HARDSHIP_REASON_OPTIONS = ["Avoid Bankruptcy", "Debt To Income To High", "Divorced", "High Interest Rates", "Illness In Family", "Loss Of Income", "Not able to Save"];
const INCOME_FREQUENCY_OPTIONS = ["Weekly", "Bi-weekly", "Twice a month", "Monthly", "4 Weekly", "Other"];

function StatCard({ label, value, tooltip, accent }: { label: string; value: string; tooltip?: string; accent?: boolean }) {
  return (
    <div className="flex min-w-[190px] shrink-0 flex-col gap-1 border-r border-border px-5 py-4 last:border-0">
      <span className={`text-xl font-bold ${accent ? "text-teal" : "text-ink"}`}>{value}</span>
      <span className="text-xs text-muted" title={tooltip}>
        {label}
      </span>
    </div>
  );
}

function StatRow({ summary }: { summary: LeadBudgetDetail["summary"] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div className="rounded-card border border-border bg-white">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal text-white">$</div>
        <span className="font-semibold text-ink">Monthly Expenditure Details</span>
      </div>
      <div className="flex items-center gap-1 px-2 py-1">
        <button onClick={() => scroll(-1)} className="shrink-0 rounded p-1 text-muted hover:bg-bg">
          <IconChevronLeft width={16} height={16} />
        </button>
        <div ref={scrollRef} className="flex flex-1 overflow-x-auto">
          <StatCard label="Total Monthly Income" value={CURRENCY.format(summary.totalMonthlyIncome)} accent />
          <StatCard label="Program Cost" value={CURRENCY.format(summary.programCost)} tooltip="Estimated monthly program fee (assumes a 36-month program)" />
          <StatCard label="Total Expenses" value={CURRENCY.format(summary.totalExpenses)} />
          <StatCard label="Total Monthly Expense (With Program Cost)" value={CURRENCY.format(summary.totalExpenseWithProgram)} />
          <StatCard label="Available Funds" value={CURRENCY.format(summary.fundsAvailable)} accent />
          <StatCard label="Monthly Debt to Income Ratio (With Program)" value={PERCENT.format(summary.dtiWithProgram)} />
          <StatCard label="Monthly Debt to Income Ratio (Without Program)" value={PERCENT.format(summary.dtiWithoutProgram)} />
        </div>
        <button onClick={() => scroll(1)} className="shrink-0 rotate-180 rounded p-1 text-muted hover:bg-bg">
          <IconChevronLeft width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

function HardshipCard({ id, initial, onSaved }: { id: string; initial: BudgetHardship | null; onSaved: (h: BudgetHardship) => void }) {
  const [draft, setDraft] = useState<BudgetHardship>(initial ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(initial ?? {}), [initial]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateLeadBudgetDetail(id, { hardship: draft });
      onSaved(res.hardship ?? draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Hardship Reason">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-ink">Hardship Reason</label>
          <Select value={draft.reason ?? ""} onChange={(e) => setDraft((p) => ({ ...p, reason: e.target.value }))}>
            <option value="">Hardship Reason</option>
            {HARDSHIP_REASON_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">Describe Hardship Reason</label>
          <textarea className={INPUT_CLASS} rows={2} value={draft.description ?? ""} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">
            How or why did the client get into this debt? <span className="text-error">*</span>
          </label>
          <textarea className={INPUT_CLASS} rows={2} value={draft.howGotIntoDebt ?? ""} onChange={(e) => setDraft((p) => ({ ...p, howGotIntoDebt: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">
            What is the real PAIN the debt is creating in their life? <span className="text-error">*</span>
          </label>
          <textarea className={INPUT_CLASS} rows={2} value={draft.realPain ?? ""} onChange={(e) => setDraft((p) => ({ ...p, realPain: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink">
            What is their ULTIMATE goal once they are debt free? <span className="text-error">*</span>
          </label>
          <textarea className={INPUT_CLASS} rows={2} value={draft.ultimateGoal ?? ""} onChange={(e) => setDraft((p) => ({ ...p, ultimateGoal: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDraft(initial ?? {})} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Section>
  );
}

const INCOME_FIELDS: { key: keyof BudgetIncome; label: string }[] = [
  { key: "employmentIncome", label: "Net Monthly Employment Income" },
  { key: "selfEmployment", label: "Self Employment" },
  { key: "socialSecurity", label: "Social Security" },
  { key: "unemployment", label: "Unemployment" },
  { key: "alimony", label: "Alimony" },
  { key: "childSupport", label: "Child Support" },
  { key: "otherGovtAssistance", label: "Other Govt. Assistance" },
  { key: "annuities", label: "Annuities" },
  { key: "dividends", label: "Dividends" },
  { key: "retirement", label: "Retirement" },
  { key: "otherIncome", label: "Other Income" },
];

function IncomeExpensesCard({
  id,
  data,
  onSaved,
}: {
  id: string;
  data: Pick<LeadBudgetDetail, "expenses" | "housingType" | "income">;
  onSaved: (d: Pick<LeadBudgetDetail, "expenses" | "housingType" | "income" | "summary">) => void;
}) {
  const [subTab, setSubTab] = useState<"income" | "expenses">("income");
  const [expenses, setExpenses] = useState<BudgetExpenses>(data.expenses ?? {});
  const [housingType, setHousingType] = useState<"RENT" | "OWN" | "">(data.housingType ?? "");
  const [income, setIncome] = useState<BudgetIncome>(data.income ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setExpenses(data.expenses ?? {});
    setHousingType(data.housingType ?? "");
    setIncome(data.income ?? {});
  }, [data]);

  function resetDrafts() {
    setExpenses(data.expenses ?? {});
    setHousingType(data.housingType ?? "");
    setIncome(data.income ?? {});
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateLeadBudgetDetail(id, { expenses, housingType: housingType || null, income });
      onSaved({ expenses: res.expenses, housingType: res.housingType, income: res.income, summary: res.summary });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-6 border-b border-border">
        <button
          onClick={() => setSubTab("income")}
          className={`border-b-2 pb-2 text-sm font-semibold ${subTab === "income" ? "border-teal text-teal" : "border-transparent text-muted"}`}
        >
          Income
        </button>
        <button
          onClick={() => setSubTab("expenses")}
          className={`border-b-2 pb-2 text-sm font-semibold ${subTab === "expenses" ? "border-teal text-teal" : "border-transparent text-muted"}`}
        >
          Monthly Expenses
        </button>
      </div>

      {subTab === "income" ? (
        <Section title="Applicant Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {INCOME_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm text-ink">{f.label}</label>
                <input
                  type="number"
                  className={INPUT_CLASS}
                  value={income[f.key] ?? ""}
                  onChange={(e) => setIncome((p) => ({ ...p, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-sm text-ink">Income Frequency</label>
              <Select value={income.frequency ?? ""} onChange={(e) => setIncome((p) => ({ ...p, frequency: e.target.value }))}>
                <option value="">Income Frequency</option>
                {INCOME_FREQUENCY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-ink">Comments</label>
            <textarea className={INPUT_CLASS} rows={2} value={income.comments ?? ""} onChange={(e) => setIncome((p) => ({ ...p, comments: e.target.value }))} />
          </div>
        </Section>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {BUDGET_SECTIONS.map((section) => (
            <Section key={section.title} title={section.title}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {section.title === "Housing" && (
                  <div>
                    <label className="mb-1 block text-sm text-ink">Housing</label>
                    <Select value={housingType} onChange={(e) => setHousingType(e.target.value as "RENT" | "OWN" | "")}>
                      <option value="">Housing</option>
                      <option value="RENT">Rent</option>
                      <option value="OWN">Own</option>
                    </Select>
                  </div>
                )}
                {section.fields.map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-sm text-ink">{BUDGET_FIELD_LABELS[key]}</label>
                    <input
                      type="number"
                      className={INPUT_CLASS}
                      value={expenses[key] ?? ""}
                      onChange={(e) => setExpenses((p) => ({ ...p, [key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </Section>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 border-t border-border bg-bg/95 px-1 py-3 backdrop-blur">
        <button onClick={resetDrafts} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-white">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function BudgetTab({ leadId }: { leadId: string }) {
  const [detail, setDetail] = useState<LeadBudgetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeadBudgetDetail(leadId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load budget"));
  }, [leadId]);

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!detail) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <IconChevronDown className="mt-0.5 shrink-0 rotate-0" width={16} height={16} />
        Once all the income & expenses details are filled &amp; saved then we will show the rest cumulative financial details
      </div>

      <StatRow summary={detail.summary} />

      <HardshipCard id={leadId} initial={detail.hardship} onSaved={(hardship) => setDetail((d) => (d ? { ...d, hardship } : d))} />

      <IncomeExpensesCard
        id={leadId}
        data={{ expenses: detail.expenses, housingType: detail.housingType, income: detail.income }}
        onSaved={(patch) =>
          setDetail((d) => {
            if (!d) return d;
            const next = { ...d, ...patch };
            return next;
          })
        }
      />
    </div>
  );
}
