import { SOURCE_LABELS, type SortBy, type SortDir, type WorklistItem, type WorklistStatus } from "../../api/worklist";
import { StatusBadge } from "./StatusBadge";
import { StatusQuickChangeMenu } from "./StatusQuickChangeMenu";
import { IconChevronUpDown, IconLink } from "../layout/icons";

interface Column {
  key: SortBy;
  label: string;
}

const COLUMNS: Column[] = [
  { key: "leadNumber", label: "Id" },
  { key: "name", label: "Name" },
  { key: "lastActivityAt", label: "Last Activity" },
  { key: "createdAt", label: "Date Created" },
];

interface WorklistTableProps {
  items: WorklistItem[];
  loading: boolean;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (col: SortBy) => void;
  onStatusChange: (id: string, status: WorklistStatus) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WorklistTable({ items, loading, sortBy, sortDir, onSort, onStatusChange }: WorklistTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-semibold text-muted">
            <th className="px-4 py-3">Actions</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-4 py-3">
                <button className="flex items-center gap-1 hover:text-ink" onClick={() => onSort(col.key)}>
                  {col.label}
                  <IconChevronUpDown className={sortBy === col.key ? "text-orange" : "text-gray-300"} />
                  {sortBy === col.key && <span className="text-[10px] text-orange">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
            ))}
            <th className="px-4 py-3">Lead Age</th>
            <th className="px-4 py-3">
              <button className="flex items-center gap-1 hover:text-ink" onClick={() => onSort("crmStatus")}>
                Status <IconChevronUpDown className={sortBy === "crmStatus" ? "text-orange" : "text-gray-300"} />
              </button>
            </th>
            <th className="px-4 py-3">
              <button className="flex items-center gap-1 hover:text-ink" onClick={() => onSort("source")}>
                Source <IconChevronUpDown className={sortBy === "source" ? "text-orange" : "text-gray-300"} />
              </button>
            </th>
            <th className="px-4 py-3">Cell Phone Number</th>
            <th className="px-4 py-3">
              <button className="flex items-center gap-1 hover:text-ink" onClick={() => onSort("state")}>
                State <IconChevronUpDown className={sortBy === "state" ? "text-orange" : "text-gray-300"} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted">
                Loading…
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted">
                No leads match these filters.
              </td>
            </tr>
          )}
          {!loading &&
            items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-muted">
                    <button title="View lead" className="rounded p-1 hover:bg-bg hover:text-ink">
                      <IconLink width={14} height={14} />
                    </button>
                    <StatusQuickChangeMenu current={item.crmStatus} onChange={(status) => onStatusChange(item.id, status)} />
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-ink">{item.leadNumber}</td>
                <td className="px-4 py-3 text-ink">{item.name}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(item.lastActivityAt)}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(item.createdAt)}</td>
                <td className="px-4 py-3 text-muted">{item.leadAgeDays}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.crmStatus} />
                </td>
                <td className="px-4 py-3 text-muted">{item.source ? SOURCE_LABELS[item.source] : "—"}</td>
                <td className="px-4 py-3 text-ink">{item.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{item.state ?? "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
