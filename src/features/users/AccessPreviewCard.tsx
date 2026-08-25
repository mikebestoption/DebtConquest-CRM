import type { AccessPreview } from "../../api/accessProfile";

// Shared between Add User's Access Preview step and a User Detail's Access
// tab - "the administrator isn't choosing permissions, DebtConquest tells
// them" rendered the same way in both places.
export function AccessPreviewCard({ preview, loading }: { preview: AccessPreview | null; loading?: boolean }) {
  if (loading) return <p className="text-sm text-muted">Loading access preview…</p>;
  if (!preview) return <p className="text-sm text-muted">Select a Department and Job Title to see the access this grants.</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="Department" value={preview.department} />
        <SummaryBox label="Job Title" value={preview.jobTitle} />
        <SummaryBox label="Access Profile" value={preview.accessProfile?.code ?? "—"} mono />
        <SummaryBox label="Data Scope" value={preview.dataScopeLabel} />
      </div>

      <div className="rounded-card border border-border bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink">Access Automatically Assigned</h3>
            <p className="text-xs text-muted">{preview.inheritedFrom}</p>
          </div>
          <span className="rounded px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700">
            v{preview.accessProfile?.version ?? "—"}
          </span>
        </div>

        <div className="divide-y divide-border">
          {preview.modules.map((m) => (
            <div key={m.module} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium text-ink">{m.module}</span>
              {m.granted ? (
                <span className="rounded px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700">{m.scopeLabel}</span>
              ) : (
                <span className="rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600">No Access</span>
              )}
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted">Permissions are managed centrally in Access Management, not per user.</p>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-bg/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-bold text-ink ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</p>
    </div>
  );
}
