import { useCallback, useEffect, useMemo, useState } from "react";
import type { DebtInput, SettlementRate } from "@debtconquest/calc-engine";
import { fetchCrmSettlementRates, fetchLeadDebts, toDebtInput, type LeadSourceDocument } from "../../../api/leadCalculator";
import { computePayoffComparison, computeProgramCost, formatCurrency, selectActiveDebts, selectTotalBalance, selectTotalMinPayment } from "./calc";
import { THIRD_NARRATIVE, firstNarrative, secondNarrative } from "./copy";
import { DebtTable, TotalsBar } from "./DebtSection";
import { InfoModal, MinimumPaymentHistoryModal } from "./modals";
import { BestPathSection, BreakdownSection, CompareSection, FootnoteSection, NarrativeSection, PersonalizedPlanSection } from "./ResultSections";
import { useCalculatorState } from "./useCalculatorState";
import { WealthGrowthCalculator } from "./WealthGrowthCalculator";

interface LoadedData {
  leadId: string;
  debts: DebtInput[];
  sourceDocuments: LeadSourceDocument[];
  rates: SettlementRate[];
}

// The customer's own debt calculator (apps/client's App.tsx, minus the
// intake forms), live: every value can be changed, debts can be hidden
// with the eye or removed/added, and every result below recomputes the same
// way it does for the customer. It's a what-if copy - nothing is saved back
// to the customer's calculator, and "Reset to customer's data" (or opening
// the lead again) brings back exactly what they have saved.
export function CustomerCalculatorSection({ leadId }: { leadId: string }) {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([fetchLeadDebts(leadId), fetchCrmSettlementRates()])
      .then(([d, r]) => {
        if (cancelled) return;
        setData({ leadId, debts: d.debts.map(toDebtInput), sourceDocuments: d.sourceDocuments ?? [], rates: r.rates });
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load calculator data"));
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const reset = useCallback(() => setResetCount((n) => n + 1), []);

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data || data.leadId !== leadId) return <p className="text-sm text-muted">Loading customer calculator view…</p>;

  // Keyed so a reset, or a different lead, starts from a fresh copy of the
  // customer's saved data.
  return <CalculatorView key={`${leadId}:${resetCount}`} data={data} onReset={reset} />;
}

function CalculatorView({ data, onReset }: { data: LoadedData; onReset: () => void }) {
  const calc = useCalculatorState(data.debts);
  const { debts, budget, programMonths, legalSupportEnabled, assumptions, dirty } = calc;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeInfo = useCallback(() => setInfo(null), []);

  const totalBalance = selectTotalBalance(debts);
  const totalMin = selectTotalMinPayment(debts);
  const hasActiveDebts = selectActiveDebts(debts).some((d) => Number(d.balance) > 0);

  const comparison = useMemo(() => computePayoffComparison(debts, budget), [debts, budget]);
  const programCost = useMemo(() => computeProgramCost(debts, programMonths, data.rates), [debts, programMonths, data.rates]);
  const minimum = comparison.minimum;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5">
        <p className="min-w-0 flex-1 text-sm text-muted">
          <span className="font-semibold text-ink">What-if mode.</span> Change any value below to see new results. The customer's saved calculator is never changed.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Edited</span>}
          <button
            type="button"
            onClick={onReset}
            disabled={!dirty}
            className="rounded-md border border-teal px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal/10 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
          >
            Reset to customer's data
          </button>
        </div>
      </div>

      {/* The app's own page background, so this reads as the customer's screen. */}
      <div className="rounded-card bg-[#ebffff] px-4 pb-2 pt-5 sm:px-6">
        <TotalsBar totalBalance={totalBalance} totalMin={totalMin} budget={budget} onBudgetChange={calc.setBudget} />
        <DebtTable
          debts={debts}
          sourceDocuments={data.sourceDocuments}
          onChange={calc.updateDebt}
          onRemove={calc.removeDebt}
          onToggleActive={calc.toggleDebtActive}
          onAdd={calc.addDebt}
        />

        {hasActiveDebts && (
          <BreakdownSection debts={debts} totalBalance={totalBalance} budgetUsed={comparison.effectiveBudget} comparison={comparison} onOpenHistory={() => setHistoryOpen(true)} />
        )}

        {hasActiveDebts && minimum && (
          <>
            <NarrativeSection paragraphs={firstNarrative(firstNarrativeYears(minimum.months), formatCurrency(Math.round(minimum.totalInterest)))} />
            <BestPathSection
              totalPrincipal={totalBalance}
              minimumResult={minimum}
              programCost={programCost}
              programMonths={programMonths}
              assumptions={assumptions}
              onAssumptionChange={calc.setAssumption}
              onResetAssumptions={calc.resetAssumptions}
            />
            <NarrativeSection paragraphs={secondNarrative(yearsDotMonths(minimum.months), formatCurrency(minimum.totalPaid))} />
            <PersonalizedPlanSection
              totalPrincipal={totalBalance}
              programCost={programCost}
              programMonths={programMonths}
              legalSupportEnabled={legalSupportEnabled}
              onProgramMonthsChange={calc.setProgramMonths}
              onLegalSupportChange={calc.setLegalSupportEnabled}
              onInfo={(title, message) => setInfo({ title, message })}
            />
            <NarrativeSection paragraphs={THIRD_NARRATIVE} />
            <CompareSection totalPrincipal={totalBalance} programCost={programCost} programMonths={programMonths} />
            <WealthGrowthCalculator
              totalPrincipal={totalBalance}
              minPayYears={Number(yearsDotMonths(minimum.months))}
              dcYears={Number((programMonths / 12).toFixed(1))}
              totalMinPayment={comparison.effectiveBudget}
              onEdit={calc.markDirty}
            />
          </>
        )}

        <FootnoteSection />
      </div>

      <MinimumPaymentHistoryModal debts={debts} budget={budget} open={historyOpen} onClose={closeHistory} />
      <InfoModal info={info} onClose={closeInfo} />
    </div>
  );
}

// The client writes a payoff time as "<years>.<months>" (e.g. 26 months ->
// "2.2"), not decimal years - mirrored so every figure matches its screen.
function yearsDotMonths(months: number): string {
  return `${Math.floor(months / 12)}.${months % 12}`;
}

// narrativeText.ts's getFirstNarrativeParams drops a ".0" remainder.
function firstNarrativeYears(months: number): string {
  return months % 12 > 0 ? yearsDotMonths(months) : `${Math.floor(months / 12)}`;
}
