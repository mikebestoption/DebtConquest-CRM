import { apiRequest } from "./client";

export interface Role {
  id: number;
  name: string;
  description: string | null;
}

export function fetchRoles(): Promise<{ status: string; roles: Role[] }> {
  return apiRequest("/roles");
}
