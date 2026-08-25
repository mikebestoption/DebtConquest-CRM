import { apiRequest } from "./client";

// Access Audit Log page.

export interface AccessAuditLogEntry {
  id: string;
  createdAt: string;
  eventType: "USER_CREATED" | "PROMOTION" | "TRANSFER" | "PERMISSION_CHANGE" | "POLICY_PUBLISH" | "TEMP_EXCEPTION_GRANTED" | "TEMP_EXCEPTION_REVOKED";
  subject: string;
  description: string;
  changedBy: string;
}

export function fetchAccessAuditLog(params: { search?: string; eventType?: string } = {}): Promise<{ status: string; entries: AccessAuditLogEntry[] }> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.eventType) q.set("eventType", params.eventType);
  const qs = q.toString();
  return apiRequest(`/access-audit-log${qs ? `?${qs}` : ""}`);
}
