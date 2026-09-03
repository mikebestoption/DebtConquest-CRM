import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CREDIT_BUREAU_LABELS,
  CREDIT_PULL_AGENCY_LABELS,
  DEBT_TYPE_OPTIONS,
  bulkDeleteCreditors,
  bulkUpdateCreditors,
  deleteCreditor,
  fetchCreditors,
  updateCreditPullSettings,
  type CreditBureau,
  type CreditPullAgency,
  type Creditor,
  type CreditorListResponse,
} from "../../api/creditor";
import { ApiError } from "../../api/client";
import { Checkbox, Radio, Select } from "../../components/controls";
import { IconAlertTriangle, IconChevronLeft, IconChevronUpDown, IconCloud, IconInfo, IconPencil, IconPlus, IconTrash, IconX } from "../layout/icons";
import { CreditorModal } from "./CreditorModal";

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 1 });
const AGENCIES: CreditPullAgency[] = ["SPINWHEEL", "XACTUS"];
const BUREAUS: CreditBureau[] = ["EQUIFAX", "EXPERIAN"];
const PAGE_SIZES = [10, 25, 50, 100];

type SortKey = "creditorName" | "balance" | "accountNo" | "includeOnProgram" | "dateOpened" | "debtType" | "monthlyPayment" | "apr" | "creditorLimit" | "utilization" | "bureau" | "responsibility" | "lastPaymentDate";

interface Column {
  key: SortKey;
  label: string;
}

