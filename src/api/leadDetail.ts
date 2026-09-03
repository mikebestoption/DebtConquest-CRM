import { apiRequest } from "./client";
import type { LeadProgram, LeadSource, WorklistStatus } from "./worklist";

export interface LeadDetailSummary {
  debtEnrolled: number;
  dateEnrolled: string | null;
  firstPaymentDate: string | null;
  bankingReceived: boolean;
  creditPulledDate: string | null;
  statusChangedAt: string;
  lastCallDate: string | null;
  daysInStatus: number;
}

export interface LeadApplicant {
  firstName: string | null;
  middleInitial: string | null;
  lastName: string | null;
  streetAddress: string | null;
  address2: string | null;
  country: string | null;
  addressState: string | null;
  city: string | null;
  zip: string | null;
  yearsAtAddress: number | null;
  monthsAtAddress: number | null;
}

export interface LeadPhone {
  homePhone: string | null;
  homePhoneOptOut: boolean;
  cellPhone: string | null;
  cellPhoneOptOut: boolean;
  workPhone: string | null;
  workPhoneExt: string | null;
  workPhoneOptOut: boolean;
  bestTimeToCall: string | null;
  preferredContact: string | null;
}

export interface LeadPersonal {
  email: string | null;
  ssnLast4: string | null;
  dob: string | null;
  dependents: number | null;
  speaksSpanish: boolean | null;
  residencyStatus: string | null;
}

// Free-form JSON buckets (see server LeadProfileDetail model) - shapes owned
// here, not enforced by the backend, so new fields don't need a migration.
export interface ThirdPartyAuthDetail {
  speakerName?: string | null;
  speakerEmail?: string | null;
  speakerPhone?: string | null;
}

export interface EmploymentDetail {
  occupation?: string | null;
  employerName?: string | null;
  yearsAtEmployer?: string | null;
  monthsAtEmployer?: string | null;
  employmentStatus?: string | null;
  employmentWaiver?: string | null;
}

export interface AccountUsageDetail {
  ficoScore?: string | null;
  worstFicoScore?: string | null;
  creditUtilization?: string | null;
  creditCardDebtAmt?: string | null;
  unsecuredDebtAmt?: string | null;
  behindOnAnyBills?: string | null;
  bankruptcy?: string | null;
}

export interface OtherDetail {
  purchaserDup?: string | null;
  mothersMaidenName?: string | null;
  clickId?: string | null;
  referralName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmKeyword?: string | null;
  utmCampaign?: string | null;
  leadSourceId?: string | null;
  subId?: string | null;
  purposeOfLoan?: string | null;
  requestedLoanAmount?: string | null;
  partnerId?: string | null;
  leadType?: string | null;
  modelType?: string | null;
  webSource?: string | null;
  reasonForSubmission?: string | null;
  mailerCode?: string | null;
}

export interface CoApplicantDetail {
  hasCoApplicant?: boolean;
  firstName?: string | null;
  middleInitial?: string | null;
  lastName?: string | null;
  address?: string | null;
  address2?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  zip?: string | null;
  previousAddress?: string | null;
  previousAddress2?: string | null;
  previousCountry?: string | null;
  previousState?: string | null;
  previousCity?: string | null;
  previousZip?: string | null;
  homePhone?: string | null;
  cellPhone?: string | null;
  workPhone?: string | null;
  extension?: string | null;
  email?: string | null;
  secondaryEmail?: string | null;
  ssn?: string | null;
  dob?: string | null;
  currentlyEmployed?: string | null;
  businessType?: string | null;
  selfEmployed?: string | null;
  occupation?: string | null;
  employer?: string | null;
  lengthOfEmployment?: string | null;
  employmentWaiver?: string | null;
  previousEmployer?: string | null;
  mothersMaidenName?: string | null;
  rentOrOwn?: "OWN" | "RENT" | null;
  monthlyRentPayment?: string | null;
  grossAnnualIncome?: string | null;
  ficoScore?: string | null;
}

export interface LeadDetail {
  id: string;
  leadNumber: number;
  createdAt: string;

  queue: string;
  crmStatus: WorklistStatus;
  program: LeadProgram | null;
  source: LeadSource | null;
  assignedStaff: { id: string; name: string } | null;
  rejected: boolean;
  complianceSubmitted: boolean;

  summary: LeadDetailSummary;
  applicant: LeadApplicant;
  phone: LeadPhone;
  personal: LeadPersonal;

  thirdPartyAuth: ThirdPartyAuthDetail | null;
  employment: EmploymentDetail | null;
  accountUsage: AccountUsageDetail | null;
  otherDetails: OtherDetail | null;
  coApplicant: CoApplicantDetail | null;
}

export function fetchLeadDetail(id: string): Promise<{ status: string; lead: LeadDetail }> {
  return apiRequest(`/leads/${id}`);
}

// Matches server/src/routes/crm/leadDetail.route.ts's patchLeadSchema -
// every field independently optional since the Profile tab saves its whole
// form in one PATCH but callers may only ever set a subset.
export interface LeadDetailPatch {
  queue?: string;
  crmStatus?: WorklistStatus;
  program?: LeadProgram | null;
  source?: LeadSource | null;
  assignedStaffId?: string | null;
  rejected?: boolean;

  dateEnrolled?: string | null;
  firstPaymentDate?: string | null;
  bankingReceived?: boolean;
  lastCallDate?: string | null;

  firstName?: string | null;
  middleInitial?: string | null;
  lastName?: string | null;
  streetAddress?: string | null;
  address2?: string | null;
  country?: string | null;
  addressState?: string | null;
  city?: string | null;
  zip?: string | null;
  yearsAtAddress?: number | null;
  monthsAtAddress?: number | null;

  homePhone?: string | null;
  homePhoneOptOut?: boolean;
  cellPhone?: string | null;
  cellPhoneOptOut?: boolean;
  workPhone?: string | null;
  workPhoneExt?: string | null;
  workPhoneOptOut?: boolean;
  bestTimeToCall?: string | null;
  preferredContact?: string | null;

  email?: string | null;
  ssn?: string | null;
  dob?: string | null;
  dependents?: number | null;
  speaksSpanish?: boolean | null;
  residencyStatus?: string | null;
}

export function updateLeadDetail(id: string, patch: LeadDetailPatch): Promise<{ status: string; lead: LeadDetail }> {
  return apiRequest(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export interface ProfileDetailPatch {
  thirdPartyAuth?: ThirdPartyAuthDetail | null;
  employment?: EmploymentDetail | null;
  accountUsage?: AccountUsageDetail | null;
  otherDetails?: OtherDetail | null;
  coApplicant?: CoApplicantDetail | null;
}

export function updateProfileDetail(id: string, patch: ProfileDetailPatch): Promise<{ status: string } & ProfileDetailPatch> {
  return apiRequest(`/leads/${id}/profile-detail`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function submitLeadToCompliance(id: string): Promise<{ status: string }> {
  return apiRequest(`/leads/${id}/submit-compliance`, { method: "POST" });
}

// Permanently deletes a lead and everything under it. Irreversible - meant
// for cleaning up orphaned/duplicate test leads, not routine use.
export function deleteLead(id: string): Promise<{ status: string }> {
  return apiRequest(`/leads/${id}`, { method: "DELETE" });
}
