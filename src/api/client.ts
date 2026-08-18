import { useAuthStore } from "../state/authStore";

// VITE_API_BASE_URL overrides this - set it for local dev (e.g.
// http://localhost:4000/v1/crm, bypassing the proxy) or any deployment
// whose origin isn't app.debtconquest.com itself. Unset, this falls back to
// the live backend's real domain rather than a relative path, since a bare
// path would silently resolve against whatever origin this app happens to
// be served from. See .env.example.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "https://app.debtconquest.com/api/v1/crm";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Thin fetch wrapper shared by every crm-frontend api/* module: attaches
// the staff JWT, parses the { status, message } error shape every CRM route
// returns, and logs the user out on a 401 (expired/invalid token) rather
// than leaving the app stuck retrying with a dead token.
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);
  // FormData bodies (avatar upload) need the browser to set its own
  // multipart boundary in Content-Type - setting it manually breaks the
  // request, so only default to JSON when there's an actual JSON body.
  // Body-less calls (submit-compliance, send-invite, ...) must NOT get this
  // header either - Fastify's JSON body parser rejects Content-Type:
  // application/json paired with an empty body (FST_ERR_CTP_EMPTY_JSON_BODY).
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, "Session expired - please log in again");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  if (res.headers.get("Content-Type")?.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }
  return res.json() as Promise<T>;
}
