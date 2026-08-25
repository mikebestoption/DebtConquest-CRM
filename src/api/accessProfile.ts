import { apiRequest } from "./client";
import type { AccessScope } from "./orgHierarchy";

export type { AccessScope };

// Access Preview (Add User step 3 / a User's Access tab) and the Access
// Profile detail screen's permission grid + Publish Changes button.

export interface AccessPreviewModule {
  module: string;
  granted: boolean;
  scopeLabel: string | null;
}

export interface AccessPreview {
  accessProfile: { code: string; version: number } | null;
  department: string;
  jobTitle: string;
  dataScopeLabel: string;
  inheritedFrom: string;
  modules: AccessPreviewModule[];
}

export function fetchAccessPreview(params: {
  departmentId: number;
  jobTitleId: number;
  orgUnitId?: number;
  teamId?: number;
  assignedOrgUnitIds?: number[];
}): Promise<{ status: string; preview: AccessPreview }> {
  const q = new URLSearchParams();
  q.set("departmentId", String(params.departmentId));
  q.set("jobTitleId", String(params.jobTitleId));
  if (params.orgUnitId) q.set("orgUnitId", String(params.orgUnitId));
  if (params.teamId) q.set("teamId", String(params.teamId));
  if (params.assignedOrgUnitIds?.length) q.set("assignedOrgUnitIds", params.assignedOrgUnitIds.join(","));
  return apiRequest(`/access-preview?${q.toString()}`);
}

export interface AccessProfileListItem {
  id: number;
  code: string;
  version: number;
  department: string;
  jobTitle: string;
  defaultScope: AccessScope;
}

export function fetchAccessProfiles(): Promise<{ status: string; profiles: AccessProfileListItem[] }> {
  return apiRequest("/access-profiles");
}

export interface AccessProfilePermissionRow {
  id: number;
  key: string;
  name: string;
  allowed: boolean;
  scope: AccessScope | null;
  status: "ACTIVE" | "RESTRICTED";
}

export interface AccessProfileModule {
  module: string;
  permissions: AccessProfilePermissionRow[];
}

export interface AccessProfileDetail extends AccessProfileListItem {
  modules: AccessProfileModule[];
}

export function fetchAccessProfile(id: number): Promise<{ status: string; profile: AccessProfileDetail }> {
  return apiRequest(`/access-profiles/${id}`);
}

export function patchAccessProfilePermission(
  profileId: number,
  permissionId: number,
  patch: { allowed?: boolean; scope?: AccessScope | null },
): Promise<{ status: string }> {
  return apiRequest(`/access-profiles/${profileId}/permissions/${permissionId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function publishAccessProfile(id: number, summary: string): Promise<{ status: string; profile: { version: number } }> {
  return apiRequest(`/access-profiles/${id}/publish`, { method: "POST", body: JSON.stringify({ summary }) });
}
