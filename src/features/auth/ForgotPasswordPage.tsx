import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../api/auth";
import { ApiError } from "../../api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      // Same confirmation regardless of whether the email matched an
      // account - server-side rule (see staffAuth.route.ts), kept
      // consistent here rather than branching on the response.
      setSent(true);
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

        {sent ? (
          <p className="text-sm text-ink">If that email has an account, we've sent a link to reset the password. Check your inbox.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-4 text-sm text-muted">Enter your email and we'll send you a link to reset your password.</p>
            <label className="mb-1 block text-sm font-medium text-ink">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-ring"
            />

            {error && <p className="mb-4 text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-teal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-hover disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send reset link"}
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
