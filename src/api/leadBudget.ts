import { apiRequest } from "./client";

// Mirrors server/src/schemas/leadBudget.schema.ts, which itself mirrors
// client/src/features/wizard/budgetFields.ts - hand-synced duplicate across
// all three, same tradeoff already accepted for WORKLIST_STATUSES etc. in
// api/worklist.ts. This IS the customer wizard's own Step4Budget data
// (LeadBudget.budgetData) - the CRM edits the same record, not a copy.
export type BudgetFieldKey =
  | "housingPayment"
  | "homeownersInsurance"
  | "secondaryHousingPayment"
  | "healthLifeInsurance"
  | "medicalCare"
  | "prescriptionsMedicalExp"
  | "autoPayments"
  | "autoInsurance"
  | "repairsMaintenance"
  | "gasoline"
  | "parking"
  | "commuting"
  | "groceries"
  | "eatingOut"
  | "gasElectricityOil"
  | "phoneBill"
  | "waterSewerGarbage"
  | "cableInternetBill"
  | "debtExpensesOther"
  | "govtStudentLoans"
  | "privateStudentLoans"
  | "medicalDebt"
  | "childSupport"
  | "alimony"
  | "judgmentPayments"
  | "backTaxes"
  | "clothing"
  | "householdItems"
  | "entertainment"
  | "petCare"
  | "gifts"
  | "toiletries"
  | "hairCare"
  | "laundry"
  | "gym"
  | "personalCareItem"
  | "charityDonations"
  | "daycareChildExpenses"
  | "nursingCare"
  | "misc";

export const BUDGET_FIELD_LABELS: Record<BudgetFieldKey, string> = {
  housingPayment: "Housing Payment",
  homeownersInsurance: "Home Owners Insurance",
  secondaryHousingPayment: "Secondary Housing Payment",
  healthLifeInsurance: "Health/Life Insurance",
  medicalCare: "Medical Care",
  prescriptionsMedicalExp: "Prescriptions/Medical Exp",
  autoPayments: "Auto Payments",
  autoInsurance: "Auto Insurance",
  repairsMaintenance: "Repairs/Maintenance",
  gasoline: "Gasoline",
  parking: "Parking",
  commuting: "Commuting",
  groceries: "Groceries",
  eatingOut: "Eating Out",
  gasElectricityOil: "Average Gas/Electricity/Oil",
  phoneBill: "Average Phone Bill (Including Cell)",
  waterSewerGarbage: "Average Water/Sewer/Garbage",
  cableInternetBill: "Cable/Satellite/Internet Bill",
  debtExpensesOther: "Debt Expenses Other",
  govtStudentLoans: "Govt. Student Loans (non-deferred status)",
  privateStudentLoans: "Private Student Loans (non-deferred status)",
  medicalDebt: "Medical Debt",
  childSupport: "Child Support",
  alimony: "Alimony",
  judgmentPayments: "Judgment Payments",
  backTaxes: "Back Taxes",
  clothing: "Clothing",
  householdItems: "Household Items",
  entertainment: "Entertainment",
  petCare: "Pet Care",
  gifts: "Gifts",
  toiletries: "Toiletries",
  hairCare: "Hair Care",
  laundry: "Laundry",
  gym: "Gym",
  personalCareItem: "Personal Care",
  charityDonations: "Charity Donations",
  daycareChildExpenses: "Daycare/Child Expenses",
  nursingCare: "Nursing Care",
  misc: "Misc",
};

export interface BudgetSection {
  title: string;
  fields: BudgetFieldKey[];
}

export const BUDGET_SECTIONS: BudgetSection[] = [
  { title: "Housing", fields: ["housingPayment", "homeownersInsurance", "secondaryHousingPayment"] },
  { title: "Debt Expenses (Not Enrolled in The Program)", fields: ["debtExpensesOther", "govtStudentLoans", "privateStudentLoans", "medicalDebt"] },
  { title: "Medical", fields: ["healthLifeInsurance", "medicalCare", "prescriptionsMedicalExp"] },
  { title: "Legal & Court Ordered Expenses", fields: ["childSupport", "alimony", "judgmentPayments", "backTaxes"] },
  { title: "Transportation", fields: ["autoPayments", "autoInsurance", "repairsMaintenance", "gasoline", "parking", "commuting"] },
  {
    title: "Personal Care",
    fields: ["clothing", "householdItems", "entertainment", "petCare", "gifts", "toiletries", "hairCare", "laundry", "gym", "personalCareItem", "charityDonations"],
  },
  { title: "Food", fields: ["groceries", "eatingOut"] },
  { title: "Utilities", fields: ["gasElectricityOil", "phoneBill", "waterSewerGarbage", "cableInternetBill"] },
  { title: "Dependent Care", fields: ["daycareChildExpenses", "nursingCare"] },
  { title: "Other Expenses", fields: ["misc"] },
];

export type BudgetExpenses = Partial<Record<BudgetFieldKey, number>>;

export interface BudgetIncome {
  employmentIncome?: number;
  selfEmployment?: number;
  socialSecurity?: number;
  unemployment?: number;
  alimony?: number;
  childSupport?: number;
  otherGovtAssistance?: number;
  annuities?: number;
  dividends?: number;
  retirement?: number;
  otherIncome?: number;
  frequency?: string | null;
  comments?: string | null;
}

export interface BudgetHardship {
  reason?: string | null;
  description?: string | null;
  howGotIntoDebt?: string | null;
  realPain?: string | null;
  ultimateGoal?: string | null;
}

export interface BudgetSummary {
  totalMonthlyIncome: number;
  totalExpenses: number;
  programCost: number;
  totalExpenseWithProgram: number;
  fundsAvailable: number;
  dtiWithProgram: number;
  dtiWithoutProgram: number;
}

export interface LeadBudgetDetail {
  expenses: BudgetExpenses | null;
  housingType: "RENT" | "OWN" | null;
  income: BudgetIncome | null;
  hardship: BudgetHardship | null;
  summary: BudgetSummary;
}

export function fetchLeadBudgetDetail(id: string): Promise<{ status: string } & LeadBudgetDetail> {
  return apiRequest(`/leads/${id}/budget`);
}

export interface LeadBudgetPatch {
  expenses?: BudgetExpenses;
  housingType?: "RENT" | "OWN" | null;
  income?: BudgetIncome;
  hardship?: BudgetHardship;
}

export function updateLeadBudgetDetail(id: string, patch: LeadBudgetPatch): Promise<{ status: string } & LeadBudgetDetail> {
  return apiRequest(`/leads/${id}/budget`, { method: "PATCH", body: JSON.stringify(patch) });
}
