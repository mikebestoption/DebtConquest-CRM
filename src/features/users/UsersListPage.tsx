import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers, resendInvite, updateUser, type ActiveFilter, type UserListItem } from "../../api/users";
import { Pagination } from "../worklist/Pagination";
import { IconBan, IconMail, IconPencil, IconPlus } from "../layout/icons";

const PAGE_SIZE = 25;

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString(undefined, { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function UsersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [includeActive, setIncludeActive] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const activeFilter: ActiveFilter = includeActive && includeInactive ? "all" : includeActive ? "yes" : includeInactive ? "no" : "all";

  const load = useCallback(() => {
    setLoading(true);
    fetchUsers({ search: search || undefined, active: activeFilter, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [search, activeFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleClear() {
    setSearch("");
    setIncludeActive(true);
    setIncludeInactive(true);
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
        <h1 className="text-2xl font-bold text-ink">Users</h1>
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
          <div className="flex items-center gap-3 text-sm text-ink">
            <span className="font-medium">Active</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-teal"
                checked={includeActive}
                onChange={(e) => {
                  setIncludeActive(e.target.checked);
                  setPage(1);
                }}
              />
              Yes
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="accent-teal"
                checked={includeInactive}
                onChange={(e) => {
                  setIncludeInactive(e.target.checked);
                  setPage(1);
                }}
              />
              No
            </label>
          </div>
        </div>
        <button onClick={handleClear} className="rounded-md border border-teal px-3 py-2 text-sm font-medium text-teal hover:bg-bg">
          Clear
        </button>
      </div>

      <p className="text-sm font-medium text-ink">Total: {total}</p>

      <div className="overflow-hidden rounded-card border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">Id</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
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
                    </td>
                    <td className="px-4 py-3 text-muted">{u.roles.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-teal">{u.email}</td>
                    <td className="px-4 py-3 text-teal">{u.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${u.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {u.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
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
