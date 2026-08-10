import { useEffect, useRef, useState } from "react";
import { STATUS_LABELS, WORKLIST_STATUSES, type WorklistStatus } from "../../api/worklist";
import { IconArrowDown } from "../layout/icons";

interface StatusQuickChangeMenuProps {
  current: WorklistStatus;
  onChange: (status: WorklistStatus) => void;
}

// The row-level down-arrow action from the reference screenshot - quick
// status change without opening the full lead record (not built yet).
export function StatusQuickChangeMenu({ current, onChange }: StatusQuickChangeMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change status"
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-muted hover:bg-bg hover:text-ink"
      >
        <IconArrowDown width={14} height={14} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-border bg-white py-1 shadow-card">
          {WORKLIST_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => {
                onChange(status);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-bg ${
                status === current ? "font-semibold text-teal" : "text-ink"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
