import { IconChevronLeft } from "../layout/icons";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
      <span>
        {total === 0 ? "No leads" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-border p-1.5 disabled:opacity-40"
          aria-label="Previous page"
        >
          <IconChevronLeft width={14} height={14} />
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-border p-1.5 disabled:opacity-40"
          aria-label="Next page"
        >
          <IconChevronLeft width={14} height={14} className="rotate-180" />
        </button>
      </div>
    </div>
  );
}
