import { apiRequest } from "./client";
import type { AccessPreview } from "./accessProfile";

export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "LEAVE";
export type EmploymentType = "EMPLOYEE" | "CONTRACTOR";
export type WorkLocation = "REMOTE" | "OFFICE" | "HYBRID";
export type ServiceCompany = "DEBTCONQUEST" | "MEJOR_ALIVIO";

// Every account today is DebtConquest - this only exists so the enum
// column reads as a name instead of a raw DEBTCONQUEST/MEJOR_ALIVIO
// wherever it's displayed (e.g. ProfilePage), not because there's a
// company picker anywhere any more.
export const SERVICE_COMPANY_LABEL: Record<ServiceCompany, string> = {
  DEBTCONQUEST: "DebtConquest, Inc.",
  MEJOR_ALIVIO: "Mejor Alivio",
};

export interface UserListItem {
  id: string;
  staffNumber: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
  employmentStatus: EmploymentStatus;
  department: string | null;
  jobTitle: string | null;
  orgUnit: string | null;
  team: string | null;
  reportsTo: string | null;
}

export interface UserSettings {
  newUserLeadRouting: boolean;
  includeInBouncingPool: boolean;
  getLeadDailyMax: number | null;
  leadDistributionDailyMax: number | null;
}

export interface UserDetail extends UserListItem {
  preferredName: string | null;
  timeZone: string | null;
  languagesSpoken: string | null;
  calendarLink: string | null;
  serviceCompany: ServiceCompany | null;
  employmentType: EmploymentType | null;
  workLocation: WorkLocation | null;
  hireDate: string | null;
  hasPassword: boolean;
  departmentId: number | null;
  jobTitleId: number | null;
  orgUnitId: number | null;
  teamId: number | null;
  reportsToStaffId: string | null;
  assignedOrgUnitIds: number[];
  assignedOrgUnitNames: string[];
  accessProfile: { code: string; version: number } | null;
  accessPreview: AccessPreview | null;
  settings: UserSettings;
  createdAt: string;
}

export type ActiveFilter = "yes" | "no" | "all";

export interface UserListQuery {
  search?: string;
  active?: ActiveFilter;
  departmentId?: number;
  page?: number;
  pageSize?: number;
}

interface UserListResponse {
  status: string;
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function toSearchParams(q: UserListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export function fetchUsers(query: UserListQuery): Promise<UserListResponse> {
  return apiRequest(`/users?${toSearchParams(query)}`);
}

export function fetchUser(id: string): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}`);
}

export function fetchUserAccessPreview(id: string): Promise<{ status: string; preview: AccessPreview | null }> {
  return apiRequest(`/users/${id}/access-preview`);
}

// Add User wizard's Step 1 (Basic + Employment) and Step 2 (Organization)
// fields, submitted together on Create - there is no separate roles step
// any more, see AddUserPage.
export interface CreateUserInput {
  firstName: string;
  lastName: string;
  preferredName?: string;
  phone: string;
  email: string;
  languagesSpoken?: string[];
  timeZone?: string;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
  workLocation?: WorkLocation;
  hireDate?: string;
  calendarLink?: string;
  serviceCompany?: ServiceCompany;
  departmentId: number;
  jobTitleId: number;
  orgUnitId?: number;
  teamId?: number;
  assignedOrgUnitIds?: number[];
  reportsToStaffId?: string;
}

export function createUser(input: CreateUserInput): Promise<{ status: string; user: UserDetail }> {
  return apiRequest("/users", { method: "POST", body: JSON.stringify(input) });
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  phone?: string | null;
  email?: string;
  languagesSpoken?: string[];
  timeZone?: string | null;
  isActive?: boolean;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType | null;
  workLocation?: WorkLocation | null;
  hireDate?: string | null;
  calendarLink?: string | null;
  serviceCompany?: ServiceCompany | null;
  departmentId?: number;
  jobTitleId?: number;
  orgUnitId?: number | null;
  teamId?: number | null;
  assignedOrgUnitIds?: number[];
  reportsToStaffId?: string | null;
}

export function updateUser(id: string, patch: UpdateUserInput): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function updateUserSettings(id: string, patch: Partial<UserSettings>): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}/settings`, { method: "PATCH", body: JSON.stringify(patch) });
}

// "Resend Invite" - covers the invite email bouncing/expiring/never having
// been sent (e.g. N8N_STAFF_EMAIL_WEBHOOK_URL was unset at creation time).
export function resendInvite(id: string): Promise<{ status: string }> {
  return apiRequest(`/users/${id}/send-invite`, { method: "POST" });
}
