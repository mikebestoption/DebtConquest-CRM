import { apiRequest } from "./client";
import type { DebtInput, SettlementRate } from "@debtconquest/calc-engine";
import type { LeadRevisions } from "./leadSync";

// Mirrors server/src/routes/crm/creditor.route.ts's toDebtResponse - the
// exact same Debt rows the customer wizard's "Enter your debts" step reads
// (see server's routes/leads.route.ts). The CRM's calculator view edits a
// local copy (see customerCalculator/); these only change when an agent
// saves that copy to the customer (saveLeadDebts in api/leadSync.ts).
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

// The customer's uploaded debt documents, same shape as GET /leads/:uuid's
// sourceDocuments. Optional: a server without that addition just omits it.
export interface LeadSourceDocument {
  id: string;
  fileName: string;
  uploadedAt: string;
  pageCount: number | null;
  debtsImportedCount: number;
  downloadUrl: string;
}

// `rev` is what this snapshot corresponds to (see api/leadSync.ts) - sent
// back as `baseRev` when saving the list to the customer's calculator.
export function fetchLeadDebts(leadId: string): Promise<{ status: string; debts: LeadDebt[]; sourceDocuments?: LeadSourceDocument[]; rev?: LeadRevisions }> {
  return apiRequest(`/leads/${leadId}/debts`);
}

export function fetchCrmSettlementRates(): Promise<{ status: string; rates: SettlementRate[] }> {
  return apiRequest("/settlement-rates");
}

// Adapts a LeadDebt row into the calc-engine's own input shape - same
// field rename the client wizard's GET /leads/:uuid response already does
// (debtName -> name, minPayment -> min, isActive -> active).
// `source` rides along so a row saved back keeps saying where it came from.
export function toDebtInput(d: LeadDebt): DebtInput & { source: LeadDebt["source"] } {
  return { name: d.debtName, balance: d.balance, apr: d.apr, min: d.minPayment, active: d.isActive, source: d.source };
}
