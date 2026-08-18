import { apiRequest } from "./client";
import type { LeadProgram, WorklistStatus } from "./worklist";

export interface SourceDefinition {
  id: number;
  name: string;
  listId: string | null;
  externalId: string | null;
  description: string | null;
  defaultProgram: LeadProgram | null;
  defaultPostStatus: WorklistStatus | null;
  allowToEnrol: boolean;
  isActive: boolean;
  visibleToRoleIds: number[];
  companyName: string | null;
}

export type ActiveFilter = "yes" | "no" | "all";

export interface SourceListQuery {
  search?: string;
  active?: ActiveFilter;
  page?: number;
  pageSize?: number;
}

interface SourceListResponse {
  status: string;
  items: SourceDefinition[];
  total: number;
  page: number;
  pageSize: number;
}

function toSearchParams(q: SourceListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export function fetchSources(query: SourceListQuery): Promise<SourceListResponse> {
  return apiRequest(`/sources?${toSearchParams(query)}`);
}

export function fetchSource(id: number): Promise<{ status: string; source: SourceDefinition }> {
  return apiRequest(`/sources/${id}`);
}

export interface SourceInput {
  name: string;
  listId?: string | null;
  externalId?: string | null;
  description?: string | null;
  defaultProgram: LeadProgram;
  defaultPostStatus: WorklistStatus;
  allowToEnrol?: boolean;
  isActive?: boolean;
  visibleToRoleIds?: number[];
  companyName?: string;
}

export function createSource(input: SourceInput): Promise<{ status: string; source: SourceDefinition }> {
  return apiRequest("/sources", { method: "POST", body: JSON.stringify(input) });
}

export function updateSource(id: number, patch: Partial<SourceInput>): Promise<{ status: string; source: SourceDefinition }> {
  return apiRequest(`/sources/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
