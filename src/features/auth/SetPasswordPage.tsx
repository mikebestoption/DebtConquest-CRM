import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { setPassword } from "../../api/auth";
import { useAuthStore } from "../../state/authStore";
import { ApiError } from "../../api/client";

// Backs both /set-password (invite link) and /reset-password (forgot-
// password link) - same action server-side, see api/auth.ts's setPassword.
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Mirrors server staffAuth.route.ts's strongPasswordSchema - same 4
    // requirements shown on the Profile page's Reset Password tab.
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Password must include at least 1 uppercase letter, 1 lowercase letter, and 1 special character.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const auth = await setPassword(token, password);
      setAuth(auth);
      navigate("/worklist", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-sm font-bold text-white">DC</div>
          <span className="text-base font-semibold text-ink">DebtConquest CRM</span>
        </div>

        {!token ? (
          <p className="text-sm text-error">This link is missing its token - check the URL, or request a new one.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="mb-1 block text-sm font-medium text-ink">New password</label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
            />

            <label className="mb-1 block text-sm font-medium text-ink">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mb-3 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
            />

            <ul className="mb-5 list-disc space-y-0.5 pl-5 text-xs text-muted">
              <li>Minimum 12 characters</li>
              <li>At least 1 uppercase letters</li>
              <li>At least 1 lowercase letters</li>
              <li>At least 1 special characters</li>
            </ul>

            {error && <p className="mb-4 text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-teal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-hover disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Set password"}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-5 block text-center text-sm font-medium text-teal hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
