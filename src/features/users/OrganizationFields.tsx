import { useEffect, useState } from "react";
import { Select, Checkbox } from "../../components/controls";
import type { Department, JobTitle, OrgUnitNode } from "../../api/orgHierarchy";

export interface OrgValue {
  orgUnitId?: number;
  teamId?: number;
  assignedOrgUnitIds: number[];
}

interface Props {
  department: Department;
  orgTree: OrgUnitNode[];
  jobTitle: JobTitle;
  value: OrgValue;
  onChange: (patch: Partial<OrgValue>) => void;
}

function findRootForOrgUnit(orgTree: OrgUnitNode[], orgUnitId: number): { root: OrgUnitNode; child?: OrgUnitNode } | undefined {
  for (const root of orgTree) {
    if (root.id === orgUnitId) return { root };
    const child = root.children.find((c) => c.id === orgUnitId);
    if (child) return { root, child };
  }
  return undefined;
}

function findRootForTeam(orgTree: OrgUnitNode[], teamId: number): { root: OrgUnitNode; child?: OrgUnitNode } | undefined {
  for (const root of orgTree) {
    if (root.teams.some((t) => t.id === teamId)) return { root };
    for (const child of root.children) {
      if (child.teams.some((t) => t.id === teamId)) return { root, child };
    }
  }
  return undefined;
}

// The Organization step's "the system already knows VP -> Conference ->
// Team" cascade - one component instead of a bespoke form per department,
// branching only on whether this department's tree has a second tier
// (Sales' Conference under VP Organization) and on which of
// usesTeam/usesOrgUnit/usesMultipleOrgUnits the selected Job Title carries
// (see prisma/seedOrgAccess.ts's DEPARTMENTS for what each title sets).
export function OrganizationFields({ department, orgTree, jobTitle, value, onChange }: Props) {
  const hasChildTier = !!department.orgUnitChildLabel;
  const located = value.teamId ? findRootForTeam(orgTree, value.teamId) : value.orgUnitId ? findRootForOrgUnit(orgTree, value.orgUnitId) : undefined;

  // Local, not derived-every-render from `value` - usesTeam departments
  // with a child tier need to remember "Conference Alpha was picked" while
  // the user is still choosing a Team, before orgUnitId/teamId have a
  // final value to derive that from.
  const [rootId, setRootId] = useState<number | undefined>(located?.root.id);
  const [childId, setChildId] = useState<number | undefined>(located?.child?.id);

  useEffect(() => {
    setRootId(located?.root.id);
    setChildId(located?.child?.id);
    // Deliberately only department/title, not `located` - re-deriving on
    // every value change would reset the child select mid-cascade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department.id, jobTitle.id]);

  const root = orgTree.find((r) => r.id === rootId);
  const childOptions = hasChildTier ? (root?.children ?? []) : [];
  const child = childOptions.find((c) => c.id === childId);
  const teamOptions = hasChildTier ? (child?.teams ?? []) : (root?.teams ?? []);

  if (!jobTitle.usesTeam && !jobTitle.usesOrgUnit && !jobTitle.usesMultipleOrgUnits) {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        <p className="rounded-md bg-bg px-3 py-2 text-sm text-muted">
          {jobTitle.name} oversees the entire {department.name} department — no narrower org assignment needed.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted">{department.orgUnitLabel}</label>
        <Select
          value={rootId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value) || undefined;
            setRootId(id);
            setChildId(undefined);
            if (jobTitle.usesMultipleOrgUnits) onChange({ orgUnitId: id, teamId: undefined, assignedOrgUnitIds: [] });
            else if (jobTitle.usesOrgUnit && !hasChildTier) onChange({ orgUnitId: id, teamId: undefined });
            else onChange({ orgUnitId: undefined, teamId: undefined });
          }}
        >
          <option value="">Select {department.orgUnitLabel}</option>
          {orgTree.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>

      {hasChildTier && rootId && !jobTitle.usesMultipleOrgUnits && (
        <div>
          <label className="mb-1 block text-xs text-muted">{department.orgUnitChildLabel}</label>
          <Select
            value={childId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value) || undefined;
              setChildId(id);
              if (jobTitle.usesOrgUnit) onChange({ orgUnitId: id, teamId: undefined });
              else onChange({ orgUnitId: undefined, teamId: undefined });
            }}
          >
            <option value="">Select {department.orgUnitChildLabel}</option>
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {jobTitle.usesMultipleOrgUnits && rootId && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">
            Assigned {department.orgUnitChildLabel ?? department.orgUnitLabel}s
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border bg-white px-3 py-2.5">
            {childOptions.length === 0 && (
              <span className="text-sm text-muted">
                No {department.orgUnitChildLabel}s under this {department.orgUnitLabel} yet.
              </span>
            )}
            {childOptions.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={value.assignedOrgUnitIds.includes(c.id)}
                onChange={(checked) => {
                  if (checked && value.assignedOrgUnitIds.length >= 4) return;
                  onChange({
                    assignedOrgUnitIds: checked ? [...value.assignedOrgUnitIds, c.id] : value.assignedOrgUnitIds.filter((x) => x !== c.id),
                  });
                }}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Maximum 4 {department.orgUnitChildLabel}s per {jobTitle.name}.
          </p>
        </div>
      )}

      {jobTitle.usesTeam && (!hasChildTier || childId) && (
        <div>
          <label className="mb-1 block text-xs text-muted">Team</label>
          <Select value={value.teamId ?? ""} onChange={(e) => onChange({ teamId: Number(e.target.value) || undefined, orgUnitId: undefined })}>
            <option value="">Select Team</option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">Team capacity is enforced automatically.</p>
        </div>
      )}
    </>
  );
}
