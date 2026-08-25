import { apiRequest } from "./client";

// Permission Catalog page.

export interface PermissionCatalogItem {
  id: number;
  module: string;
  key: string;
  name: string;
  description: string | null;
  addedInVersion: string | null;
  profilesUsing: number;
  status: "ACTIVE" | "RESTRICTED" | "UNASSIGNED";
}

export function fetchPermissions(params: { module?: string; search?: string } = {}): Promise<{ status: string; permissions: PermissionCatalogItem[] }> {
  const q = new URLSearchParams();
  if (params.module) q.set("module", params.module);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return apiRequest(`/permissions${qs ? `?${qs}` : ""}`);
}

export function registerPermission(input: { module: string; key: string; name: string; description?: string }): Promise<{ status: string; permission: PermissionCatalogItem }> {
  return apiRequest("/permissions", { method: "POST", body: JSON.stringify(input) });
}
