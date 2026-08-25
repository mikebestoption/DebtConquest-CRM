import { apiRequest } from "./client";

// "Request Temporary Exception" on Access Preview / a User's Access tab.

export interface TemporaryException {
  id: number;
  permission: { key: string; name: string; module: string };
  reason: string;
  approvedBy: string | null;
  expiresAt: string;
}

export function fetchTemporaryExceptions(userId: string): Promise<{ status: string; exceptions: TemporaryException[] }> {
  return apiRequest(`/users/${userId}/temporary-exceptions`);
}

export function createTemporaryException(
  userId: string,
  input: { permissionId: number; reason: string; approvedByStaffId?: string; expiresAt: string },
): Promise<{ status: string; exception: TemporaryException }> {
  return apiRequest(`/users/${userId}/temporary-exceptions`, { method: "POST", body: JSON.stringify(input) });
}

export function revokeTemporaryException(userId: string, exceptionId: number): Promise<{ status: string }> {
  return apiRequest(`/users/${userId}/temporary-exceptions/${exceptionId}`, { method: "DELETE" });
}
