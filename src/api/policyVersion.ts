import { apiRequest } from "./client";

// Policy Versions page.

export interface PolicyVersionItem {
  id: number;
  version: number;
  department: string;
  jobTitle: string;
  summary: string;
  publishedAt: string;
  publishedBy: string;
  isCurrent: boolean;
}

export function fetchPolicyVersions(): Promise<{ status: string; versions: PolicyVersionItem[] }> {
  return apiRequest("/policy-versions");
}
