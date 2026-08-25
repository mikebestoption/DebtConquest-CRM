import { useEffect, useState } from "react";
import { fetchPolicyVersions, type PolicyVersionItem } from "../../api/policyVersion";

export function PolicyVersionsPage() {
  const [versions, setVersions] = useState<PolicyVersionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicyVersions()
      .then((res) => setVersions(res.versions))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Policy Versions</h1>
        <p className="mt-0.5 text-sm text-muted">Every published permissions change, versioned and auditable.</p>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Access Profile</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Published By</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && versions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No policy versions published yet.
                  </td>
                </tr>
              )}
              {!loading &&
                versions.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">v{v.version}</td>
                    <td className="px-4 py-3 text-ink">
                      {v.department} — {v.jobTitle}
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(v.publishedAt).toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-3 text-muted">{v.publishedBy}</td>
                    <td className="px-4 py-3 text-muted">{v.summary}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${v.isCurrent ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {v.isCurrent ? "Current" : "Archived"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
