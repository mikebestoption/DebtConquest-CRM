import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { DebtInput, SettlementRate } from "@debtconquest/calc-engine";
import { ApiError } from "../../../api/client";
import { fetchCrmSettlementRates, fetchLeadDebts, toDebtInput, type LeadSourceDocument } from "../../../api/leadCalculator";
import { saveLeadDebts } from "../../../api/leadSync";
import { confirmAction } from "../../../state/confirmStore";
import { useLatest, useLiveLead } from "../liveLead";
import { computePayoffComparison, computeProgramCost, formatCurrency, selectActiveDebts, selectTotalBalance, selectTotalMinPayment } from "./calc";
import { THIRD_NARRATIVE, firstNarrative, secondNarrative } from "./copy";
import { DebtTable, TotalsBar } from "./DebtSection";
import { InfoModal, MinimumPaymentHistoryModal } from "./modals";
import { BestPathSection, BreakdownSection, CompareSection, FootnoteSection, NarrativeSection, PersonalizedPlanSection } from "./ResultSections";
import { useCalculatorState, type SavedDebt } from "./useCalculatorState";
import { WealthGrowthCalculator } from "./WealthGrowthCalculator";

interface LoadedData {
  leadId: string;
  debts: SavedDebt[];
  sourceDocuments: LeadSourceDocument[];
  rates: SettlementRate[];
  // The server revisions (api/leadSync.ts) of the debts and documents above.
  // Undefined from a server that predates the live sync.
  debtsRev: string | undefined;
  documentsRev: string | undefined;
}

type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "failed"; message: string };

// What a saved debt list comes down to: blank rows and stray spaces aside.
function debtsFingerprint(debts: DebtInput[]): string {
  return JSON.stringify(
    debts.filter(hasContent).map((d) => [(d.name ?? "").trim(), Number(d.balance) || 0, Number(d.apr) || 0, Number(d.min) || 0, !!d.active]),
  );
}

function hasContent(d: DebtInput): boolean {
  return (d.name ?? "").trim() !== "" || Number(d.balance) > 0 || Number(d.apr) > 0 || Number(d.min) > 0;
}

// The customer's own debt calculator (apps/client's App.tsx, minus the
// intake forms), live in both senses:
//
//   - every value can be changed, debts can be hidden with the eye or
//     removed/added, and every result below recomputes the same way it does
//     for the customer. That's a what-if copy: nothing reaches the customer
//     unless the agent chooses "Save debts to customer", which replaces the
//     debt list in their app (they see it within seconds);
//   - it follows the customer: when they change their debts in their app,
//     the list here changes with them (see ../liveLead.ts), the agent's
//     other what-if settings staying as they are - unless the agent has
//     edited the debt rows themselves. Then theirs are kept, with a notice
//     offering the customer's latest.
export function CustomerCalculatorSection({ leadId }: { leadId: string }) {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped to start the view over from `data`.
  const [version, setVersion] = useState(0);
  // The customer changed their debts while the agent has edited the list.
  const [stale, setStale] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  // Whether the debt rows in the view differ from the customer's (set by it).
  const debtsEdited = useRef(false);
  const shown = useRef<LoadedData | null>(null);
  shown.current = data;
  const latest = useLatest();
  const rev = useLiveLead();

  // `live`: because the customer's data changed, not because the agent asked.
  const load = useCallback(
    async (live = false) => {
      const ticket = latest.begin();
      try {
        const current = shown.current?.leadId === leadId ? shown.current : null;
        // The settlement rates are a reference table: a live update only
        // needs the customer's debts again.
        const [d, rates] = await Promise.all([fetchLeadDebts(leadId), live && current ? current.rates : fetchCrmSettlementRates().then((r) => r.rates)]);
        if (!latest.isCurrent(ticket)) return;
        const fresh: LoadedData = {
          leadId,
          debts: d.debts.map(toDebtInput),
          sourceDocuments: d.sourceDocuments ?? [],
          rates,
          debtsRev: d.rev?.debts,
          documentsRev: d.rev?.documents,
        };
        if (live && current && debtsEdited.current) {
          // Keep the agent's rows. The documents list can follow anyway; the
          // debts stay as loaded, so a save over the customer's newer list is
          // refused (see handleSave) until the agent takes it.
          setData({ ...current, sourceDocuments: fresh.sourceDocuments, documentsRev: fresh.documentsRev });
          if (fresh.debtsRev !== current.debtsRev) setStale(true);
          return;
        }
        setData(fresh);
        setStale(false);
        // A live update is taken in place by the view (see its effect on
        // data.debts); anything else starts it over.
        if (live && current) return;
        setVersion((n) => n + 1);
        setSave({ status: "idle" });
      } catch (err) {
        // A live refresh that fails leaves what's on screen for the next one.
        if (!live) setError(err instanceof Error ? err.message : "Failed to load calculator data");
      }
    },
    [leadId, latest],
  );

  useEffect(() => {
    setError(null);
    load();
  }, [load]);

  // What's shown is no longer what the customer has: follow them. (Once the
  // agent has been told their copy is behind, only the documents do.)
  const debtsRev = data?.debtsRev;
  const documentsRev = data?.documentsRev;
  const loadedLeadId = data?.leadId;
  const liveDebtsRev = rev?.debts;
  const liveDocumentsRev = rev?.documents;
  useEffect(() => {
    if (liveDebtsRev === undefined || loadedLeadId !== leadId || debtsRev === undefined) return;
    if (liveDocumentsRev !== documentsRev || (liveDebtsRev !== debtsRev && !stale)) load(true);
  }, [liveDebtsRev, liveDocumentsRev, debtsRev, documentsRev, stale, loadedLeadId, leadId, load]);

  const reset = useCallback(() => {
    if (stale) return void load();
    setVersion((n) => n + 1);
    setSave({ status: "idle" });
  }, [stale, load]);

  const handleSave = useCallback(
    async (debts: SavedDebt[]) => {
      const ok = await confirmAction({
        title: "Save these debts to the customer's calculator?",
        message:
          "This replaces the debt list in the customer's own app with the one shown here - they'll see it within a few seconds. The other what-if settings (budget, program length, assumptions) stay here and aren't saved.",
        confirmLabel: "Save to customer",
        tone: "warning",
      });
      if (!ok) return;
      setSave({ status: "saving" });
      latest.invalidate();
      try {
        const res = await saveLeadDebts(
          leadId,
          debts.filter(hasContent).map((d) => ({
            name: (d.name ?? "").trim(),
            balance: Number(d.balance) || 0,
            apr: Number(d.apr) || 0,
            min: Number(d.min) || 0,
            active: !!d.active,
            source: d.source ?? "MANUAL",
          })),
          debtsRev,
        );
        latest.invalidate();
        setData((prev) => (prev ? { ...prev, debts: res.debts.map(toDebtInput), debtsRev: res.rev.debts } : prev));
        setStale(false);
        setSave({ status: "saved" });
      } catch (err) {
        latest.invalidate();
        // The customer changed their debts since this copy was loaded.
        if (err instanceof ApiError && err.status === 409) setStale(true);
        setSave({ status: "failed", message: err instanceof Error ? err.message : "Failed to save" });
      }
    },
    [leadId, debtsRev, latest],
  );

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data || data.leadId !== leadId) return <p className="text-sm text-muted">Loading customer calculator view…</p>;

  // Keyed so a reset, the customer's newer data, or a different lead starts
  // from a fresh copy of what the customer has saved.
  return (
    <CalculatorView
      key={`${leadId}:${version}`}
      data={data}
      debtsEditedRef={debtsEdited}
      stale={stale}
      save={save}
      onReset={reset}
      onLoadLatest={() => load()}
      onSave={handleSave}
    />
  );
}

