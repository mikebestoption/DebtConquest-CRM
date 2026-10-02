import { apiRequest } from "./client";
import type { LeadDebt } from "./leadCalculator";

// Mirrors server/src/services/leadSync.service.ts: one opaque token per kind
// of lead data, different after any write to it - by the customer in their
// app, or by anyone in the CRM. Comparing them is how an open lead notices
// that something changed (see features/leadDetail/liveLead.ts).
export interface LeadRevisions {
  lead: string;
  debts: string;
  budget: string;
  documents: string;
  creditors: string;
  creditReports: string;
  bankInfo: string;
}

export function fetchLeadRevisions(leadId: string, signal?: AbortSignal): Promise<{ status: string; rev: LeadRevisions }> {
  return apiRequest(`/leads/${leadId}/sync`, { signal });
}

export interface LeadDebtInput {
  name: string;
  balance: number;
  apr: number;
  min: number;
  active: boolean;
  source: "MANUAL" | "CREDIT_REPORT";
}

// Replaces the customer's own debt list (they see it in their app within
// seconds). `baseRev` is the debts revision the list was loaded at: the
// server answers 409 instead of saving if the customer has changed their
// debts since.
export function saveLeadDebts(leadId: string, debts: LeadDebtInput[], baseRev: string | undefined): Promise<{ status: string; debts: LeadDebt[]; rev: LeadRevisions }> {
  return apiRequest(`/leads/${leadId}/debts`, { method: "PUT", body: JSON.stringify({ debts, baseRev }) });
}
