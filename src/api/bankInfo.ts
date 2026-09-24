import { apiRequest } from "./client";

// Mirrors server/src/routes/crm/bankInfo.route.ts.
export type BankAccountOwner = "APPLICANT" | "THIRD_PARTY";
export type BankAccountType = "CHECKING" | "SAVINGS";
export type BankVerificationStatus = "NOT_VERIFIED" | "VERIFIED" | "FAILED";

export const VERIFICATION_STATUS_LABELS: Record<BankVerificationStatus, string> = {
  NOT_VERIFIED: "Not verified",
  VERIFIED: "Verified",
  FAILED: "Verification failed",
};

export interface LeadBankInfo {
  routingNumber: string | null;
  bankName: string | null;
  bankPhone: string | null;
  bankAddress: string | null;
  accountOwner: BankAccountOwner | null;
  accountType: BankAccountType | null;
  // Account number and SSN are write-only - only their last 4 come back.
  accountNumberLast4: string | null;
  nameOnAccount: string | null;
  ssnLast4: string | null;
  dob: string | null;
  mothersMaidenName: string | null;
  enrolledWithSameBank: boolean | null;
  verificationStatus: BankVerificationStatus;
  verificationMessage: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface BankInfoInput {
  routingNumber: string;
  bankName: string;
  bankPhone: string | null;
  bankAddress: string;
  accountOwner: BankAccountOwner;
  accountType: BankAccountType;
  // Omit to keep the number already on file.
  accountNumber?: string;
  nameOnAccount: string | null;
  ssn?: string;
  dob: string | null;
  mothersMaidenName: string | null;
  enrolledWithSameBank: boolean;
}

export function fetchBankInfo(leadId: string): Promise<{ status: string; bankInfo: LeadBankInfo | null }> {
  return apiRequest(`/leads/${leadId}/bank-info`);
}

export function saveBankInfo(leadId: string, input: BankInfoInput): Promise<{ status: string; bankInfo: LeadBankInfo }> {
  return apiRequest(`/leads/${leadId}/bank-info`, { method: "PUT", body: JSON.stringify(input) });
}

export function verifyBankAccount(leadId: string): Promise<{ status: string; bankInfo: LeadBankInfo }> {
  return apiRequest(`/leads/${leadId}/bank-info/verify`, { method: "POST" });
}