function CalculatorView({
  data,
  debtsEditedRef,
  stale,
  save,
  onReset,
  onLoadLatest,
  onSave,
}: {
  data: LoadedData;
  debtsEditedRef: MutableRefObject<boolean>;
  stale: boolean;
  save: SaveState;
  onReset: () => void;
  onLoadLatest: () => void;
  onSave: (debts: SavedDebt[]) => void;
}) {
  const calc = useCalculatorState(data.debts);
  const { debts, budget, programMonths, legalSupportEnabled, assumptions, dirty, replaceDebts } = calc;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [info, setInfo] = useState<{ title: string; message: string } | null>(null);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeInfo = useCallback(() => setInfo(null), []);

  // Whether the debt list here differs from the customer's saved one - the
  // only part of this view that can be saved to them, and what decides
  // whether their next change can simply be taken (see the section above).
  const debtsChanged = useMemo(() => debtsFingerprint(debts) !== debtsFingerprint(data.debts), [debts, data.debts]);
  useEffect(() => {
    debtsEditedRef.current = debtsChanged;
  }, [debtsChanged, debtsEditedRef]);

  // The customer's list moved on (a live update): rows the agent hasn't
  // edited follow it, everything else in this view staying as it is.
  const followed = useRef(data.debts);
  useEffect(() => {
    const before = followed.current;
    if (data.debts === before) return;
    followed.current = data.debts;
    if (debtsFingerprint(debts) === debtsFingerprint(before)) replaceDebts(data.debts);
    // Only when the customer's list changes - not on the agent's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.debts]);

  const totalBalance = selectTotalBalance(debts);
  const totalMin = selectTotalMinPayment(debts);
  const hasActiveDebts = selectActiveDebts(debts).some((d) => Number(d.balance) > 0);

  const comparison = useMemo(() => computePayoffComparison(debts, budget), [debts, budget]);
  const programCost = useMemo(() => computeProgramCost(debts, programMonths, data.rates), [debts, programMonths, data.rates]);
  const minimum = comparison.minimum;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 rounded-lg border border-border bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted">
            <span className="font-semibold text-ink">What-if mode.</span> Change any value below to see new results. Nothing changes for the customer unless you save the debts to
            their calculator.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Edited</span>}
            <button
              type="button"
              onClick={onReset}
              disabled={!dirty && !stale}
              className="rounded-md border border-teal px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal/10 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Reset to customer's data
            </button>
            <button
              type="button"
              onClick={() => onSave(debts)}
              disabled={!debtsChanged || save.status === "saving"}
              title={debtsChanged ? "Replace the debt list in the customer's own app with this one" : "The debts here are the same as the customer's"}
              className="rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-teal"
            >
              {save.status === "saving" ? "Saving…" : "Save debts to customer"}
            </button>
          </div>
        </div>
        {stale && (
          <p role="status" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="min-w-0 flex-1 basis-64">The customer has changed their debts in their app since you started editing. Your edits are still here.</span>
            <button type="button" onClick={onLoadLatest} className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
              Load the customer's latest
            </button>
          </p>
        )}
        {save.status === "saved" && !debtsChanged && (
          <p role="status" className="mt-2 text-sm text-teal">
            Saved. The customer's calculator now shows these debts.
          </p>
        )}
        {save.status === "failed" && (
          <p role="alert" className="mt-2 text-sm text-error">
            {save.message}
          </p>
        )}
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
