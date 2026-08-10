import type { LeadDetailSummary } from "../../api/leadDetail";
import { Section } from "./formFields";

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function formatDate(iso: string | null): string {
  if (!iso) return "NA";
  return new Date(iso).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="font-semibold text-ink">{label}:</span>
      <span className="text-muted">{value}</span>
    </div>
  );
}

export function SummarySection({ summary }: { summary: LeadDetailSummary }) {
  return (
    <Section title="Summary">
      <div className="grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2">
        <div>
          <Row label="Debt Enrolled" value={CURRENCY.format(summary.debtEnrolled)} />
          <Row label="Date Enrolled" value={formatDate(summary.dateEnrolled)} />
          <Row label="First Payment Date" value={formatDate(summary.firstPaymentDate)} />
          <Row label="Banking Received" value={summary.bankingReceived ? "Yes" : "No"} />
        </div>
        <div>
          <Row label="Credit Pulled Date" value={formatDate(summary.creditPulledDate)} />
          <Row label="Status Change Date" value={formatDateTime(summary.statusChangedAt)} />
          <Row label="Last Call Date" value={formatDate(summary.lastCallDate)} />
          <Row label="Days in Status" value={String(summary.daysInStatus)} />
        </div>
      </div>
    </Section>
  );
}
