import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchCreditProfile,
  fetchCreditProfileSnapshots,
  type ComparePeriod,
  type CreditProfileSnapshot,
  type CreditProfileView,
} from "../../api/creditProfile";
import { Select } from "../../components/controls";
import { IconChevronDown, IconInfo } from "../layout/icons";

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const PERIOD_LABELS: Record<ComparePeriod, string> = { "30": "30 Days", "60": "60 Days", "90": "90 Days", all: "All History" };
const TREND_STYLES: Record<string, string> = {
  IMPROVING: "bg-green-50 text-green-700",
  DETERIORATING: "bg-red-50 text-red-700",
  STABLE: "bg-amber-50 text-amber-700",
  NEW_ACTIVITY: "bg-amber-50 text-amber-700",
  INSUFFICIENT_HISTORY: "bg-gray-100 text-muted",
};

function money(n: number | null): string {
  return n === null ? "--" : CURRENCY.format(n);
}
function pct(n: number | null): string {
  return n === null ? "--" : `${n.toFixed(1)}%`;
}
function signed(n: number | null, suffix = ""): string {
  if (n === null) return "--";
  return `${n > 0 ? "+" : ""}${n}${suffix}`;
}
function monthsLabel(m: number | null): string {
  if (m === null) return "--";
  const y = Math.floor(m / 12);
  const rem = m % 12;
  return `${y}y ${rem}m`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso + "T00:00:00").toLocaleDateString();
}

function Metric({ label, value, delta, tone }: { label: string; value: string; delta?: string; tone?: "good" | "bad" | "warn" }) {
  const toneClass = tone === "good" ? "text-green-700" : tone === "bad" ? "text-error" : tone === "warn" ? "text-amber-700" : "text-muted";
  return (
    <div className="min-h-[86px] rounded-card border border-border bg-white p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1.5 text-xl font-black tracking-tight text-ink">{value}</div>
      {delta && <div className={`mt-1 text-[11px] ${toneClass}`}>{delta}</div>}
    </div>
  );
}

function Kv({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-h-[64px] rounded-md border border-border p-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-sm font-bold text-ink">{value}</div>
      {note && <div className="mt-1 text-[10px] text-muted">{note}</div>}
    </div>
  );
}

