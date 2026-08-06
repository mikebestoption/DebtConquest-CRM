import { apiRequest } from "./client";

// Mirrors server/prisma/schema.prisma's enums - kept in sync by hand since
// this app doesn't share a types package with the server (see
// server/src/routes/crm/worklist.route.ts for the source of truth).
export const WORKLIST_STATUSES = [
  "NEW",
  "ATTEMPTED_CONTACT",
  "CONTACTED",
  "QUALIFIED",
  "NOT_QUALIFIED",
  "FOLLOW_UP",
  "ENROLLED",
  "NOT_INTERESTED",
  "DO_NOT_CONTACT",
  "DUPLICATE",
  "BAD_NUMBER",
  "CLOSED_LOST",
  "CLOSED_WON",
] as const;
export type WorklistStatus = (typeof WORKLIST_STATUSES)[number];

export const LEAD_PROGRAMS = ["ELEVATE_FSP", "CFLN_FSP"] as const;
export type LeadProgram = (typeof LEAD_PROGRAMS)[number];

export const LEAD_SOURCES = ["WEB", "DEBTCONQUEST", "MEJOR_ALIVIO", "OTHER"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const STATUS_LABELS: Record<WorklistStatus, string> = {
  NEW: "New",
  ATTEMPTED_CONTACT: "Attempted Contact",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not Qualified",
  FOLLOW_UP: "Follow Up",
  ENROLLED: "Enrolled",
  NOT_INTERESTED: "Not Interested",
  DO_NOT_CONTACT: "Do Not Contact",
  DUPLICATE: "Duplicate",
  BAD_NUMBER: "Bad Number",
  CLOSED_LOST: "Closed Lost",
  CLOSED_WON: "Closed Won",
};

export const PROGRAM_LABELS: Record<LeadProgram, string> = {
  ELEVATE_FSP: "Elevate_FSP",
  CFLN_FSP: "CFLN_FSP",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  WEB: "Web",
  DEBTCONQUEST: "DebtConquest",
  MEJOR_ALIVIO: "Mejor Alivio",
  OTHER: "Other",
};

export interface WorklistItem {
  id: string;
  leadNumber: number;
  firstName: string | null;
  lastName: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  state: string | null;
  crmStatus: WorklistStatus;
  program: LeadProgram | null;
  source: LeadSource | null;
  enrolled: boolean;
  creditPulled: boolean;
  creditPulledDate: string | null;
  assignedStaff: { id: string; name: string } | null;
  lastActivityAt: string;
  createdAt: string;
  leadAgeDays: number;
}

export type SortBy = "leadNumber" | "name" | "lastActivityAt" | "createdAt" | "crmStatus" | "source" | "state";
export type SortDir = "asc" | "desc";
export type YesNoAll = "yes" | "no" | "all";

export interface WorklistFilters {
  search?: string;
  dateCreatedFrom?: string;
  dateCreatedTo?: string;
  lastActivityFrom?: string;
  lastActivityTo?: string;
  creditPulledDateFrom?: string;
  creditPulledDateTo?: string;
  status?: WorklistStatus[];
  program?: LeadProgram[];
  source?: LeadSource[];
  enrolled?: YesNoAll;
  creditPulled?: YesNoAll;
  assignedStaffId?: string;
}

export const DEFAULT_WORKLIST_FILTERS: WorklistFilters = {
  status: [...WORKLIST_STATUSES],
  program: [],
  source: [],
  enrolled: "all",
  creditPulled: "all",
};

export interface WorklistQuery extends WorklistFilters {
  sortBy?: SortBy;
  sortDir?: SortDir;
  page?: number;
  pageSize?: number;
}

interface WorklistResponse {
  status: string;
  items: WorklistItem[];
  total: number;
  page: number;
  pageSize: number;
}

function toSearchParams(q: WorklistQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params.toString();
}

export function fetchWorklist(query: WorklistQuery): Promise<WorklistResponse> {
  return apiRequest<WorklistResponse>(`/worklist?${toSearchParams(query)}`);
}

export async function exportWorklist(filters: WorklistFilters): Promise<void> {
  const csv = await apiRequest<string>(`/worklist/export?${toSearchParams(filters)}`);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `worklist-export-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function updateLeadStatus(id: string, status: WorklistStatus): Promise<{ status: string; lead: WorklistItem }> {
  return apiRequest(`/leads/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  state?: string;
  program?: LeadProgram;
  source?: LeadSource;
  assignedStaffId?: string;
}

export function createLead(input: CreateLeadInput): Promise<{ status: string; lead: WorklistItem }> {
  return apiRequest("/leads", { method: "POST", body: JSON.stringify(input) });
}
