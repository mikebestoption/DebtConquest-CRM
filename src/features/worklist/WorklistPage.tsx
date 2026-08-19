import { useCallback, useEffect, useState } from "react";
import {
  fetchWorklist,
  exportWorklist,
  updateLeadStatus,
  DEFAULT_WORKLIST_FILTERS,
  type SortBy,
  type SortDir,
  type WorklistFilters,
  type WorklistItem,
  type WorklistStatus,
} from "../../api/worklist";
import { fetchStaff, type StaffOption } from "../../api/staff";
import { FilterBar } from "./FilterBar";
import { WorklistTable } from "./WorklistTable";
import { Pagination } from "./Pagination";
import { AddLeadModal } from "./AddLeadModal";
import { IconPlus } from "../layout/icons";
import { Select } from "../../components/controls";

const PAGE_SIZE = 25;

export function WorklistPage() {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [assignedStaffId, setAssignedStaffId] = useState<string>("");
  const [filters, setFilters] = useState<WorklistFilters>(DEFAULT_WORKLIST_FILTERS);
  const [sortBy, setSortBy] = useState<SortBy>("lastActivityAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [activeTab, setActiveTab] = useState<"worklist" | "search">("worklist");

  useEffect(() => {
    fetchStaff()
      .then((res) => setStaff(res.staff))
      .catch(() => setStaff([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchWorklist({ ...filters, assignedStaffId: assignedStaffId || undefined, sortBy, sortDir, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [filters, assignedStaffId, sortBy, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSort(col: SortBy) {
    if (col === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleApplyFilters(next: WorklistFilters) {
    setFilters(next);
    setPage(1);
  }

  async function handleStatusChange(id: string, status: WorklistStatus) {
    // Optimistic update - the row's status badge flips immediately instead
    // of waiting on the round trip, then reconciles from the server.
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, crmStatus: status } : it)));
    try {
      await updateLeadStatus(id, status);
      load();
    } catch {
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Worklist</h1>
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">User</label>
            <Select
              fitContent
              value={assignedStaffId}
              onChange={(e) => {
                setAssignedStaffId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Users</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                </option>
              ))}
            </Select>
          </div>
          <button
            onClick={() => setShowAddLead(true)}
            className="mt-5 flex items-center gap-1.5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
          >
            <IconPlus width={16} height={16} /> Add New Lead
          </button>
        </div>
      </div>

      <div className="flex gap-6 border-b border-border">
        <button
          onClick={() => setActiveTab("worklist")}
          className={`border-b-2 pb-2 text-sm font-semibold ${activeTab === "worklist" ? "border-teal text-teal" : "border-transparent text-muted"}`}
        >
          Worklist
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`border-b-2 pb-2 text-sm font-semibold ${activeTab === "search" ? "border-teal text-teal" : "border-transparent text-muted"}`}
        >
          Search Prospect
        </button>
      </div>

      {activeTab === "search" ? (
        <div className="rounded-card border border-dashed border-border bg-white p-10 text-center text-sm text-muted">
          Search Prospect is coming soon.
        </div>
      ) : (
        <>
          <FilterBar onApply={handleApplyFilters} onExport={() => exportWorklist({ ...filters, assignedStaffId: assignedStaffId || undefined })} />

          <div className="overflow-hidden rounded-card border border-border bg-white">
            <WorklistTable items={items} loading={loading} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} onStatusChange={handleStatusChange} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </div>
        </>
      )}

      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onCreated={() => {
            setShowAddLead(false);
            load();
          }}
        />
      )}
    </div>
  );
}
