import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { login } from "../../api/auth";
import { useAuthStore } from "../../state/authStore";
import { ApiError } from "../../api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const auth = await login(email, password);
      setAuth(auth);
      const from = (location.state as { from?: string } | null)?.from ?? "/worklist";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-deep px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-card bg-white p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-sm font-bold text-white">DC</div>
          <span className="text-base font-semibold text-ink">DebtConquest CRM</span>
        </div>

        <label className="mb-1 block text-sm font-medium text-ink">Email</label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
        />

        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-ink">Password</label>
          <Link to="/forgot-password" className="text-xs font-medium text-teal hover:underline">
            Forgot password?
          </Link>
        </div>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-5 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
        />

        {error && <p className="mb-4 text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-teal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-hover disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
