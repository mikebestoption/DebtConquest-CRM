import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getMinimumPaymentSchedule, type DebtInput } from "@debtconquest/calc-engine";
import { formatCurrency, selectActiveDebts } from "./calc";

// Portaled to <body> so the CRM's own scroll panels can't clip or stack
// over them.
function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      {children}
    </div>,
    document.body,
  );
}

// The client's shared/InfoIcon.tsx.
export function InfoIcon({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mr-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal text-[10px] font-bold text-white"
      aria-label={`About ${title}`}
      title="Info"
    >
      i
    </button>
  );
}

// The client's shared/InfoModal.tsx.
export function InfoModal({ info, onClose }: { info: { title: string; message: string } | null; onClose: () => void }) {
  if (!info) return null;
  return (
    <Overlay onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-card bg-white p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-deep">{info.title}</h2>
        <p className="mt-3 text-sm text-muted">{info.message}</p>
        <button type="button" onClick={onClose} className="mt-5 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-hover">
          Okay
        </button>
      </div>
    </Overlay>
  );
}

// The client's minimumHistory/MinimumPaymentHistoryModal.tsx - month by
// month on the minimum-payment path, at the raw budget (not the effective
// one), same as the client passes it.
export function MinimumPaymentHistoryModal({ debts, budget, open, onClose }: { debts: DebtInput[]; budget: number; open: boolean; onClose: () => void }) {
  if (!open) return null;
  const schedule = getMinimumPaymentSchedule(selectActiveDebts(debts), budget);

  return (
    <Overlay onClose={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-4 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-deep">Minimum Payment History</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-deep">
            ✕
          </button>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-teal/20 text-xs uppercase text-muted">
              <th className="py-1">Month</th>
              <th className="py-1">Payment</th>
              <th className="py-1">Interest</th>
              <th className="py-1">Balance</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((row) => (
              <tr key={row.month} className="border-b border-teal/10">
                <td className="py-1">{row.month}</td>
                <td className="py-1">{formatCurrency(row.payment)}</td>
                <td className="py-1">{formatCurrency(row.interest)}</td>
                <td className="py-1">{formatCurrency(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Overlay>
  );
}
