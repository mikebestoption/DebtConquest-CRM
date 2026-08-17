import { apiRequest } from "./client";

export interface StaffOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  roles: string[];
}

export function fetchStaff(): Promise<{ status: string; staff: StaffOption[] }> {
  return apiRequest("/staff");
}
