import { apiRequest } from "./client";

export type ComparePeriod = "30" | "60" | "90" | "all";

export interface CreditProfileSnapshot {
  id: string;
  reportDate: string;
  isCurrent: boolean;
  score: number | null;
  utilization: number | null;
}

export interface ScoreSummary {
  bureau: string | null;
  model: string | null;
  value: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
  changeVsComparison: number | null;
}

export interface RevolvingCard {
  accountGroupId: string;
  creditorName: string | null;
  balance: number | null;
  limit: number | null;
  utilization: number | null;
  monthlyPayment: number | null;
  dateOpened: string | null;
  status: string | null;
}

export interface RevolvingSummary {
  totalBalance: number;
  totalLimits: number;
  utilization: number | null;
  highestCardUtilization: number | null;
  maxedOutCount: number;
  cardCount: number;
  cardsOver50Count: number;
  cards: RevolvingCard[];
}

export interface LoanRow {
  accountGroupId: string;
  category: string;
  creditorName: string | null;
  balance: number | null;
  monthlyPayment: number | null;
  dateOpened: string | null;
  status: string | null;
}

export interface LoanSummary {
  totals: Record<string, { balance: number; count: number }>;
  openCount: number;
  goodStandingCount: number;
  behindCount: number;
  loans: LoanRow[];
}

export interface PaymentHistorySummary {
  totalLate: number;
  late24m: number;
  late30: number;
  late60: number;
  late90Plus: number;
  oldestLateMonth: string | null;
  mostRecentLateMonth: string | null;
  onTimeRate: number | null;
}

export interface CreditAgeSummary {
  oldestMonths: number | null;
  averageMonths: number | null;
  newestMonths: number | null;
}

export interface InquiryItem {
  institutionName: string | null;
  date: string | null;
  daysAgo: number | null;
  classification: string;
  purposeCategory: string | null;
  isNew: boolean;
}

export interface InquirySummary {
  d30: number;
  d90: number;
  d180: number;
  m6: number;
  m12: number;
  byType: Record<string, number>;
  trend: "INCREASING" | "DECREASING" | "STABLE" | "NEW_ACTIVITY" | "INSUFFICIENT_HISTORY";
  items: InquiryItem[];
}

export interface DerogatorySummary {
  collectionsCount: number;
  collectionsAmount: number;
  bankruptciesCount: number;
  creditMixCount: number;
  collections: { creditorName: string | null; balance: number | null; status: string | null }[];
}

export interface HealthGrade {
  index: number;
  grade: string;
}

export type Trend = "IMPROVING" | "DETERIORATING" | "STABLE" | "NEW_ACTIVITY" | "INSUFFICIENT_HISTORY";
export interface TrendRow {
  metric: string;
  historical: number | string | null;
  current: number | string | null;
  change: number | string | null;
  trend: Trend;
  interpretation: string;
}

export interface AccountChangeRow {
  accountGroupId: string;
  creditorName: string | null;
  historicalBalance: number | null;
  currentBalance: number | null;
  balanceChange: number | null;
  historicalUtilization: number | null;
  currentUtilization: number | null;
  statusChange: string;
}

export interface CreditProfileView {
  snapshots: CreditProfileSnapshot[];
  currentSnapshotId: string;
  comparisonSnapshotId: string | null;
  comparePeriod: ComparePeriod;
  reportDate: string;
  reportProvider: string | null;
  bureausCovered: string[];
  extractionConfidence: number | null;
  score: ScoreSummary;
  revolving: RevolvingSummary;
  loans: LoanSummary;
  paymentHistory: PaymentHistorySummary;
  creditAge: CreditAgeSummary;
  inquiries: InquirySummary;
  derogatory: DerogatorySummary;
  health: HealthGrade;
  trendRows: TrendRow[];
  accountChanges: AccountChangeRow[];
}

export function fetchCreditProfileSnapshots(leadId: string): Promise<{ snapshots: CreditProfileSnapshot[] }> {
  return apiRequest(`/leads/${leadId}/credit-profile/snapshots`);
}

export function fetchCreditProfile(leadId: string, opts: { snapshotId?: string; comparePeriod: ComparePeriod }): Promise<{ profile: CreditProfileView | null }> {
  const params = new URLSearchParams({ comparePeriod: opts.comparePeriod });
  if (opts.snapshotId) params.set("snapshotId", opts.snapshotId);
  return apiRequest(`/leads/${leadId}/credit-profile?${params.toString()}`);
}
