import { STATUS_LABELS, type WorklistStatus } from "../../api/worklist";

// Loosely groups statuses by funnel stage for color - not meant to be a
// precise design system, just enough to make the grid scannable.
const COLORS: Record<WorklistStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  ATTEMPTED_CONTACT: "bg-amber-50 text-amber-700",
  CONTACTED: "bg-amber-50 text-amber-700",
  QUALIFIED: "bg-violet-50 text-violet-700",
  NOT_QUALIFIED: "bg-gray-100 text-gray-600",
  FOLLOW_UP: "bg-amber-50 text-amber-700",
  ENROLLED: "bg-green-50 text-green-700",
  NOT_INTERESTED: "bg-gray-100 text-gray-600",
  DO_NOT_CONTACT: "bg-red-50 text-red-700",
  DUPLICATE: "bg-gray-100 text-gray-600",
  BAD_NUMBER: "bg-gray-100 text-gray-600",
  CLOSED_LOST: "bg-red-50 text-red-700",
  CLOSED_WON: "bg-green-50 text-green-700",
};

export function StatusBadge({ status }: { status: WorklistStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
