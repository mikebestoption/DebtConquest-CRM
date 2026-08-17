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

export function forgotPassword(email: string): Promise<{ status: string; message: string }> {
  return apiRequest("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

// Backs both the invite ("set your password") and forgot-password links -
// same endpoint either way, see server staffAuth.route.ts. Signs the caller
// in immediately on success.
export function setPassword(token: string, password: string): Promise<StoredAuth> {
  return apiRequest<AuthResponse>("/auth/set-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  }).then((res) => ({ token: res.token, staff: res.staff }));
}
