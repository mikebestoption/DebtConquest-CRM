import {
  calculateProgramCost,
  calculateProgramFee,
  calculateSettlementAmount,
  calculateWealthGrowth,
  simulateMultiDebtPayoff,
  simulateSingleBalancePayoff,
  validateMinimumPayments,
  yearsAndMonthsToTotalMonths,
  type DebtInput,
  type PayoffResult,
  type SettlementRate,
} from "@debtconquest/calc-engine";

// This whole file ports the pure calculation logic behind the customer
// wizard's read-only "results" sections (apps/client/src/features/
// comparison/usePayoffComparison.ts, programCost/useProgramCost.ts,
// compare/useCompareChart.ts, wealth/useWealthGrowthSeries.ts) as plain
// functions instead of Zustand-backed hooks - this view has no live
// customer session to react to, just one fetched snapshot of the lead's
// debts. Defaults (programMonths=36, legalSupportEnabled=true, wealth
// returnRate=7%, credit-counseling/loan-consolidation assumptions) match
// the client's own store defaults (programCostStore.ts, assumptionsStore.ts,
// wealthStore.ts) verbatim - this section never lets an agent override them,
// same "no forms here" scope as the rest of this panel.

export const DEFAULT_PROGRAM_MONTHS = 36;
export const DEFAULT_LEGAL_SUPPORT_ENABLED = true;
export const DEFAULT_WEALTH_RETURN_RATE = 7;
export const CC_ASSUMPTION = { apr: 8.0, months: 48 };
export const LOAN_ASSUMPTION = { apr: 14.9, months: 60 };

export function selectActiveDebts(debts: DebtInput[]): DebtInput[] {
  return debts.filter((d) => d.active);
}

export function selectTotalBalance(debts: DebtInput[]): number {
  return selectActiveDebts(debts).reduce((s, d) => s + Number(d.balance || 0), 0);
}

export function selectTotalMinPayment(debts: DebtInput[]): number {
  return selectActiveDebts(debts).reduce((s, d) => s + Number(d.min || 0), 0);
}

export interface PayoffComparison {
  effectiveBudget: number;
  hasValidationError: boolean;
  minimum: PayoffResult | null;
  snowball: PayoffResult | null;
  avalanche: PayoffResult | null;
}

// Ports usePayoffComparison.ts. `budget` isn't a persisted field (the
// client's own "Monthly Budget for Debt" input is ephemeral, never saved -
// see TotalsBar.tsx/debtStore.ts), so callers pass the same default the
// client itself falls back to: the sum of active minimum payments.
export function computePayoffComparison(debts: DebtInput[], budget: number): PayoffComparison {
  const activeDebts = selectActiveDebts(debts);
  const minRequired = selectTotalMinPayment(debts);
  const effectiveBudget = Math.max(budget, minRequired);

  const validationErrors = validateMinimumPayments(activeDebts);
  if (validationErrors.length > 0) {
    return { effectiveBudget, hasValidationError: true, minimum: null, snowball: null, avalanche: null };
  }

  return {
    effectiveBudget,
    hasValidationError: false,
    minimum: simulateMultiDebtPayoff(activeDebts, effectiveBudget, "minimum"),
    snowball: simulateMultiDebtPayoff(activeDebts, effectiveBudget, "snowball"),
    avalanche: simulateMultiDebtPayoff(activeDebts, effectiveBudget, "avalanche"),
  };
}

export interface ProgramCostSummary {
  totalPrincipal: number;
  totalSettlementAmount: number;
  programFeePercent: number;
  programFeeAmount: number;
  totalCost: number;
  monthlyEmi: number;
}

// Ports useProgramCost.ts.
export function computeProgramCost(debts: DebtInput[], programMonths: number, rates: SettlementRate[]): ProgramCostSummary {
  const activeDebts = selectActiveDebts(debts);
  const totalPrincipal = activeDebts.reduce((s, d) => s + Number(d.balance), 0);
  const totalSettlementAmount = activeDebts.reduce((s, d) => s + calculateSettlementAmount(d.name, d.balance, rates), 0);
  const programFee = calculateProgramFee(totalPrincipal);
  const { totalCost, monthlyEmi } = calculateProgramCost({ totalSettlementAmount, programMonths, programFeeAmount: programFee.feeAmount });

  return { totalPrincipal, totalSettlementAmount, programFeePercent: programFee.feePercent, programFeeAmount: programFee.feeAmount, totalCost, monthlyEmi };
}

export interface CompareChartData {
  labels: string[];
  dcRemaining: number[];
  mpRemaining: number[];
  minPayYearsLabel: string;
}

const MINIMUM_PAYMENT_APR = 24;
const MINIMUM_PAYMENT_RATE_PERCENT = 4;
const MINIMUM_PAYMENT_STOP_THRESHOLD = 190;

// Ports useCompareChart.ts.
export function computeCompareChartData(totalPrincipal: number, programCost: ProgramCostSummary, programMonths: number): CompareChartData {
  const dcTotal = programCost.totalCost;
  const dcPerMonth = programCost.monthlyEmi;
  const dcTotalYears = programMonths / 12;

  const dcRemaining: number[] = [];
  for (let y = 0; y <= Math.ceil(dcTotalYears); y++) {
    dcRemaining.push(Math.max(0, dcTotal - y * 12 * dcPerMonth));
  }

  const minResult = simulateSingleBalancePayoff(totalPrincipal, MINIMUM_PAYMENT_APR, MINIMUM_PAYMENT_RATE_PERCENT, {
    stopThreshold: MINIMUM_PAYMENT_STOP_THRESHOLD,
    trackHistory: true,
  });
  const history = minResult.history ?? [];

  const monthlyBalances: number[] = [totalPrincipal];
  for (const month of history) monthlyBalances.push(month.balance);

  const totalMonths = monthlyBalances.length;
  const totalYears = Math.ceil(totalMonths / 12);
  const labels: string[] = [];
  const mpRemaining: number[] = [];
  for (let y = 0; y <= totalYears; y++) {
    const idx = y * 12;
    mpRemaining.push(monthlyBalances[idx] ?? 0);
    labels.push(`Y${y}`);
  }

  const minPayYearsLabel = `${Math.floor(minResult.months / 12)}.${minResult.months % 12}`;

  return { labels, dcRemaining, mpRemaining, minPayYearsLabel };
}

export interface WealthGrowthSeries {
  labels: string[];
  values: number[];
  totalSaved: number;
}

// Ports useWealthGrowthSeries.ts.
export function computeWealthGrowthSeries(monthlyDeposit: number, difYearsDecimal: number, annualRate: number): WealthGrowthSeries {
  const totalMonths = yearsAndMonthsToTotalMonths(difYearsDecimal);
  const totalYears = Math.ceil(totalMonths / 12);
  const labels: string[] = [];
  const values: number[] = [];

  for (let y = 0; y <= totalYears; y++) {
    const monthsAtY = Math.min(y * 12, totalMonths);
    labels.push(`Y${y}`);
    values.push(calculateWealthGrowth(monthlyDeposit, monthsAtY, annualRate));
  }

  return { labels, values, totalSaved: calculateWealthGrowth(monthlyDeposit, totalMonths, annualRate) };
}
