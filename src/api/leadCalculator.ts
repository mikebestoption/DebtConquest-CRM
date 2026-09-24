import { apiRequest } from "./client";
import type { DebtInput, SettlementRate } from "@debtconquest/calc-engine";

// Mirrors server/src/routes/crm/creditor.route.ts's toDebtResponse - the
// exact same Debt rows the customer wizard's "Enter your debts" step reads
// (see server's routes/leads.route.ts), read-only here.
export interface LeadDebt {
  id: string;
  debtName: string;
  balance: number;
  apr: number;
  minPayment: number;
  isActive: boolean;
  source: "MANUAL" | "CREDIT_REPORT";
  sortOrder: number;
}

export function fetchLeadDebts(leadId: string): Promise<{ status: string; debts: LeadDebt[] }> {
  return apiRequest(`/leads/${leadId}/debts`);
}

export function fetchCrmSettlementRates(): Promise<{ status: string; rates: SettlementRate[] }> {
  return apiRequest("/settlement-rates");
}

// Adapts a LeadDebt row into the calc-engine's own input shape - same
// field rename the client wizard's GET /leads/:uuid response already does
// (debtName -> name, minPayment -> min, isActive -> active).
export function toDebtInput(d: LeadDebt): DebtInput {
  return { name: d.debtName, balance: d.balance, apr: d.apr, min: d.minPayment, active: d.isActive };
}
