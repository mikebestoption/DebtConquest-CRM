import { apiRequest } from "./client";

export type CreditPullAgency = "SPINWHEEL" | "XACTUS";
export type CreditBureau = "EQUIFAX" | "EXPERIAN";
export type CreditorAccountHolder = "APPLICANT" | "CO_APPLICANT" | "JOINT";

export const CREDIT_PULL_AGENCY_LABELS: Record<CreditPullAgency, string> = {
  SPINWHEEL: "Spinwheel Credit Pull Agency",
  XACTUS: "Xactus",
};

export const CREDIT_BUREAU_LABELS: Record<CreditBureau, string> = {
  EQUIFAX: "Equifax",
  EXPERIAN: "Experian",
};

export const ACCOUNT_HOLDER_LABELS: Record<CreditorAccountHolder, string> = {
  APPLICANT: "Applicant",
  CO_APPLICANT: "Co-Applicant",
  JOINT: "Joint",
};

// Exactly the Debt Type dropdown's option set as captured from the
// reference CRM (deduplicated - the source capture repeated the full list
// twice). Shown verbatim, not humanized - the reference UI itself renders
// these raw strings as the option labels.
export const DEBT_TYPE_OPTIONS = [
  "Airplane",
  "ApplianceOrFurniture",
  "AttorneyFees",
  "AutoLease",
  "AutoLoan",
  "AutoLoanEquityTransfer",
  "Automobile",
  "AutoRefinance",
  "BiMonthlyMortgageTermInYears",
  "Boat",
  "Business",
  "BusinessCreditCard",
  "Camper",
  "ChargeAccount",
  "CheckCreditOrLineOfCredit",
  "ChildSupport",
  "Collection",
  "CollectionAttorney",
  "Comaker",
  "CombinedCreditPlan",
  "CommercialCreditObligation",
  "CommercialLineOfCredit",
  "CommercialMortgage",
  "ConditionalSalesContract",
  "ConditionalSalesContractRefinance",
  "Consolidation",
  "ConstructionLoan",
  "ConventionalRealEstateMortgage",
  "CreditCard",
  "CreditLineSecured",
  "DebitCard",
  "DebtCounselingService",
  "DeferredStudentLoan",
  "DepositRelated",
  "Educational",
  "Employment",
  "FactoringCompanyAccount",
  "FamilySupport",
  "FarmersHomeAdministrationFHMA",
  "FederalConsolidatedLoan",
  "FHAComakerNotBorrower",
  "FHAHomeImprovement",
  "FHARealEstateMortgage",
  "FinanceStatement",
  "FlexibleSpendingCreditCard",
  "Government",
  "GovernmentBenefit",
  "GovernmentEmployeeAdvance",
  "GovernmentFeeForService",
  "GovernmentFine",
  "GovernmentGrant",
  "GovernmentMiscellaneousDebt",
  "GovernmentOverpayment",
  "GovernmentSecuredDirectLoan",
  "GovernmentSecuredGuaranteeLoan",
  "GovernmentUnsecuredDirectLoan",
  "GovernmentUnsecuredGuaranteeLoan",
  "HomeEquity",
  "HomeEquityLineOfCredit",
  "HomeImprovement",
  "HouseholdGoods",
  "HouseholdGoodsAndOtherCollateralAuto",
  "HouseholdGoodsSecured",
  "InstallmentLoan",
  "InstallmentSalesContract",
  "InsuranceClaims",
  "Lease",
  "LenderPlacedInsurance",
  "LineOfCredit",
  "ManualMortgage",
  "ManufacturedHome",
  "MedicalDebt",
  "MobileHome",
  "MobilePhone",
  "Mortgage",
  "NoteLoan",
  "NoteLoanWithComaker",
  "Other",
  "PartiallySecured",
  "PersonalLoan",
  "RealEstate",
  "RealEstateJuniorLiens",
  "RealEstateLoanEquityTransfer",
  "RealEstateMortgageWithoutOtherCollateral",
  "RealEstateSpecificTypeUnknown",
  "Recreational",
  "RecreationalMerchandise",
  "RecreationalVehicle",
  "Refinance",
  "RefundAnticipationLoan",
  "RentalAgreement",
  "ResidentialLoan",
  "ReturnedCheck",
  "RevolvingBusinessLines",
  "SecondMortgage",
  "Secured",
  "SecuredByCosigner",
  "SecuredCreditCard",
  "SecuredHomeImprovement",
  "SemiMonthlyMortgagePayment",
  "SinglePaymentLoan",
  "SpouseSupport",
  "SummaryOfAccountsWithSameStatus",
  "Telecommunication/Cellular",
  "TimeSharedLoan",
  "Title1Loan",
  "UnknownLoanType",
  "Unsecured",
  "UtilityCompany",
  "V.A.RealEstateMortgage",
  "VeteransAdministrationLoan",
  "VeteransAdministrationRealEstateMortgage",
  "DebtBuyerAccount",
  "FarmersHomeAdministrationFMHA",
  "homeLoan",
  "OtherAutomotive",
  "OtherBanking",
  "OtherClothing",
  "OtherCollectionServices",
  "OtherDepartmentAndMailOrder",
  "OtherFinance",
  "OtherGovernment",
  "OtherHomeFurnishing",
  "OtherLiability",
  "OtherLumberAndHardware",
  "OtherMiscellaneousAndPublicRecord",
  "OtherOilAndNationalCreditCards",
  "OtherRealEstateAndPublicAccommodation",
  "Finance Account",
  "High Risk Account",
  "Security Finance",
  "Medical Debt",
  "Private student loans",
  "Payday_Tribal Loan",
  "AMEX_Discover",
  "Rise",
  "Fortiva",
  "Credit Union",
] as const;