function Section({ title, count, id, closed, onToggle, children }: { title: string; count: string; id: string; closed: Set<string>; onToggle: (id: string) => void; children: ReactNode }) {
  const isClosed = closed.has(id);
  return (
    <section className="my-2.5 overflow-hidden rounded-card border border-border bg-white">
      <button type="button" onClick={() => onToggle(id)} className="flex w-full items-center justify-between gap-2 bg-[#f1f3f5] px-4 py-3 text-left font-extrabold text-ink">
        <span className="flex items-center gap-2">
          {title}
          <span className="rounded-full border border-border bg-white px-2 py-0.5 text-[9px] font-semibold text-muted">{count}</span>
        </span>
        <IconChevronDown width={16} height={16} className={`transition-transform ${isClosed ? "-rotate-90" : ""}`} />
      </button>
      {!isClosed && <div className="p-3.5">{children}</div>}
    </section>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-md border border-border">{children}</div>;
}
function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap border-b border-border bg-[#fafbfc] px-2.5 py-2 text-left text-[10px] font-semibold text-[#4f5964]">{children}</th>;
}
function Td({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className="whitespace-nowrap border-b border-[#edf0f2] px-2.5 py-2 text-[11px] text-ink">
      {children}
    </td>
  );
}

// Small dependency-free SVG line chart over this lead's own snapshots -
// mirrors the Additional Info prototype's hand-rolled chart. No charting
// library exists in crm-frontend, so this stays inline SVG rather than
// pulling one in for a single chart.
function TrendChart({ snapshots }: { snapshots: CreditProfileSnapshot[] }) {
  const withScore = snapshots.filter((s) => s.score !== null);
  if (withScore.length < 2) {
    return <p className="p-4 text-[11px] text-muted">More historical snapshots are needed to display a trend.</p>;
  }
  const W = 680;
  const H = 200;
  const px = 42;
  const py = 20;
  const plotW = W - px - 20;
  const plotH = H - py - 34;
  const scores = withScore.map((s) => s.score as number);
  const utils = withScore.map((s) => s.utilization ?? 0);
  const scoreMin = Math.min(...scores) - 10;
  const scoreMax = Math.max(...scores) + 10;
  const utilMin = Math.min(...utils, 0);
  const utilMax = Math.max(...utils, 10) + 5;
  const x = (i: number) => px + (plotW * i) / (withScore.length - 1);
  const ys = (v: number) => py + plotH - ((v - scoreMin) / Math.max(scoreMax - scoreMin, 1)) * plotH;
  const yu = (v: number) => py + plotH - ((v - utilMin) / Math.max(utilMax - utilMin, 1)) * plotH;
  const scorePath = withScore.map((s, i) => `${i ? "L" : "M"}${x(i)},${ys(s.score as number)}`).join(" ");
  const utilPath = withScore.map((s, i) => `${i ? "L" : "M"}${x(i)},${yu(s.utilization ?? 0)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[200px] w-full">
      <line x1={px} y1={py + plotH} x2={px + plotW} y2={py + plotH} stroke="#d9dfe4" />
      <path d={scorePath} fill="none" stroke="#3f6b8c" strokeWidth={3} />
      <path d={utilPath} fill="none" stroke="#b06f32" strokeWidth={3} />
      {withScore.map((s, i) => (
        <g key={s.id}>
          <circle cx={x(i)} cy={ys(s.score as number)} r={3.5} fill="#3f6b8c" />
          <circle cx={x(i)} cy={yu(s.utilization ?? 0)} r={3.5} fill="#b06f32" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={9} fill="#6c7680">
            {fmtDate(s.reportDate).slice(0, 5)}
          </text>
        </g>
      ))}
    </svg>
  );
}

const DEFAULT_OPEN = new Set<string>(); // everything starts open; membership = closed

export function AdditionalInfoTab({ leadId }: { leadId: string }) {
  const [snapshots, setSnapshots] = useState<CreditProfileSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | undefined>(undefined);
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>("30");
  const [profile, setProfile] = useState<CreditProfileView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [closedSections, setClosedSections] = useState<Set<string>>(DEFAULT_OPEN);

  const load = useCallback(async () => {
    try {
      const snapRes = await fetchCreditProfileSnapshots(leadId);
      setSnapshots(snapRes.snapshots);
      const profileRes = await fetchCreditProfile(leadId, { snapshotId: selectedSnapshotId, comparePeriod });
      setProfile(profileRes.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credit profile");
    }
  }, [leadId, selectedSnapshotId, comparePeriod]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSection(id: string) {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const comparisonLabel = useMemo(() => {
    if (!profile) return "";
    if (!profile.comparisonSnapshotId) return "No eligible earlier snapshot for this comparison.";
    const s = profile.snapshots.find((x) => x.id === profile.comparisonSnapshotId);
    return s ? `Comparing ${fmtDate(profile.reportDate)} to ${fmtDate(s.reportDate)}.` : "";
  }, [profile]);

  if (error) return <p className="rounded-card border border-dashed border-border bg-white p-6 text-sm text-error">{error}</p>;
  if (profile === undefined) return <p className="rounded-card border border-dashed border-border bg-white p-10 text-center text-sm text-muted">Loading…</p>;

  if (profile === null) {
    return (
      <div className="rounded-card border border-dashed border-border bg-white p-10 text-center">
        <p className="text-sm font-semibold text-ink">No credit report on file yet</p>
        <p className="mt-1 text-xs text-muted">Once a credit report is uploaded for this applicant (via the client calculator's "Upload Credit Report" step), the current profile, historical snapshots and trends will appear here.</p>
      </div>
    );
  }

  const util = profile.revolving.utilization;
  const score = profile.score;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-white px-4 py-2.5">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-[10px] text-muted">Report Provider</div>
            <div className="text-xs font-semibold text-ink">{profile.reportProvider ?? "--"}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Bureau Coverage</div>
            <div className="text-xs font-semibold text-ink">{profile.bureausCovered.length ? profile.bureausCovered.join(" + ") : "--"}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted">Extraction Confidence</div>
            <div className="text-xs font-semibold text-ink">{profile.extractionConfidence !== null ? `${profile.extractionConfidence.toFixed(1)}%` : "--"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select fitContent value={selectedSnapshotId ?? profile.currentSnapshotId} onChange={(e) => setSelectedSnapshotId(e.target.value)}>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {fmtDate(s.reportDate)}
                {s.isCurrent ? " – Current" : ""}
              </option>
            ))}
          </Select>
          <button type="button" onClick={() => setSelectedSnapshotId(undefined)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-ink hover:border-teal">
            Current
          </button>
        </div>
      </div>

      <div className={`rounded-md border px-3 py-2 text-xs ${profile.currentSnapshotId === (snapshots.find((s) => s.isCurrent)?.id ?? "") ? "border-[#d8e2e9] bg-[#f7fafc] text-[#536776]" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {profile.currentSnapshotId === (snapshots.find((s) => s.isCurrent)?.id ?? "")
          ? "Current profile - prior snapshots are retained and used to calculate trends without overwriting history."
          : `Historical snapshot view: ${fmtDate(profile.reportDate)}. You are viewing the profile exactly as stored on this report date.`}
      </div>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Credit Score" value={score.value !== null ? String(score.value) : "--"} delta={score.changeVsComparison !== null ? signed(score.changeVsComparison) : "No earlier snapshot"} tone={score.changeVsComparison === null ? undefined : score.changeVsComparison >= 0 ? "good" : "bad"} />
        <Metric label="Credit Card Debt" value={money(profile.revolving.totalBalance)} />
        <Metric label="Total Credit Limits" value={money(profile.revolving.totalLimits)} />
        <Metric label="Overall Utilization" value={pct(util)} tone={util !== null && util > 70 ? "bad" : util !== null && util > 30 ? "warn" : "good"} />
        <Metric label="Late Payments – 24M" value={String(profile.paymentHistory.late24m)} tone={profile.paymentHistory.late24m > 0 ? "warn" : "good"} />
        <Metric label="Hard Inquiries – 12M" value={String(profile.inquiries.m12)} tone={profile.inquiries.m12 > 3 ? "warn" : undefined} />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-white px-3 py-2.5">
        <div>
          <div className="text-xs font-extrabold text-ink">Compare current view against:</div>
          <div className="text-[10px] text-muted">{comparisonLabel}</div>
        </div>
        <div className="flex gap-1">
          {(["30", "60", "90", "all"] as ComparePeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setComparePeriod(p)}
              className={`rounded-md border px-3 py-1.5 text-[10px] font-bold ${comparePeriod === p ? "border-teal bg-teal text-white" : "border-border bg-[#f7f8f9] text-ink"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <Section id="score" title="Credit Score" count="Snapshot summary" closed={closedSections} onToggle={toggleSection}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kv label="Score" value={score.value !== null ? String(score.value) : "--"} note={score.bureau ? `${score.bureau}${score.model ? ` · ${score.model}` : ""}` : "Comparable bureau/model only"} />
          <Kv label="Change vs Comparison" value={score.changeVsComparison !== null ? signed(score.changeVsComparison) : "--"} />
          <Kv label="Report Date" value={fmtDate(profile.reportDate)} />
          <Kv label="Snapshot Status" value={profile.currentSnapshotId === (snapshots.find((s) => s.isCurrent)?.id ?? "") ? "CURRENT" : "Historical"} />
        </div>
      </Section>

      <Section id="revolving" title="Credit Cards & Revolving Debt" count={`${profile.revolving.cardCount} dynamic accounts`} closed={closedSections} onToggle={toggleSection}>
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kv label="Total Credit Card Balances" value={money(profile.revolving.totalBalance)} />
          <Kv label="Total Credit Card Limits" value={money(profile.revolving.totalLimits)} />
          <Kv label="Utilization Percent" value={pct(profile.revolving.utilization)} note="Total balances ÷ total valid limits" />
          <Kv label="Highest Single-Card Utilization" value={pct(profile.revolving.highestCardUtilization)} />
          <Kv label="Number of Maxed-Out Cards" value={String(profile.revolving.maxedOutCount)} />
          <Kv label="Number of Credit Cards" value={String(profile.revolving.cardCount)} />
          <Kv label="Cards Over 50% Utilization" value={String(profile.revolving.cardsOver50Count)} />
        </div>
        <TableWrap>
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr>
                <Th>Creditor</Th>
                <Th>Balance</Th>
                <Th>Limit</Th>
                <Th>Utilization</Th>
                <Th>Monthly Pmt</Th>
                <Th>Opened</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {profile.revolving.cards.map((c) => (
                <tr key={c.accountGroupId}>
                  <Td>{c.creditorName ?? "--"}</Td>
                  <Td>{money(c.balance)}</Td>
                  <Td>{money(c.limit)}</Td>
                  <Td>{pct(c.utilization)}</Td>
                  <Td>{money(c.monthlyPayment)}</Td>
                  <Td>{fmtDate(c.dateOpened)}</Td>
                  <Td>{c.status ?? "--"}</Td>
                </tr>
              ))}
              {profile.revolving.cards.length === 0 && (
                <tr>
                  <Td colSpan={7}>No revolving accounts on this snapshot</Td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section id="loans" title="Loan Balances & Credit Mix" count="Dynamic accounts" closed={closedSections} onToggle={toggleSection}>
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(["MORTGAGE", "AUTO", "STUDENT", "PERSONAL"] as const).map((cat) => (
            <Kv key={cat} label={`Total ${cat[0]}${cat.slice(1).toLowerCase()} Balance`} value={money(profile.loans.totals[cat]?.balance ?? 0)} note={`${profile.loans.totals[cat]?.count ?? 0} account(s)`} />
          ))}
          <Kv label="Open Loans Count" value={String(profile.loans.openCount)} />
          <Kv label="Loans In Good Standing" value={String(profile.loans.goodStandingCount)} />
          <Kv label="Loans Behind" value={String(profile.loans.behindCount)} />
        </div>
        <TableWrap>
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Creditor</Th>
                <Th>Balance</Th>
                <Th>Monthly Pmt</Th>
                <Th>Opened</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {profile.loans.loans.map((l) => (
                <tr key={l.accountGroupId}>
                  <Td>{l.category}</Td>
                  <Td>{l.creditorName ?? "--"}</Td>
                  <Td>{money(l.balance)}</Td>
                  <Td>{money(l.monthlyPayment)}</Td>
                  <Td>{fmtDate(l.dateOpened)}</Td>
                  <Td>{l.status ?? "--"}</Td>
                </tr>
              ))}
              {profile.loans.loans.length === 0 && (
                <tr>
                  <Td colSpan={6}>No installment loans on this snapshot</Td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section id="payment" title="Payment History Metrics" count="Overall" closed={closedSections} onToggle={toggleSection}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kv label="Total Late Payments" value={String(profile.paymentHistory.totalLate)} />
          <Kv label="Late Payments 24 Months" value={String(profile.paymentHistory.late24m)} />
          <Kv label="30-Day Late Payments" value={String(profile.paymentHistory.late30)} />
          <Kv label="60-Day Late Payments" value={String(profile.paymentHistory.late60)} />
          <Kv label="90+ Day Late Payments" value={String(profile.paymentHistory.late90Plus)} />
          <Kv label="Oldest Late Payment Month" value={profile.paymentHistory.oldestLateMonth ?? "--"} />
          <Kv label="Most Recent Late Payment" value={profile.paymentHistory.mostRecentLateMonth ?? "--"} />
          <Kv label="On-Time Payment Rate" value={profile.paymentHistory.onTimeRate !== null ? pct(profile.paymentHistory.onTimeRate) : "--"} />
        </div>
      </Section>

      <Section id="age" title="Credit Age" count="Calculated" closed={closedSections} onToggle={toggleSection}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Kv label="Oldest Account Age" value={monthsLabel(profile.creditAge.oldestMonths)} />
          <Kv label="Average Account Age" value={monthsLabel(profile.creditAge.averageMonths)} />
          <Kv label="Newest Account Age" value={monthsLabel(profile.creditAge.newestMonths)} />
        </div>
      </Section>

      <Section id="inquiries" title="Hard Inquiry Profile" count={`${profile.inquiries.items.length} dynamic inquiries`} closed={closedSections} onToggle={toggleSection}>
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Kv label="Inquiries 30 Days" value={String(profile.inquiries.d30)} />
          <Kv label="Inquiries 90 Days" value={String(profile.inquiries.d90)} />
          <Kv label="Inquiries 180 Days" value={String(profile.inquiries.d180)} />
          <Kv label="Inquiries 6 Months" value={String(profile.inquiries.m6)} />
          <Kv label="Inquiries 12 Months" value={String(profile.inquiries.m12)} />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kv label="Auto Inquiries 12M" value={String(profile.inquiries.byType.AUTO ?? 0)} />
          <Kv label="Credit Card Inquiries 12M" value={String(profile.inquiries.byType.CREDIT_CARD ?? 0)} />
          <Kv label="Mortgage Inquiries 12M" value={String(profile.inquiries.byType.MORTGAGE ?? 0)} />
          <Kv label="Business Funding Inquiries 12M" value={String(profile.inquiries.byType.BUSINESS_FUNDING ?? 0)} />
        </div>
        <TableWrap>
          <table className="w-full min-w-[680px] border-collapse text-xs">
            <thead>
              <tr>
                <Th>Inquirer</Th>
                <Th>Date</Th>
                <Th>Days Ago</Th>
                <Th>Type</Th>
                <Th>New Since Prior?</Th>
              </tr>
            </thead>
            <tbody>
              {profile.inquiries.items.map((q, i) => (
                <tr key={i}>
                  <Td>{q.institutionName ?? "--"}</Td>
                  <Td>{fmtDate(q.date)}</Td>
                  <Td>{q.daysAgo ?? "--"}</Td>
                  <Td>{q.purposeCategory ?? "--"}</Td>
                  <Td>{q.isNew ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">New</span> : "No"}</Td>
                </tr>
              ))}
              {profile.inquiries.items.length === 0 && (
                <tr>
                  <Td colSpan={5}>No hard inquiries in the last 12 months</Td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section id="trends" title="Credit Profile Trends & Historical Snapshots" count="30 / 60 / 90 / all history" closed={closedSections} onToggle={toggleSection}>
        <div className="mb-3 rounded-md border border-dashed border-amber-300 bg-amber-50 p-2.5 text-[10px] text-amber-900">
          A new credit report creates a new immutable snapshot. The latest snapshot becomes the current profile; prior snapshots remain available so all math can update while trends stay visible.
        </div>
        <div className="mb-3 rounded-card border border-border p-2.5">
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-ink">
            <span>Profile Direction Across Snapshots</span>
            <span className="text-[9px] font-normal text-muted">— Score &nbsp;&nbsp; — Utilization</span>
          </div>
          <TrendChart snapshots={profile.snapshots} />
        </div>
        <TableWrap>
          <table className="mb-3 w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th>Historical</Th>
                <Th>Current View</Th>
                <Th>Change</Th>
                <Th>Trend</Th>
                <Th>Interpretation</Th>
              </tr>
            </thead>
            <tbody>
              {profile.trendRows.map((r) => (
                <tr key={r.metric}>
                  <Td>{r.metric}</Td>
                  <Td>{r.historical ?? "--"}</Td>
                  <Td>{r.current ?? "--"}</Td>
                  <Td>{r.change ?? "--"}</Td>
                  <Td>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${TREND_STYLES[r.trend]}`}>{r.trend.replace("_", " ")}</span>
                  </Td>
                  <Td>{r.interpretation}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <TableWrap>
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Historical Balance</Th>
                <Th>Current Balance</Th>
                <Th>Balance Change</Th>
                <Th>Historical Util.</Th>
                <Th>Current Util.</Th>
                <Th>Status Change</Th>
              </tr>
            </thead>
            <tbody>
              {profile.accountChanges.map((r) => (
                <tr key={r.accountGroupId}>
                  <Td>{r.creditorName ?? "--"}</Td>
                  <Td>{money(r.historicalBalance)}</Td>
                  <Td>{money(r.currentBalance)}</Td>
                  <Td>{r.balanceChange !== null ? signed(r.balanceChange) : "--"}</Td>
                  <Td>{pct(r.historicalUtilization)}</Td>
                  <Td>{pct(r.currentUtilization)}</Td>
                  <Td>{r.statusChange}</Td>
                </tr>
              ))}
              {profile.accountChanges.length === 0 && (
                <tr>
                  <Td colSpan={7}>No eligible comparison snapshot for account-level tracking.</Td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section id="derogatory" title="Derogatory Items" count="Deduplicated" closed={closedSections} onToggle={toggleSection}>
        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Kv label="Collections Count" value={String(profile.derogatory.collectionsCount)} />
          <Kv label="Collections Amount" value={money(profile.derogatory.collectionsAmount)} />
          <Kv label="Bankruptcies Count" value={String(profile.derogatory.bankruptciesCount)} />
        </div>
        <TableWrap>
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr>
                <Th>Collection</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {profile.derogatory.collections.map((c, i) => (
                <tr key={i}>
                  <Td>{c.creditorName ?? "--"}</Td>
                  <Td>{money(c.balance)}</Td>
                  <Td>{c.status ?? "--"}</Td>
                </tr>
              ))}
              {profile.derogatory.collections.length === 0 && (
                <tr>
                  <Td colSpan={3}>No collections on this snapshot</Td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <Section id="health" title="Overall Profile Health" count="DebtConquest derived" closed={closedSections} onToggle={toggleSection}>
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border p-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-teal text-xl font-black text-teal">{profile.health.grade}</div>
          <div>
            <div className="text-sm font-bold text-ink">Credit Health Index: {profile.health.index}/100</div>
            <div className="flex items-center gap-1 text-[10px] text-muted">
              <IconInfo width={12} height={12} /> DebtConquest internal indicator - not a bureau score or lending decision.
            </div>
          </div>
        </div>
      </Section>

      <p className="px-1 text-[10px] text-muted">Values shown are calculated by DebtConquest from the normalized credit report data and update automatically when a new report is uploaded.</p>
    </div>
  );
}
