import { useId, useState } from "react";
import type { LeadSourceDocument } from "../../../api/leadCalculator";
import { IconCalendar, IconCheckCircle, IconDownload, IconEye, IconFileText, IconLayers, IconLock } from "../../layout/icons";
import { formatCurrency } from "./calc";
import type { CalcDebt, DebtField } from "./useCalculatorState";

// The customer calculator's top half - TotalsBar.tsx, DebtTable.tsx,
// DebtRow.tsx and SourceDocumentSection.tsx from apps/client, ported with
// the same controls. "Upload Credit Report" is left out: uploads from the
// CRM go through the Additional Info tab.

// The client's page background, used for the same tiles it tints.
const APP_TINT = "bg-[#ebffff]";

export function TotalsBar({
  totalBalance,
  totalMin,
  budget,
  onBudgetChange,
}: {
  totalBalance: number;
  totalMin: number;
  budget: number;
  onBudgetChange: (value: number) => void;
}) {
  const budgetId = useId();
  return (
    <section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`rounded-card border border-teal/30 ${APP_TINT} p-4`}>
          <p className="text-sm text-deep">Total Balance</p>
          <h3 className="mt-1 text-2xl font-bold text-deep">{formatCurrency(totalBalance)}</h3>
        </div>
        <div className={`rounded-card border border-teal/30 ${APP_TINT} p-4`}>
          <p className="text-sm text-deep">Sum of Minimums</p>
          <h3 className="mt-1 text-2xl font-bold text-deep">{formatCurrency(totalMin)}</h3>
        </div>
        <div className={`rounded-card border border-teal/30 ${APP_TINT} p-4`}>
          <label htmlFor={budgetId} className="text-sm text-deep">
            Monthly Budget for Debt
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={budgetId}
              type="number"
              min={0}
              className="w-full rounded-md border border-teal/40 bg-white px-2 py-1.5 text-xl font-bold text-deep focus:outline-none focus:ring-2 focus:ring-ring"
              value={budget}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
            />
            <span className="shrink-0 text-xs text-muted">(≥ minimums)</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Thousands-separated display (e.g. 8741 -> "8,741"); raw while focused so
// typing isn't fighting a comma being inserted mid-keystroke.
function formatUsdInput(value: number): string {
  return value ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "";
}

const INPUT = "w-full rounded-md border border-teal/40 px-2 py-1.5 text-sm text-deep focus:outline-none focus:ring-2 focus:ring-ring";
const MONEY_INPUT = "w-full rounded-md border border-teal/40 py-1.5 pl-5 pr-2 text-sm text-deep focus:outline-none focus:ring-2 focus:ring-ring";
const GRID = "sm:grid-cols-[2fr_1.2fr_1fr_1.2fr_1fr_auto]";

function DebtRow({
  debt,
  onChange,
  onRemove,
  onToggleActive,
}: {
  debt: CalcDebt;
  onChange: (field: DebtField, value: string) => void;
  onRemove: () => void;
  onToggleActive: () => void;
}) {
  const [balanceFocused, setBalanceFocused] = useState(false);
  const [minFocused, setMinFocused] = useState(false);

  return (
    <div className={`grid min-w-0 grid-cols-2 items-center gap-3 border-b border-teal/15 px-4 py-3 ${GRID} ${debt.active ? "" : "opacity-50"}`}>
      <input type="text" aria-label="Debt Name" placeholder="Debt Name" className={INPUT} value={debt.name} onChange={(e) => onChange("name", e.target.value)} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-deep/60">$</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Balance ($)"
          placeholder="Balance ($)"
          className={MONEY_INPUT}
          value={balanceFocused ? debt.balance || "" : formatUsdInput(debt.balance)}
          onFocus={() => setBalanceFocused(true)}
          onBlur={() => setBalanceFocused(false)}
          onChange={(e) => onChange("balance", e.target.value.replace(/,/g, ""))}
        />
      </div>
      <input type="number" aria-label="APR (%)" placeholder="APR (%)" className={INPUT} value={debt.apr} onChange={(e) => onChange("apr", e.target.value)} />
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-deep/60">$</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Min Payment ($)"
          placeholder="Min Payment ($)"
          className={MONEY_INPUT}
          value={minFocused ? debt.min || "" : formatUsdInput(debt.min)}
          onFocus={() => setMinFocused(true)}
          onBlur={() => setMinFocused(false)}
          onChange={(e) => onChange("min", e.target.value.replace(/,/g, ""))}
        />
      </div>
      {/* Page links only exist in the customer's own session right after an
          import - saved debts carry no page, so the customer sees "—" here
          too once they reload. */}
      <div className="min-w-0 text-sm">
        <span className="text-xs text-muted">—</span>
      </div>
      <div className="col-span-2 flex min-w-0 items-center justify-end gap-2 sm:col-span-1">
        <button type="button" onClick={onRemove} className="rounded-md bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-hover">
          Remove
        </button>
        <button
          type="button"
          title={debt.active ? "Ignore this row" : "Include this row"}
          aria-label={debt.active ? `Ignore ${debt.name || "this row"}` : `Include ${debt.name || "this row"}`}
          aria-pressed={!debt.active}
          onClick={onToggleActive}
          className="rounded-full border border-teal/40 p-1.5 text-teal hover:bg-teal/10"
        >
          {debt.active ? "👁" : "🚫"}
        </button>
      </div>
    </div>
  );
}

export function DebtTable({
  debts,
  sourceDocuments,
  onChange,
  onRemove,
  onToggleActive,
  onAdd,
}: {
  debts: CalcDebt[];
  sourceDocuments: LeadSourceDocument[];
  onChange: (uid: number, field: DebtField, value: string) => void;
  onRemove: (uid: number) => void;
  onToggleActive: (uid: number) => void;
  onAdd: () => void;
}) {
  return (
    <section className="py-6">
      <div className="rounded-card border border-teal/30 bg-white shadow-card">
        <div className={`hidden gap-3 border-b border-teal/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-deep sm:grid ${GRID}`}>
          <span>Debt Name</span>
          <span>Balance ($)</span>
          <span>APR (%)</span>
          <span>Min Payment ($)</span>
          <span>Source</span>
          <span>&nbsp;</span>
        </div>

        {debts.length === 0 && <p className="border-b border-teal/15 px-4 py-4 text-center text-sm text-muted">The customer hasn't entered any debts yet.</p>}

        {debts.map((d) => (
          <DebtRow
            key={d.uid}
            debt={d}
            onChange={(field, value) => onChange(d.uid, field, value)}
            onRemove={() => onRemove(d.uid)}
            onToggleActive={() => onToggleActive(d.uid)}
          />
        ))}

        <div className="flex justify-center gap-3 px-4 py-4">
          <button type="button" onClick={onAdd} className="rounded-lg border border-teal px-4 py-2 text-sm font-semibold text-teal hover:bg-teal/10">
            + Add Debt
          </button>
        </div>
      </div>
      <SourceDocumentSection documents={sourceDocuments} />
    </section>
  );
}

function DocumentCard({ doc }: { doc: LeadSourceDocument }) {
  const uploadedDate = new Date(doc.uploadedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  function handleDownload() {
    const a = document.createElement("a");
    a.href = doc.downloadUrl;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex flex-col gap-4 border-t border-teal/20 pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <IconFileText width={24} height={24} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-deep">{doc.fileName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <IconCalendar width={14} height={14} strokeWidth={1.5} />
              Uploaded {uploadedDate}
            </span>
            {doc.pageCount != null && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <IconLayers width={14} height={14} strokeWidth={1.5} />
                  {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
                </span>
              </>
            )}
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-green-600">
              <IconCheckCircle width={14} height={14} strokeWidth={1.5} />
              {doc.debtsImportedCount} {doc.debtsImportedCount === 1 ? "debt" : "debts"} imported
            </span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a
          href={doc.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 px-3 py-2 text-xs font-semibold text-teal hover:bg-teal/10"
        >
          <IconEye width={16} height={16} strokeWidth={1.5} />
          View Report
        </a>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 px-3 py-2 text-xs font-semibold text-teal hover:bg-teal/10"
        >
          <IconDownload width={16} height={16} strokeWidth={1.5} />
          Download PDF
        </button>
      </div>
    </div>
  );
}

function SourceDocumentSection({ documents }: { documents: LeadSourceDocument[] }) {
  if (documents.length === 0) return null;

  return (
    <div className={`mt-6 rounded-card border border-teal/30 ${APP_TINT} p-5`}>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-deep">Source Documents</h3>
      <div className="flex flex-col gap-4">
        {documents.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} />
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">This is the original credit report you uploaded. Each debt above is linked to a page in this report.</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <IconLock width={14} height={14} strokeWidth={1.5} className="text-green-600" />
        Your data is secure and encrypted. We never share your credit report.
      </p>
    </div>
  );
}
