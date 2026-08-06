import { apiRequest } from "./client";

export interface StaffOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: "ADMIN" | "MANAGER" | "AGENT";
}

export function fetchStaff(): Promise<{ status: string; staff: StaffOption[] }> {
  return apiRequest("/staff");
}