const COLUMNS: Column[] = [
  { key: "creditorName", label: "Creditor Name" },
  { key: "balance", label: "Balance" },
  { key: "accountNo", label: "Account No." },
  { key: "includeOnProgram", label: "Include On Program" },
  { key: "dateOpened", label: "Date Opened" },
  { key: "debtType", label: "Debt Type" },
  { key: "monthlyPayment", label: "Monthly Payment" },
  { key: "apr", label: "APR" },
  { key: "creditorLimit", label: "Credit Limit" },
  { key: "utilization", label: "Utilization" },
  { key: "bureau", label: "Bureau" },
  { key: "responsibility", label: "Responsibility" },
  { key: "lastPaymentDate", label: "Last Payment Date" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function sortValue(c: Creditor, key: SortKey): string | number {
  const v = c[key as keyof Creditor];
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? 1 : 0;
  return v as string | number;
}

export function CreditorTab({ leadId, onOpenAdditionalInfo }: { leadId: string; onOpenAdditionalInfo?: () => void }) {
  const [data, setData] = useState<CreditorListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Creditor | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    try {
      const res = await fetchCreditors(leadId);
      setData(res);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load creditors");
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAgencyChange(agency: CreditPullAgency) {
    const res = await updateCreditPullSettings(leadId, { creditPullAgency: agency });
    setData((d) => (d ? { ...d, creditPullAgency: res.creditPullAgency, creditPullBureau: res.creditPullBureau } : d));
  }

  async function handleBureauChange(bureau: CreditBureau) {
    const res = await updateCreditPullSettings(leadId, { creditPullBureau: bureau });
    setData((d) => (d ? { ...d, creditPullBureau: res.creditPullBureau } : d));
  }

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[], allSelected: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this creditor?")) return;
    await deleteCreditor(id);
    await load();
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected creditor(s)?`)) return;
    await bulkDeleteCreditors(leadId, [...selected]);
    await load();
  }

  const sortedCreditors = useMemo(() => {
    const list = data?.creditors ?? [];
    if (!sortBy) return list;
    const copy = [...list];
    copy.sort((a, b) => {
      const av = sortValue(a, sortBy);
      const bv = sortValue(b, sortBy);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortBy, sortDir]);

  const total = sortedCreditors.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sortedCreditors.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageIds = pageItems.map((c) => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">1</span>
            <span className="font-semibold text-ink">Creditor Agency:</span>
            <div className="flex flex-wrap gap-4">
              {AGENCIES.map((a) => (
                <Radio key={a} name="creditPullAgency" checked={data.creditPullAgency === a} onChange={() => handleAgencyChange(a)} label={CREDIT_PULL_AGENCY_LABELS[a]} />
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover"
          >
            <IconPlus width={16} height={16} /> Add New Creditor
          </button>
        </div>

        {data.creditPullAgency === "XACTUS" && (
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">2</span>
            <span className="font-semibold text-ink">Bureau:</span>
            <Select fitContent value={data.creditPullBureau ?? ""} onChange={(e) => handleBureauChange(e.target.value as CreditBureau)}>
              <option value="">—</option>
              {BUREAUS.map((b) => (
                <option key={b} value={b}>
                  {CREDIT_BUREAU_LABELS[b]}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            disabled
            title="Credit pull integration not yet connected - coming soon"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-teal opacity-60 cursor-not-allowed"
          >
            <IconCloud width={15} height={15} /> Applicant Pull
          </button>
          <span className="flex items-center gap-1.5 text-sm text-muted">
            Last Pull Date {data.lastPullDate ? formatDate(data.lastPullDate) : <IconAlertTriangle width={15} height={15} className="text-amber-500" />}
          </span>
        </div>
      </div>

      <div className="rounded-card border border-border bg-white">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal text-white">$</div>
          <span className="font-semibold text-ink">Creditor Details</span>
          <IconInfo width={15} height={15} className="text-muted" />
          {onOpenAdditionalInfo && (
            <button
              onClick={onOpenAdditionalInfo}
              className="ml-auto rounded-md border border-teal px-4 py-1.5 text-sm font-semibold text-teal hover:bg-teal hover:text-white"
            >
              Additional Info
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm text-ink">Total: {total}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={selected.size === 0}
              onClick={() => setBulkOpen(true)}
              className="rounded-md border border-teal px-4 py-1.5 text-sm font-semibold text-teal disabled:cursor-not-allowed disabled:border-border disabled:text-muted"
            >
              Bulk Update
            </button>
            <button
              disabled={selected.size === 0}
              onClick={handleBulkDelete}
              className="rounded-md border border-error px-4 py-1.5 text-sm font-semibold text-error disabled:cursor-not-allowed disabled:border-border disabled:text-muted"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead>
              <tr className="border-y border-border text-xs font-semibold text-muted">
                <th className="px-4 py-3">
                  <Checkbox checked={allPageSelected} onChange={() => toggleSelectAll(pageIds, allPageSelected)} />
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-4 py-3">
                    <button className="flex items-center gap-1 hover:text-ink" onClick={() => handleSort(col.key)}>
                      {col.label}
                      <IconChevronUpDown className={sortBy === col.key ? "text-teal" : "text-gray-300"} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3">Credit Report Item</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 3} className="px-4 py-10 text-center text-muted">
                    No data found
                  </td>
                </tr>
              )}
              {pageItems.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{c.creditorName}</td>
                  <td className="px-4 py-3 text-ink">{CURRENCY.format(c.balance)}</td>
                  <td className="px-4 py-3 text-muted">{c.accountNo ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.includeOnProgram ? "bg-teal/10 text-teal" : "bg-gray-100 text-gray-500"}`}>
                      {c.includeOnProgram ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.dateOpened)}</td>
                  <td className="px-4 py-3 text-muted">{c.debtType ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">{CURRENCY.format(c.monthlyPayment)}</td>
                  <td className="px-4 py-3 text-muted">{c.apr ? `${c.apr}%` : "—"}</td>
                  <td className="px-4 py-3 text-muted">{CURRENCY.format(c.creditorLimit)}</td>
                  <td className="px-4 py-3 text-muted">{c.utilization != null ? PERCENT.format(c.utilization) : "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.bureau ? CREDIT_BUREAU_LABELS[c.bureau] : "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.responsibility ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.lastPaymentDate)}</td>
                  <td className="px-4 py-3 text-muted">{c.creditReportItem ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-muted">
                      <button
                        title="Edit"
                        className="rounded p-1 hover:bg-bg hover:text-ink"
                        onClick={() => {
                          setEditing(c);
                          setModalOpen(true);
                        }}
                      >
                        <IconPencil width={15} height={15} />
                      </button>
                      <button title="Delete" className="rounded p-1 hover:bg-bg hover:text-error" onClick={() => handleDelete(c.id)}>
                        <IconTrash width={15} height={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
          <span>
            {total === 0 ? "Showing 0 to 0 of 0 entries" : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(total, currentPage * pageSize)} of ${total} entries`}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={currentPage <= 1} onClick={() => setPage(1)} className="rounded-md border border-border p-1.5 disabled:opacity-40" aria-label="First page">
              <IconChevronLeft width={14} height={14} />
              <IconChevronLeft width={14} height={14} className="-ml-2.5" />
            </button>
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border p-1.5 disabled:opacity-40" aria-label="Previous page">
              <IconChevronLeft width={14} height={14} />
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
              aria-label="Next page"
            >
              <IconChevronLeft width={14} height={14} className="rotate-180" />
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
              aria-label="Last page"
            >
              <IconChevronLeft width={14} height={14} className="rotate-180" />
              <IconChevronLeft width={14} height={14} className="-ml-2.5 rotate-180" />
            </button>
            <Select
              fitContent
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {modalOpen && (
        <CreditorModal
          leadId={leadId}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}

      {bulkOpen && (
        <BulkUpdateModal
          leadId={leadId}
          count={selected.size}
          ids={[...selected]}
          onClose={() => setBulkOpen(false)}
          onSaved={() => {
            setBulkOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function BulkUpdateModal({
  leadId,
  ids,
  count,
  onClose,
  onSaved,
}: {
  leadId: string;
  ids: string[];
  count: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [includeOnProgram, setIncludeOnProgram] = useState<"unchanged" | "yes" | "no">("unchanged");
  const [debtType, setDebtType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const patch: { includeOnProgram?: boolean; debtType?: string | null } = {};
    if (includeOnProgram !== "unchanged") patch.includeOnProgram = includeOnProgram === "yes";
    if (debtType) patch.debtType = debtType;
    if (Object.keys(patch).length === 0) {
      setError("Choose at least one field to update");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await bulkUpdateCreditors(leadId, ids, patch);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update creditors");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Bulk Update ({count} selected)</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-bg" aria-label="Close">
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-ink">Include On Program</label>
            <Select value={includeOnProgram} onChange={(e) => setIncludeOnProgram(e.target.value as "unchanged" | "yes" | "no")}>
              <option value="unchanged">Leave unchanged</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink">Debt Type</label>
            <Select value={debtType} onChange={(e) => setDebtType(e.target.value)}>
              <option value="">Leave unchanged</option>
              {DEBT_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md border border-border bg-white px-5 py-2 text-sm font-medium text-ink hover:bg-bg">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-hover disabled:opacity-60">
            {saving ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
