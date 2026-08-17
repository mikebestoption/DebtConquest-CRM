import { apiRequest } from "./client";

export interface UserListItem {
  id: string;
  staffNumber: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  email: string;
  phone: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
}

export interface UserRoleAssignment {
  roleId: number;
  name: string;
  description: string | null;
}

export interface UserSettings {
  newUserLeadRouting: boolean;
  includeInBouncingPool: boolean;
  getLeadDailyMax: number | null;
  leadDistributionDailyMax: number | null;
}

export interface UserDetail extends UserListItem {
  languagesSpoken: string | null;
  calendarLink: string | null;
  jobTitle: string | null;
  serviceCompany: string | null;
  hasPassword: boolean;
  roleAssignments: UserRoleAssignment[];
  settings: UserSettings;
  createdAt: string;
}

export type ActiveFilter = "yes" | "no" | "all";

export interface UserListQuery {
  search?: string;
  active?: ActiveFilter;
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

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  languagesSpoken?: string;
  calendarLink?: string;
  jobTitle?: string;
  serviceCompany?: string;
  roleIds?: number[];
}

export function createUser(input: CreateUserInput): Promise<{ status: string; user: UserDetail }> {
  return apiRequest("/users", { method: "POST", body: JSON.stringify(input) });
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string;
  languagesSpoken?: string | null;
  calendarLink?: string | null;
  jobTitle?: string | null;
  serviceCompany?: string | null;
  isActive?: boolean;
}

export function updateUser(id: string, patch: UpdateUserInput): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function updateUserSettings(id: string, patch: Partial<UserSettings>): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}/settings`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function assignRoles(id: string, roleIds: number[]): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}/roles`, { method: "POST", body: JSON.stringify({ roleIds }) });
}

export function unassignRole(id: string, roleId: number): Promise<{ status: string; user: UserDetail }> {
  return apiRequest(`/users/${id}/roles/${roleId}`, { method: "DELETE" });
}

// "Resend Invite" - covers the invite email bouncing/expiring/never having
// been sent (e.g. N8N_STAFF_EMAIL_WEBHOOK_URL was unset at creation time).
export function resendInvite(id: string): Promise<{ status: string }> {
  return apiRequest(`/users/${id}/send-invite`, { method: "POST" });
}
