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

export function fetchMe(): Promise<{ status: string; staff: StoredAuth["staff"] }> {
  return apiRequest("/auth/me");
}

export interface UpdateMeInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export function updateMe(patch: UpdateMeInput): Promise<{ status: string; staff: StoredAuth["staff"] }> {
  return apiRequest("/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
}

// Already-authenticated password change (Profile > Reset Password) - no
// current-password field, matching the reference UI.
export function changePassword(newPassword: string): Promise<{ status: string }> {
  return apiRequest("/auth/change-password", { method: "POST", body: JSON.stringify({ newPassword }) });
}

export function uploadAvatar(file: File): Promise<{ status: string; staff: StoredAuth["staff"] }> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest("/auth/avatar", { method: "POST", body: form });
}
