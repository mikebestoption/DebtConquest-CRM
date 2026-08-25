import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAccessProfiles, type AccessProfileListItem } from "../../api/accessProfile";

const SCOPE_LABEL: Record<string, string> = {
  SELF: "Self",
  LIMITED_TEAM: "Limited Team",
  TEAM: "Team",
  ORG_UNIT: "Org Unit",
  ASSIGNED_ORG_UNITS: "Assigned Org Units",
  DEPARTMENT: "Department",
};

export function AccessProfilesPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<AccessProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccessProfiles()
      .then((res) => setProfiles(res.profiles))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Access Profiles</h1>
        <p className="mt-0.5 text-sm text-muted">One bundle of permissions per Department + Job Title. Users inherit these automatically.</p>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Access Profile</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Job Title</th>
                <th className="px-4 py-3">Default Scope</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3"></th>
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
              {!loading &&
                profiles.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{p.code}</td>
                    <td className="px-4 py-3 text-ink">{p.department}</td>
                    <td className="px-4 py-3 text-ink">{p.jobTitle}</td>
                    <td className="px-4 py-3 text-muted">{SCOPE_LABEL[p.defaultScope]}</td>
                    <td className="px-4 py-3 text-muted">v{p.version}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/manager/access/profiles/${p.id}`)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-bg"
                      >
                        Open
                      </button>
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
