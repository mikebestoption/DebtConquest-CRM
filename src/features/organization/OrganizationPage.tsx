import { useEffect, useState } from "react";
import { fetchDepartments, fetchJobTitles, fetchOrgTree, type Department, type JobTitle, type OrgUnitNode } from "../../api/orgHierarchy";

const SCOPE_LABEL: Record<string, string> = {
  SELF: "Self",
  LIMITED_TEAM: "Limited Team",
  TEAM: "Team",
  ORG_UNIT: "Org Unit",
  ASSIGNED_ORG_UNITS: "Assigned Org Units",
  DEPARTMENT: "Department",
};

function OrgUnitTree({ node, depth = 0 }: { node: OrgUnitNode; depth?: number }) {
  return (
    <div style={{ marginLeft: depth * 16 }} className="border-l border-border pl-3">
      <p className="py-1 text-sm font-medium text-ink">{node.name}</p>
      {node.teams.length > 0 && (
        <ul className="mb-1 ml-3 list-disc space-y-0.5 text-xs text-muted">
          {node.teams.map((t) => (
            <li key={t.id}>
              {t.name} <span className="text-muted/70">(capacity {t.capacity})</span>
            </li>
          ))}
        </ul>
      )}
      {node.children.map((c) => (
        <OrgUnitTree key={c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

// Read-only this pass - same "assignable set is seeded, not agent-editable"
// reasoning as role.route.ts's Roles: Department/Job Title/Org Unit rows
// come from prisma/seedOrgAccess.ts. Team creation is the one editable
// piece, on the Teams page.
export function OrganizationPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [orgTree, setOrgTree] = useState<OrgUnitNode[]>([]);

  useEffect(() => {
    fetchDepartments().then((res) => {
      setDepartments(res.departments);
      if (res.departments.length) setSelectedId(res.departments[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    Promise.all([fetchJobTitles(selectedId), fetchOrgTree(selectedId)]).then(([jt, tree]) => {
      setJobTitles(jt.jobTitles);
      setOrgTree(tree.orgUnits);
    });
  }, [selectedId]);

  const department = departments.find((d) => d.id === selectedId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Organization</h1>
        <p className="mt-0.5 text-sm text-muted">One hierarchy engine for every department - the labels change, the structure underneath doesn't.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <div className="h-fit rounded-card border border-border bg-white p-2">
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                selectedId === d.id ? "bg-teal-50 text-teal" : "text-muted hover:bg-bg"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {department && (
          <div className="space-y-4">
            <div className="rounded-card border border-border bg-white p-5">
              <h3 className="mb-3 font-semibold text-ink">{department.name}</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">Executive Head</dt>
                  <dd className="font-medium text-ink">{department.executiveHeadTitle ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Reports To</dt>
                  <dd className="font-medium text-ink">{department.reportsToLabel ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Org Unit Tier</dt>
                  <dd className="font-medium text-ink">{department.orgUnitLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Child Tier</dt>
                  <dd className="font-medium text-ink">{department.orgUnitChildLabel ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-card border border-border bg-white p-5">
              <h3 className="mb-3 font-semibold text-ink">Job Title Ladder</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-muted">
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">Job Title</th>
                    <th className="py-2 pr-3">Default Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {jobTitles.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 text-muted">{t.level}</td>
                      <td className="py-2 pr-3 font-medium text-ink">{t.name}</td>
                      <td className="py-2 pr-3 text-muted">{SCOPE_LABEL[t.scope]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-card border border-border bg-white p-5">
              <h3 className="mb-3 font-semibold text-ink">Org Units &amp; Teams</h3>
              <div className="space-y-2">
                {orgTree.map((n) => (
                  <OrgUnitTree key={n.id} node={n} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
