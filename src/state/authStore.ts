import { create } from "zustand";

// Deliberately a different localStorage key from apps/client's "dc_auth" -
// these are different token kinds (staff vs customer) even though both
// apps could run in the same browser profile during local dev.
const STORAGE_KEY = "dc_crm_auth";

export interface AuthStaff {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roles: string[];
  serviceCompany: string | null;
  lastLoginAt: string | null;
  avatarUrl: string | null;
}

export interface StoredAuth {
  token: string;
  staff: AuthStaff;
}

// A cached login from before the AuthStaff shape last changed (e.g. the
// single-enum `role` field this replaced with `roles: string[]`, or any
// future field addition) would otherwise crash the first component that
// reads a now-missing field - discard anything that doesn't look like the
// current shape rather than trusting it blindly. GET /crm/auth/me refetches
// the real thing right after login anyway (see ProfilePage.tsx).
function isValidAuthStaff(v: unknown): v is AuthStaff {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === "string" && typeof s.email === "string" && Array.isArray(s.roles);
}

function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAuth;
    if (typeof parsed?.token !== "string" || !isValidAuthStaff(parsed.staff)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

interface AuthState {
  token: string | null;
  staff: AuthStaff | null;
  setAuth: (auth: StoredAuth) => void;
  updateStaff: (staff: AuthStaff) => void;
  logout: () => void;
}

const initial = readStoredAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initial?.token ?? null,
  staff: initial?.staff ?? null,
  setAuth: (auth) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    set({ token: auth.token, staff: auth.staff });
  },
  // Profile page edits/avatar uploads return a fresh staff object without
  // reissuing a token - keeps the cached copy (and localStorage) in sync
  // without forcing a re-login.
  updateStaff: (staff) => {
    const token = get().token;
    if (!token) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, staff }));
    set({ staff });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, staff: null });
  },
}));
