import { useState } from "react";
import {
  LEAD_PROGRAMS,
  LEAD_SOURCES,
  PROGRAM_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  WORKLIST_STATUSES,
  DEFAULT_WORKLIST_FILTERS,
  type LeadProgram,
  type LeadSource,
  type WorklistFilters,
  type WorklistStatus,
  type YesNoAll,
} from "../../api/worklist";
import { MultiSelect } from "./MultiSelect";
import { IconDownload, IconFilter, IconTrash } from "../layout/icons";

const STATUS_OPTIONS = WORKLIST_STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] }));
const PROGRAM_OPTIONS = LEAD_PROGRAMS.map((v) => ({ value: v, label: PROGRAM_LABELS[v] }));
const SOURCE_OPTIONS = LEAD_SOURCES.map((v) => ({ value: v, label: SOURCE_LABELS[v] }));

interface FilterBarProps {
  onApply: (filters: WorklistFilters) => void;
  onExport: () => void;
}

function DateInput({ value, onChange, placeholder }: { value?: string; onChange: (v: string | undefined) => void; placeholder: string }) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder={placeholder}
      // min-w-0 lets it actually shrink inside the flex pair below - native
      // date inputs otherwise refuse to go below their content width and
      // spill into the next grid cell.
      className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-2 text-sm text-ink outline-none focus:border-teal"
    />
  );
}

export function FilterBar({ onApply, onExport }: FilterBarProps) {
  const [draft, setDraft] = useState<WorklistFilters>(DEFAULT_WORKLIST_FILTERS);

  function patch(partial: Partial<WorklistFilters>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function handleClear() {
    setDraft(DEFAULT_WORKLIST_FILTERS);
    onApply(DEFAULT_WORKLIST_FILTERS);
  }

  return (
    <div className="rounded-card border border-border bg-white p-4">
      {/* auto-fit/minmax instead of viewport breakpoints (sm:/lg:/xl:) -
          this grid sits next to a fixed-width sidebar, so its actual
          rendered width doesn't track the viewport width breakpoints
          assume, which was squeezing the two-input cells (date ranges,
          Credit Pulled Yes/No) into overlapping columns. */}
      <div className="grid gap-4 *:min-w-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Search by Id or Name</label>
          <input
            type="text"
            value={draft.search ?? ""}
            onChange={(e) => patch({ search: e.target.value || undefined })}
            placeholder="Search by Id or Name"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-teal"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Date Created</label>
          <div className="flex min-w-0 gap-1">
            <DateInput value={draft.dateCreatedFrom} onChange={(v) => patch({ dateCreatedFrom: v })} placeholder="From" />
            <DateInput value={draft.dateCreatedTo} onChange={(v) => patch({ dateCreatedTo: v })} placeholder="To" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Last Activity</label>
          <div className="flex min-w-0 gap-1">
            <DateInput value={draft.lastActivityFrom} onChange={(v) => patch({ lastActivityFrom: v })} placeholder="From" />
            <DateInput value={draft.lastActivityTo} onChange={(v) => patch({ lastActivityTo: v })} placeholder="To" />
          </div>
        </div>

        <MultiSelect
          label="Status"
          options={STATUS_OPTIONS}
          selected={draft.status ?? []}
          onChange={(v) => patch({ status: v as WorklistStatus[] })}
        />
        <MultiSelect
          label="Program"
          options={PROGRAM_OPTIONS}
          selected={draft.program ?? []}
          onChange={(v) => patch({ program: v as LeadProgram[] })}
        />
        <MultiSelect
          label="Source"
          options={SOURCE_OPTIONS}
          selected={draft.source ?? []}
          onChange={(v) => patch({ source: v as LeadSource[] })}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Enrolled</label>
          <select
            value={draft.enrolled ?? "all"}
            onChange={(e) => patch({ enrolled: e.target.value as YesNoAll })}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-teal"
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Credit Pulled Date</label>
          <div className="flex min-w-0 gap-1">
            <DateInput value={draft.creditPulledDateFrom} onChange={(v) => patch({ creditPulledDateFrom: v })} placeholder="From" />
            <DateInput value={draft.creditPulledDateTo} onChange={(v) => patch({ creditPulledDateTo: v })} placeholder="To" />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Credit Pulled</span>
          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                className="accent-teal"
                checked={draft.creditPulled === "all" || draft.creditPulled === "yes"}
                onChange={(e) =>
                  patch({ creditPulled: deriveCreditPulled(e.target.checked, draft.creditPulled === "all" || draft.creditPulled === "no") })
                }
              />
              Yes
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                className="accent-teal"
                checked={draft.creditPulled === "all" || draft.creditPulled === "no"}
                onChange={(e) =>
                  patch({ creditPulled: deriveCreditPulled(draft.creditPulled === "all" || draft.creditPulled === "yes", e.target.checked) })
                }
              />
              No
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          <IconDownload width={14} height={14} /> Export
        </button>
        <button
          onClick={() => onApply(draft)}
          className="flex items-center gap-1.5 rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-hover"
        >
          <IconFilter width={14} height={14} /> Filter
        </button>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg"
        >
          <IconTrash width={14} height={14} /> Clear
        </button>
      </div>
    </div>
  );
}

// Two independent Yes/No checkboxes collapse onto one yes/no/all query
// param: both checked = all, only one checked = that value, neither
// checked stays whichever was just unchecked (both-off has no filter
// meaning here, so it's treated as "all" rather than returning zero rows).
function deriveCreditPulled(yes: boolean, no: boolean): YesNoAll {
  if (yes && no) return "all";
  if (yes) return "yes";
  if (no) return "no";
  return "all";
}