// Not visible in the reference screenshot (the Responsibility dropdown
// wasn't captured open) - standard ECOA-style account-responsibility
// designators used as a starting point. Confirm against the real option set.
export const RESPONSIBILITY_OPTIONS = ["Individual", "Joint", "Authorized User", "Co-Maker", "Maker"];

// Same caveat as RESPONSIBILITY_OPTIONS - the "How Many Months" dropdown
// next to Behind wasn't captured open.
export const BEHIND_MONTHS_OPTIONS = ["1", "2", "3", "4", "5", "6+"];

export interface Creditor {
  id: string;
  accountHolder: CreditorAccountHolder;
  cardholderName: string | null;
  creditorName: string;
  address1: string | null;
  address2: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  phone: string | null;
  fax: string | null;
  accountNo: string | null;
  balance: number;
  monthlyPayment: number;
  lastPaymentDate: string | null;
  debtType: string | null;
  overLimit: boolean;
  behind: boolean;
  behindMonths: number | null;
  includeOnProgram: boolean;
  apr: number;
  creditorLimit: number;
  utilization: number | null;
  difficultCreditor: boolean;
  sameBank: boolean;
  responsibility: string | null;
  dateOpened: string | null;
  bureau: CreditBureau | null;
  creditReportItem: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditorListResponse {
  status: string;
  creditPullAgency: CreditPullAgency;
  creditPullBureau: CreditBureau | null;
  lastPullDate: string | null;
  creditors: Creditor[];
}

export function fetchCreditors(leadId: string): Promise<CreditorListResponse> {
  return apiRequest(`/leads/${leadId}/creditors`);
}

export function updateCreditPullSettings(
  leadId: string,
  patch: { creditPullAgency?: CreditPullAgency; creditPullBureau?: CreditBureau | null },
): Promise<{ status: string; creditPullAgency: CreditPullAgency; creditPullBureau: CreditBureau | null }> {
  return apiRequest(`/leads/${leadId}/credit-pull-settings`, { method: "PATCH", body: JSON.stringify(patch) });
}

// Every field optional so the same shape works for both the Add Creditor
// modal (creditorName required, enforced client-side) and inline edits.
export interface CreditorInput {
  accountHolder?: CreditorAccountHolder;
  cardholderName?: string | null;
  creditorName?: string;
  address1?: string | null;
  address2?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  zip?: string | null;
  phone?: string | null;
  fax?: string | null;
  accountNo?: string | null;
  balance?: number;
  monthlyPayment?: number;
  lastPaymentDate?: string | null;
  debtType?: string | null;
  overLimit?: boolean;
  behind?: boolean;
  behindMonths?: number | null;
  includeOnProgram?: boolean;
  apr?: number;
  creditorLimit?: number;
  difficultCreditor?: boolean;
  sameBank?: boolean;
  responsibility?: string | null;
  dateOpened?: string | null;
}

export function createCreditor(leadId: string, input: CreditorInput): Promise<{ status: string; creditor: Creditor }> {
  return apiRequest(`/leads/${leadId}/creditors`, { method: "POST", body: JSON.stringify(input) });
}

export function updateCreditor(creditorId: string, input: CreditorInput): Promise<{ status: string; creditor: Creditor }> {
  return apiRequest(`/creditors/${creditorId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteCreditor(creditorId: string): Promise<{ status: string }> {
  return apiRequest(`/creditors/${creditorId}`, { method: "DELETE" });
}

export function bulkDeleteCreditors(leadId: string, ids: string[]): Promise<{ status: string }> {
  return apiRequest(`/leads/${leadId}/creditors/bulk-delete`, { method: "POST", body: JSON.stringify({ ids }) });
}

export function bulkUpdateCreditors(
  leadId: string,
  ids: string[],
  patch: { includeOnProgram?: boolean; debtType?: string | null },
): Promise<{ status: string; creditors: Creditor[] }> {
  return apiRequest(`/leads/${leadId}/creditors/bulk-update`, { method: "PATCH", body: JSON.stringify({ ids, ...patch }) });
}
