import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "../layout/icons";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}

// Backs the Worklist filter bar's Status/Program/Source dropdowns - shows
// "N items selected" like the reference screenshot's Status filter.
export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const summary =
    selected.length === 0 ? "None selected" : selected.length === options.length ? "All selected" : `${selected.length} items selected`;

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-left text-sm text-ink"
      >
        <span className="truncate">{summary}</span>
        <IconChevronDown className="shrink-0 text-muted" width={14} height={14} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-card">
          <div className="flex justify-between border-b border-border px-3 py-1.5 text-xs">
            <button type="button" className="text-teal hover:underline" onClick={() => onChange(options.map((o) => o.value))}>
              Select all
            </button>
            <button type="button" className="text-muted hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          {options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg">
              <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} className="accent-teal" />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
