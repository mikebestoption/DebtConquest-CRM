import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers, resendInvite, updateUser, type ActiveFilter, type UserListItem } from "../../api/users";
import { fetchDepartments, type Department } from "../../api/orgHierarchy";
import { Pagination } from "../worklist/Pagination";
import { IconBan, IconMail, IconPencil, IconPlus } from "../layout/icons";
import { Checkbox, Select } from "../../components/controls";

const PAGE_SIZE = 25;

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString(undefined, { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_PILL: Record<UserListItem["employmentStatus"], string> = {
  ACTIVE: "bg-green-50 text-green-700",
  LEAVE: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-gray-100 text-gray-600",
};

export function UsersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [includeActive, setIncludeActive] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeFilter: ActiveFilter = includeActive && includeInactive ? "all" : includeActive ? "yes" : includeInactive ? "no" : "all";

  useEffect(() => {
    fetchDepartments().then((res) => setDepartments(res.departments));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchUsers({ search: search || undefined, active: activeFilter, departmentId: departmentId || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [search, activeFilter, departmentId, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleClear() {
    setSearch("");
    setIncludeActive(true);
    setIncludeInactive(true);
    setDepartmentId("");
    setPage(1);
  }

  async function handleDisable(user: UserListItem) {
    if (!confirm(`${user.isActive ? "Disable" : "Enable"} ${user.name}?`)) return;
    await updateUser(user.id, { isActive: !user.isActive });
    load();
  }

  const [resendingId, setResendingId] = useState<string | null>(null);
  async function handleResendInvite(user: UserListItem) {
    setResendingId(user.id);
    try {
      await resendInvite(user.id);
      alert(`Invite email sent to ${user.email}.`);
    } catch {
      alert("Failed to send invite email.");
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Users</h1>
          <p className="mt-0.5 text-sm text-muted">Access is inherited from Department + Job Title - there's no per-user permission list here.</p>
        </div>
        <button
          onClick={() => navigate("/manager/users/new")}
          className="flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
        >
          <IconPlus width={16} height={16} /> Add New User
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by Id or Name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-56 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
          />
          <Select
            fitContent
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value ? Number(e.target.value) : "");
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-3 text-sm text-ink">
            <span className="font-medium">Active</span>
            <Checkbox
              label="Yes"
              checked={includeActive}
              onChange={(v) => {
                setIncludeActive(v);
                setPage(1);
              }}
            />
            <Checkbox
              label="No"
              checked={includeInactive}
              onChange={(v) => {
                setIncludeInactive(v);
                setPage(1);
              }}
            />
          </div>
        </div>
        <button onClick={handleClear} className="rounded-md border border-teal px-3 py-2 text-sm font-medium text-teal hover:bg-bg">
          Clear
        </button>
      </div>

      <p className="text-sm font-medium text-ink">Total: {total}</p>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-270 text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Id</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Job Title</th>
                <th className="px-4 py-3">Team / Unit</th>
                <th className="px-4 py-3">Reports To</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted">
                    No users match these filters.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                    <td className="px-4 py-3 text-muted">{u.staffNumber}</td>
                    <td className="px-4 py-3">
                      <button className="font-medium text-ink hover:text-teal hover:underline" onClick={() => navigate(`/manager/users/${u.id}`)}>
                        {u.name}
                      </button>
                      <div className="text-xs text-teal">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink">{u.department ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{u.jobTitle ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{u.team ?? u.orgUnit ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{u.reportsTo ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[u.employmentStatus]}`}>{u.employmentStatus}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-muted">
                        <button title="Edit" className="rounded p-1 hover:bg-bg hover:text-ink" onClick={() => navigate(`/manager/users/${u.id}`)}>
                          <IconPencil width={14} height={14} />
                        </button>
                        <button
                          title="Resend invite email"
                          disabled={resendingId === u.id}
                          className="rounded p-1 hover:bg-bg hover:text-teal disabled:opacity-40"
                          onClick={() => handleResendInvite(u)}
                        >
                          <IconMail width={14} height={14} />
                        </button>
                        <button title={u.isActive ? "Disable" : "Enable"} className="rounded p-1 hover:bg-bg hover:text-error" onClick={() => handleDisable(u)}>
                          <IconBan width={14} height={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </div>
  );
}
