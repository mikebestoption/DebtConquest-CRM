import { useCallback, useState } from "react";
import type { DebtInput } from "@debtconquest/calc-engine";
import { DEFAULT_ASSUMPTIONS, DEFAULT_LEGAL_SUPPORT_ENABLED, DEFAULT_PROGRAM_MONTHS, type Assumptions } from "./calc";

// A debt as the customer has it saved: `source` (where the row came from)
// isn't shown, only carried, so a list saved back to them keeps it.
export type SavedDebt = DebtInput & { source?: "MANUAL" | "CREDIT_REPORT" };

// A debt row plus a local id, so rows keep their identity (focus, keys)
// when one above them is removed - the client keys by index.
export type CalcDebt = SavedDebt & { uid: number };

export type DebtField = "name" | "balance" | "apr" | "min";

let nextUid = 1;
function withUid(d: SavedDebt): CalcDebt {
  return { ...d, uid: nextUid++ };
}

function sumActiveMins(debts: DebtInput[]): number {
  return debts.filter((d) => d.active).reduce((s, d) => s + Number(d.min || 0), 0);
}

// The CRM's what-if copy of the customer's calculator: the same actions as
// the client's debtStore.ts / programCostStore.ts / assumptionsStore.ts,
// ported one-for-one, but held in local state for this view only. Nothing
// here writes anything back - the customer's saved calculator is untouched
// no matter what an agent changes (unless they choose to save the debt list
// to it - see CustomerCalculatorSection), and remounting the view resets it.
export function useCalculatorState(initialDebts: SavedDebt[]) {
  const [debts, setDebts] = useState<CalcDebt[]>(() => initialDebts.map(withUid));
  // debtStore.ts's loadDebts(): the budget starts at the sum of active minimums.
  const [budget, setBudgetState] = useState(() => sumActiveMins(initialDebts));
  const [programMonths, setProgramMonthsState] = useState(DEFAULT_PROGRAM_MONTHS);
  const [legalSupportEnabled, setLegalSupportState] = useState(DEFAULT_LEGAL_SUPPORT_ENABLED);
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [dirty, setDirty] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  // The customer changed their debts while this view was open: take their
  // list, keeping everything else here. Not an edit by the agent. The budget
  // moves the way the customer's own does (debtStore.ts's applyRemoteDebts):
  // one still at the sum of minimums follows it, a raised one is kept.
  const replaceDebts = useCallback(
    (next: SavedDebt[]) => {
      const minSum = sumActiveMins(next);
      const followsMinimums = budget === sumActiveMins(debts);
      setDebts(next.map(withUid));
      setBudgetState((b) => (followsMinimums ? minSum : Math.max(b, minSum)));
    },
    [budget, debts],
  );

  const addDebt = useCallback(() => {
    setDebts((ds) => [...ds, withUid({ name: "", balance: 0, apr: 0, min: 0, active: true })]);
    setDirty(true);
  }, []);

  const removeDebt = useCallback((uid: number) => {
    setDebts((ds) => ds.filter((d) => d.uid !== uid));
    setDirty(true);
  }, []);

  const updateDebt = useCallback((uid: number, field: DebtField, value: string) => {
    setDebts((ds) => ds.map((d) => (d.uid === uid ? { ...d, [field]: field === "name" ? value : Number(value) } : d)));
    setDirty(true);
  }, []);

  // Same as debtStore.ts's toggleDebtActive: keeps the budget in step with
  // Sum of Minimums - drops the hidden debt's minimum out of the budget,
  // adds it back when it's shown again.
  const toggleDebtActive = useCallback(
    (uid: number) => {
      const debt = debts.find((d) => d.uid === uid);
      if (!debt) return;
      const nextActive = !debt.active;
      const minDelta = Number(debt.min || 0);
      setDebts((ds) => ds.map((d) => (d.uid === uid ? { ...d, active: nextActive } : d)));
      setBudgetState((b) => Math.max(0, b + (nextActive ? minDelta : -minDelta)));
      setDirty(true);
    },
    [debts],
  );

  const setBudget = useCallback((value: number) => {
    setBudgetState(value);
    setDirty(true);
  }, []);

  const setProgramMonths = useCallback((value: number) => {
    setProgramMonthsState(value);
    setDirty(true);
  }, []);

  const setLegalSupportEnabled = useCallback((value: boolean) => {
    setLegalSupportState(value);
    setDirty(true);
  }, []);

  const setAssumption = useCallback((key: keyof Assumptions, value: number) => {
    setAssumptions((a) => ({ ...a, [key]: value }));
    setDirty(true);
  }, []);

  const resetAssumptions = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setDirty(true);
  }, []);

  return {
    debts,
    budget,
    programMonths,
    legalSupportEnabled,
    assumptions,
    dirty,
    markDirty,
    replaceDebts,
    addDebt,
    removeDebt,
    updateDebt,
    toggleDebtActive,
    setBudget,
    setProgramMonths,
    setLegalSupportEnabled,
    setAssumption,
    resetAssumptions,
  };
}
