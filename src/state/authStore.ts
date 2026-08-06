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
  role: "ADMIN" | "MANAGER" | "AGENT";
}

export interface StoredAuth {
  token: string;
  staff: AuthStaff;
}

function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  staff: AuthStaff | null;
  setAuth: (auth: StoredAuth) => void;
  logout: () => void;
}

const initial = readStoredAuth();

export const useAuthStore = create<AuthState>((set) => ({
  token: initial?.token ?? null,
  staff: initial?.staff ?? null,
  setAuth: (auth) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    set({ token: auth.token, staff: auth.staff });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, staff: null });
  },
}));
