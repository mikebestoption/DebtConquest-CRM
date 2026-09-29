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
import { Checkbox, Select } from "../../components/controls";

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
      className="min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-ring"
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
    <div className="rounded-card border border-border bg-white p-4 shadow-card">
      {/* auto-fit/minmax instead of viewport breakpoints (sm:/lg:/xl:) -
          this grid sits next to a fixed-width sidebar, so its actual
          rendered width doesn't track the viewport width breakpoints
          assume, which was squeezing the two-input cells (date ranges,
          Credit Pulled Yes/No) into overlapping columns. Base width bumped
          260px -> lets each field breathe on the wide space next to the
          sidebar instead of packing in as many narrow columns as fit. */}
      <div className="grid gap-4 *:min-w-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Search by Id or Name</label>
          <input
            type="text"
            value={draft.search ?? ""}
            onChange={(e) => patch({ search: e.target.value || undefined })}
            placeholder="Search by Id or Name"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Date Created</label>
          <div className="flex min-w-0 gap-1">
            <DateInput value={draft.dateCreatedFrom} onChange={(v) => patch({ dateCreatedFrom: v })} placeholder="From" />
            <DateInput value={draft.dateCreatedTo} onChange={(v) => patch({ dateCreatedTo: v })} placeholder="To" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Last Activity</label>
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
          <label className="mb-1 block text-sm text-gray-600">Enrolled</label>
          <Select value={draft.enrolled ?? "all"} onChange={(e) => patch({ enrolled: e.target.value as YesNoAll })}>
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-600">Credit Pulled Date</label>
          <div className="flex min-w-0 gap-1">
            <DateInput value={draft.creditPulledDateFrom} onChange={(v) => patch({ creditPulledDateFrom: v })} placeholder="From" />
            <DateInput value={draft.creditPulledDateTo} onChange={(v) => patch({ creditPulledDateTo: v })} placeholder="To" />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm text-gray-600">Credit Pulled</span>
          <div className="flex items-center gap-4 pt-2">
            <Checkbox
              label="Yes"
              checked={draft.creditPulled === "all" || draft.creditPulled === "yes"}
              onChange={(checked) => patch({ creditPulled: deriveCreditPulled(checked, draft.creditPulled === "all" || draft.creditPulled === "no") })}
            />
            <Checkbox
              label="No"
              checked={draft.creditPulled === "all" || draft.creditPulled === "no"}
              onChange={(checked) => patch({ creditPulled: deriveCreditPulled(draft.creditPulled === "all" || draft.creditPulled === "yes", checked) })}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-teal hover:bg-bg"
        >
          <IconDownload width={14} height={14} /> Export
        </button>
        <button
          onClick={() => onApply(draft)}
          className="flex items-center gap-1.5 rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-teal-hover"
        >
          <IconFilter width={14} height={14} /> Filter
        </button>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-error hover:bg-error/5 hover:text-error"
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
