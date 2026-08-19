import { useEffect, useState } from "react";
import { fetchRoles, type Role } from "../../api/roles";
import { IconSearch, IconX } from "../layout/icons";
import { Checkbox, Select } from "../../components/controls";

interface RoleAssignModalProps {
  // Roles already assigned (or already staged in step 2 of Add User) - kept
  // checked and shown but not re-selectable as "new".
  excludeRoleIds: number[];
  onClose: () => void;
  onAssign: (roles: Role[]) => void;
}

export function RoleAssignModal({ excludeRoleIds, onClose, onAssign }: RoleAssignModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchRoles()
      .then((res) => setRoles(res.roles))
      .catch(() => setRoles([]));
  }, []);

  const available = roles.filter((r) => !excludeRoleIds.includes(r.id));
  const filtered = available.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">Assign New Role</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <IconX width={18} height={18} />
          </button>
        </div>

        <label className="mb-1 block text-sm text-ink">Subscriber</label>
        <div className="mb-4">
          <Select defaultValue="DebtConquest INC" disabled>
            <option>DebtConquest INC</option>
          </Select>
        </div>

        <label className="mb-1 block text-sm text-ink">Roles</label>
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Checkbox
              checked={selected.length > 0 && selected.length === filtered.length}
              onChange={(checked) => setSelected(checked ? filtered.map((r) => r.id) : [])}
            />
            <IconSearch width={14} height={14} className="text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles"
              className="flex-1 text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-3 text-sm text-muted">No roles found.</p>}
            {filtered.map((r) => (
              <div key={r.id} className="px-3 py-2 hover:bg-bg">
                <Checkbox checked={selected.includes(r.id)} onChange={() => toggle(r.id)} label={r.name} className="w-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-bg">
            Cancel
          </button>
          <button
            onClick={() => onAssign(roles.filter((r) => selected.includes(r.id)))}
            disabled={selected.length === 0}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
