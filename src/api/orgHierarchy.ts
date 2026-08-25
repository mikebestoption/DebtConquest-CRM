import { apiRequest } from "./client";

// Department + Job Title -> Access Profile engine's read side - backs the
// Add User wizard's Organization step, the read-only Organization admin
// page, and the Teams page. See the server's orgHierarchy.route.ts.

export interface Department {
  id: number;
  key: string;
  name: string;
  orgUnitLabel: string;
  orgUnitChildLabel: string | null;
  executiveHeadTitle: string | null;
  reportsToLabel: string | null;
  isActive: boolean;
  sortOrder: number;
}

export type AccessScope = "SELF" | "LIMITED_TEAM" | "TEAM" | "ORG_UNIT" | "ASSIGNED_ORG_UNITS" | "DEPARTMENT";

export interface JobTitle {
  id: number;
  departmentId: number;
  name: string;
  level: number;
  scope: AccessScope;
  usesTeam: boolean;
  usesOrgUnit: boolean;
  usesMultipleOrgUnits: boolean;
}

export interface OrgUnitTeam {
  id: number;
  name: string;
  capacity: number;
}

export interface OrgUnitNode {
  id: number;
  departmentId: number;
  parentId: number | null;
  type: string;
  name: string;
  teams: OrgUnitTeam[];
  children: OrgUnitNode[];
}

export interface EligibleManager {
  id: string;
  name: string;
  title: string;
}

export function fetchDepartments(): Promise<{ status: string; departments: Department[] }> {
  return apiRequest("/departments");
}

export function fetchJobTitles(departmentId: number): Promise<{ status: string; jobTitles: JobTitle[] }> {
  return apiRequest(`/departments/${departmentId}/job-titles`);
}

export function fetchOrgTree(departmentId: number): Promise<{ status: string; orgUnits: OrgUnitNode[] }> {
  return apiRequest(`/departments/${departmentId}/org-tree`);
}

export function fetchEligibleManagers(params: { departmentId: number; jobTitleId: number; orgUnitId?: number; teamId?: number }): Promise<{ status: string; managers: EligibleManager[] }> {
  const q = new URLSearchParams();
  q.set("departmentId", String(params.departmentId));
  q.set("jobTitleId", String(params.jobTitleId));
  if (params.orgUnitId) q.set("orgUnitId", String(params.orgUnitId));
  if (params.teamId) q.set("teamId", String(params.teamId));
  return apiRequest(`/staff/eligible-managers?${q.toString()}`);
}

export interface TeamListItem {
  id: number;
  name: string;
  capacity: number;
  orgUnit: { name: string; departmentId: number };
  staff: { id: string; firstName: string | null; lastName: string | null; jobTitleId: number | null }[];
}

export function fetchTeams(departmentId?: number): Promise<{ status: string; teams: TeamListItem[] }> {
  return apiRequest(`/teams${departmentId ? `?departmentId=${departmentId}` : ""}`);
}

export function createTeam(input: { orgUnitId: number; name: string; capacity?: number }): Promise<{ status: string; team: TeamListItem }> {
  return apiRequest("/teams", { method: "POST", body: JSON.stringify(input) });
}
