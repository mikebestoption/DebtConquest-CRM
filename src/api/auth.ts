import { apiRequest } from "./client";
import type { StoredAuth } from "../state/authStore";

interface AuthResponse {
  status: string;
  token: string;
  staff: StoredAuth["staff"];
}

export function login(email: string, password: string): Promise<StoredAuth> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then((res) => ({ token: res.token, staff: res.staff }));
}
