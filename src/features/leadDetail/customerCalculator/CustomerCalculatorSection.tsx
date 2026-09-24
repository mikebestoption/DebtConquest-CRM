import { useEffect, useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { Chart, ChartDataset, Plugin } from "chart.js";
import type { DebtInput } from "@debtconquest/calc-engine";
import { fetchLeadDebts, fetchCrmSettlementRates, toDebtInput, type LeadDebt } from "../../../api/leadCalculator";
import "./chartSetup";
import { barTooltipOptions } from "./chartSetup";
import {
  CC_ASSUMPTION,
  DEFAULT_LEGAL_SUPPORT_ENABLED,
  DEFAULT_PROGRAM_MONTHS,
  DEFAULT_WEALTH_RETURN_RATE,
  LOAN_ASSUMPTION,
  computeCompareChartData,
  computePayoffComparison,
  computeProgramCost,
  computeWealthGrowthSeries,
  selectActiveDebts,
  selectTotalBalance,
  selectTotalMinPayment,
  type PayoffComparison,
  type ProgramCostSummary,
} from "./calc";
// amortizedPayment/computeAmortizedTotal isn't exported at the calc.ts
// boundary above (only used inline here for the credit-counseling/loan
// comparison bars) - pulled straight from the package like the client does.
import { computeAmortizedTotal } from "@debtconquest/calc-engine";

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
function fmt(n: number): string {
  return CURRENCY.format(n);
}

const BANK_FEE_MONTHLY = 9.95;
const LEGAL_FEE_MONTHLY = 54.99;

export function CustomerCalculatorSection({ leadId }: { leadId: string }) {
  const [debts, setDebts] = useState<LeadDebt[] | null>(null);
  const [rates, setRates] = useState<{ creditorName: string; settlementPercent: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLeadDebts(leadId), fetchCrmSettlementRates()])
      .then(([d, r]) => {
        if (cancelled) return;
        setDebts(d.debts);
        setRates(r.rates);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load calculator data"));
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (error) return <p className="text-sm text-error">{error}</p>;
  if (!debts) return <p className="text-sm text-muted">Loading customer calculator view…</p>;

  return <CalculatorView debts={debts.map(toDebtInput)} rates={rates} />;
}

function CalculatorView({ debts, rates }: { debts: DebtInput[]; rates: { creditorName: string; settlementPercent: number }[] }) {
  const activeDebts = selectActiveDebts(debts);
  const totalBalance = selectTotalBalance(debts);
  const totalMin = selectTotalMinPayment(debts);
  // The client's own "Monthly Budget for Debt" input is never persisted -
  // it defaults to the sum of active minimums (debtStore.ts's own resume
  // default) and this read-only view has no form to change it.
  const budget = totalMin;

  const comparison = useMemo(() => computePayoffComparison(debts, budget), [debts, budget]);
  const programCost = useMemo(() => computeProgramCost(debts, DEFAULT_PROGRAM_MONTHS, rates), [debts, rates]);

  if (activeDebts.length === 0) {
    return <p className="text-sm text-muted">This customer has no active debts entered in the calculator yet.</p>;
  }

  return (
    <div className="space-y-4">
      <TotalsRow totalBalance={totalBalance} totalMin={totalMin} budget={budget} />
      <BreakdownCharts debts={debts} totalBalance={totalBalance} budgetUsed={comparison.effectiveBudget} comparison={comparison} />

      {comparison.minimum && (
        <>
          <NarrativeCard text={firstNarrative(comparison.minimum.months, comparison.minimum.totalInterest)} />
          <BestPathBars totalPrincipal={totalBalance} minimumResult={comparison.minimum} programCost={programCost} />
          <NarrativeCard text={secondNarrative(comparison.minimum.months, comparison.minimum.totalPaid)} />
          <ProgramCostAndPayoffChart totalPrincipal={totalBalance} programCost={programCost} />
          <NarrativeCard text={thirdNarrative} />
          <CompareChart totalPrincipal={totalBalance} programCost={programCost} />
          <WealthGrowthChart
            totalPrincipal={totalBalance}
            minPayYears={Number(`${Math.floor(comparison.minimum.months / 12)}.${comparison.minimum.months % 12}`)}
            dcYears={Number((DEFAULT_PROGRAM_MONTHS / 12).toFixed(1))}
            totalMinPayment={comparison.effectiveBudget}
          />
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-white p-5">
      {title && <h3 className="mb-3 text-base font-bold text-ink">{title}</h3>}
      {children}
    </div>
  );
}

function TotalsRow({ totalBalance, totalMin, budget }: { totalBalance: number; totalMin: number; budget: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <p className="text-sm text-muted">Total Balance</p>
        <h3 className="mt-1 text-2xl font-bold text-ink">{fmt(totalBalance)}</h3>
      </Card>
      <Card>
        <p className="text-sm text-muted">Sum of Minimums</p>
        <h3 className="mt-1 text-2xl font-bold text-ink">{fmt(totalMin)}</h3>
      </Card>
      <Card>
        <p className="text-sm text-muted">Monthly Budget for Debt</p>
        <h3 className="mt-1 text-2xl font-bold text-ink">{fmt(budget)}</h3>
        <p className="text-xs text-muted">Defaults to sum of minimums - not a field the customer saves</p>
      </Card>
    </div>
  );
}

function BreakdownCharts({
  debts,
  totalBalance,
  budgetUsed,
  comparison,
}: {
  debts: DebtInput[];
  totalBalance: number;
  budgetUsed: number;
  comparison: PayoffComparison;
}) {
  const activeDebts = selectActiveDebts(debts);
  const { minimum, snowball, avalanche, hasValidationError } = comparison;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-bold text-ink">Your Debt Breakdown</h2>
        <p className="mt-1 text-sm font-semibold text-teal">Total Balance: {fmt(totalBalance)}</p>
        <div className="mt-4">
          <Bar
            data={{
              labels: activeDebts.map((d) => d.name || "Unnamed"),
              datasets: [{ label: "Balance", data: activeDebts.map((d) => Number(d.balance || 0)), backgroundColor: "#2a7f6f" }],
            }}
            options={{
              plugins: {
                tooltip: { ...barTooltipOptions, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}` } },
                legend: { display: false },
              },
            }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink">If They Try to Pay Off the Debt on Their Own</h2>
        <p className="mt-1 text-sm font-semibold text-teal">Budget used: {fmt(budgetUsed)}/mo</p>

        {hasValidationError ? (
          <p className="mt-4 text-sm font-bold text-error">⚠ Minimum payment too low - must be higher than monthly interest to reduce balance.</p>
        ) : (
          minimum &&
          snowball &&
          avalanche && (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Minimums", r: minimum },
                  { label: "Snowball", r: snowball },
                  { label: "Avalanche", r: avalanche },
                ].map(({ label, r }) => (
                  <div key={label}>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <h3 className="text-lg font-bold text-ink">{r.months} mo</h3>
                    <p className="text-xs text-muted">Interest: {fmt(Math.round(r.totalInterest))}</p>
                    <p className="text-xs text-muted">Total Pay: {fmt(r.totalPaid)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Bar
                  data={{
                    labels: ["Minimums", "Snowball", "Avalanche"],
                    datasets: [{ label: "Months", data: [minimum.months, snowball.months, avalanche.months], backgroundColor: "#2a7f6f" }],
                  }}
                  options={{ plugins: { tooltip: barTooltipOptions, legend: { display: false } } }}
                />
              </div>
            </>
          )
        )}
      </Card>
    </div>
  );
}

function BestPathBars({
  totalPrincipal,
  minimumResult,
  programCost,
}: {
  totalPrincipal: number;
  minimumResult: { months: number; totalPaid: number };
  programCost: ProgramCostSummary;
}) {
  const ccTotal = computeAmortizedTotal(totalPrincipal, CC_ASSUMPTION.apr, CC_ASSUMPTION.months).totalPaid;
  const loanTotal = computeAmortizedTotal(totalPrincipal, LOAN_ASSUMPTION.apr, LOAN_ASSUMPTION.months).totalPaid;

  const bars = [
    { id: "dc", label: "DebtConquest", total: programCost.totalCost, years: DEFAULT_PROGRAM_MONTHS / 12, emphasize: true },
    { id: "cc", label: "Credit Counseling", total: ccTotal, years: CC_ASSUMPTION.months / 12 },
    { id: "loan", label: "Personal Loan Consolidation", total: loanTotal, years: LOAN_ASSUMPTION.months / 12 },
    { id: "min", label: "Making Minimum Payments", total: minimumResult.totalPaid, years: minimumResult.months / 12 },
  ];
  const maxTotal = Math.max(...bars.map((b) => b.total), 1);

  return (
    <Card title="Your Best Path to Becoming Debt-Free">
      <div className="flex flex-col gap-4">
        {bars.map((b) => {
          const widthPct = Math.max(16, Math.round((b.total / maxTotal) * 100));
          return (
            <div key={b.id}>
              <div className="mb-1 text-sm font-semibold text-ink">{b.label}</div>
              <div
                className={`flex items-center rounded-full px-4 py-2 text-xs font-bold text-white ${b.emphasize ? "bg-teal" : "bg-deep"}`}
                style={{ width: `${widthPct}%`, minWidth: "9rem" }}
              >
                {fmt(b.total)} ({b.years.toFixed(1)} yrs)
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ProgramCostAndPayoffChart({ totalPrincipal, programCost }: { totalPrincipal: number; programCost: ProgramCostSummary }) {
  const totalBankFee = DEFAULT_PROGRAM_MONTHS * BANK_FEE_MONTHLY;
  const totalLegalSupportFee = DEFAULT_LEGAL_SUPPORT_ENABLED ? DEFAULT_PROGRAM_MONTHS * LEGAL_FEE_MONTHLY : 0;
  const enrollmentFeeMonths = programCost.monthlyEmi < 451 ? 2 : 1;
  const estimatedSavings = totalPrincipal - programCost.totalCost;

  const rows: [string, string][] = [
    ["Total Debt Enrolled", fmt(totalPrincipal)],
    ["Legal Support Included?", DEFAULT_LEGAL_SUPPORT_ENABLED ? "Yes" : "No"],
    ["Monthly Legal Fee", DEFAULT_LEGAL_SUPPORT_ENABLED ? "$54.99" : "$0.00"],
    ["Estimated Time", `${DEFAULT_PROGRAM_MONTHS} Months`],
    ["Program Fee", `${programCost.programFeePercent}%`],
    ["Legal Enrollment Setup", "$349.00"],
    ["Enrollment Fee Schedule", `${enrollmentFeeMonths} Month${enrollmentFeeMonths === 1 ? "" : "s"}`],
    ["Payment Frequency", "Monthly"],
    ["Trust Account Fee", "$9.95"],
    ["Estimated Settlement Amount", fmt(programCost.totalSettlementAmount)],
    ["Total Debt Resolution Fees", fmt(programCost.programFeeAmount)],
    ["Total Trust Account Fees", fmt(totalBankFee)],
    ["Total Legal Support Fee", fmt(totalLegalSupportFee)],
    ["Total Estimated Program Cost", fmt(programCost.totalCost)],
    ["Total Estimated Savings", fmt(estimatedSavings)],
    ["Monthly Payments", fmt(programCost.monthlyEmi)],
  ];

  const labels: string[] = [];
  const remainingDebt: number[] = [];
  for (let i = 0; i <= DEFAULT_PROGRAM_MONTHS; i++) {
    labels.push(i % 10 === 0 || i === DEFAULT_PROGRAM_MONTHS ? `M${i}` : "");
    remainingDebt.push(programCost.totalCost - programCost.monthlyEmi * i);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-lg font-bold text-ink">Personalized DebtConquest Plan</h2>
        <p className="mt-1 text-sm text-muted">Estimated timeline, fees, and monthly payment based on the debt amount above.</p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5">
              <dt className="text-muted">{label}:</dt>
              <dd className="w-32 shrink-0 text-right font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h3 className="text-center text-lg font-bold text-ink">How the Debt Decreases Over Time</h3>
        <p className="text-center text-sm text-muted">Monthly progress under the default plan.</p>
        <p className="mt-2 text-sm font-semibold text-teal">Starting Debt: {fmt(totalPrincipal)}</p>
        <div className="mt-3">
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: "Remaining Obligation",
                  data: remainingDebt,
                  borderColor: "#106666",
                  backgroundColor: "rgba(30,144,255,0.2)",
                  tension: 0.2,
                  fill: false,
                  pointRadius: 4,
                  pointBackgroundColor: "#08bcb6",
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { display: false }, tooltip: { enabled: true } },
              scales: { y: { title: { display: true, text: "Remaining Debt" }, beginAtZero: true } },
            }}
          />
        </div>
        <p className="mt-2 text-right text-xs text-muted">Debt-Free Month: {DEFAULT_PROGRAM_MONTHS}</p>
      </Card>
    </div>
  );
}

const fillBetweenLinesPlugin: Plugin<"line"> = {
  id: "fillBetweenLinesPlugin",
  afterDraw(chart: Chart<"line">) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const dc = chart.data.datasets[0]?.data as number[];
    const mp = chart.data.datasets[1]?.data as number[];
    if (!dc || !mp) return;

    ctx.save();
    ctx.fillStyle = "rgba(255,182,193,0.35)";
    ctx.beginPath();
    ctx.moveTo(scales.x.getPixelForValue(0), scales.y.getPixelForValue(dc[0]));
    for (let i = 1; i < dc.length; i++) ctx.lineTo(scales.x.getPixelForValue(i), scales.y.getPixelForValue(dc[i]));
    for (let i = mp.length - 1; i >= 0; i--) ctx.lineTo(scales.x.getPixelForValue(i), scales.y.getPixelForValue(mp[i]));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
};

function CompareChart({ totalPrincipal, programCost }: { totalPrincipal: number; programCost: ProgramCostSummary }) {
  const data = useMemo(() => computeCompareChartData(totalPrincipal, programCost, DEFAULT_PROGRAM_MONTHS), [totalPrincipal, programCost]);

  const datasets: ChartDataset<"line">[] = [
    { label: `DebtConquest (${DEFAULT_PROGRAM_MONTHS / 12} yrs)`, data: data.dcRemaining, borderColor: "rgba(30,144,255,1)", borderWidth: 2, fill: false, tension: 0.2 },
    { label: `Minimum Payment Plan (${data.minPayYearsLabel} yrs)`, data: data.mpRemaining, borderColor: "rgba(255,99,132,1)", borderWidth: 2, fill: false, tension: 0.2 },
  ];

  return (
    <Card>
      <h4 className="text-center text-base font-semibold text-ink">What happens on the minimum-payment path versus a clear exit.</h4>
      <h3 className="mt-2 text-center text-xl font-bold text-ink">Compare DebtConquest & Minimum Payments</h3>
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(30,144,255,1)" }} />
          <span className="text-ink">DebtConquest</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(255,99,132,1)" }} />
          <span className="text-ink">Minimum Payment Plan ({data.minPayYearsLabel} yrs)</span>
        </div>
      </div>
      <div className="mt-4">
        <Line
          data={{ labels: data.labels, datasets }}
          options={{
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: { x: { title: { display: true, text: "Years" } }, y: { beginAtZero: true, title: { display: true, text: "Remaining Balance (USD)" } } },
          }}
          plugins={[fillBetweenLinesPlugin]}
        />
      </div>
    </Card>
  );
}

function WealthGrowthChart({
  totalPrincipal,
  minPayYears,
  dcYears,
  totalMinPayment,
}: {
  totalPrincipal: number;
  minPayYears: number;
  dcYears: number;
  totalMinPayment: number;
}) {
  const difYears = Number((minPayYears - dcYears).toFixed(1));
  const series = useMemo(
    () => computeWealthGrowthSeries(totalMinPayment, difYears, DEFAULT_WEALTH_RETURN_RATE),
    [totalMinPayment, difYears],
  );

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">What happens to that same monthly payment once the debt is gone?</h2>
      <p className="mt-1 text-sm text-muted">
        Projected using the default {DEFAULT_WEALTH_RETURN_RATE}% return assumption - totalDebt {fmt(totalPrincipal)}, {minPayYears} yrs of minimums vs {dcYears}{" "}
        yrs with DebtConquest.
      </p>
      <div className="mt-6">
        <Line
          plugins={[ChartDataLabels]}
          data={{
            labels: series.labels,
            datasets: [
              { label: "Projected Wealth", data: series.values, borderColor: "#08bcb6", backgroundColor: "rgba(8,188,182,0.15)", tension: 0.3, fill: true, pointRadius: 3 },
            ],
          }}
          options={{
            responsive: true,
            layout: { padding: { top: 20 } },
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true, callbacks: { label: (ctx) => fmt(Number(ctx.parsed.y)) } },
              datalabels: { align: "top", anchor: "end", color: "#0f2e2c", font: { size: 10, weight: "bold" }, formatter: (v: number) => fmt(v) },
            },
            scales: { y: { beginAtZero: true, title: { display: true, text: "Projected Value ($)" } } },
          }}
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Redirecting the same {fmt(totalMinPayment)}/mo into investments after becoming debt-free could grow to over {fmt(series.totalSaved)} in {difYears} years.
      </p>
    </Card>
  );
}

function NarrativeCard({ text }: { text: string }) {
  return (
    <Card title="What this actually means for the customer">
      {/* eslint-disable-next-line react/no-danger */}
      <p className="text-sm leading-relaxed text-muted" dangerouslySetInnerHTML={{ __html: text }} />
    </Card>
  );
}

function firstNarrative(months: number, totalInterest: number): string {
  const yearsWhole = Math.floor(months / 12);
  const remMonths = months % 12;
  const years = remMonths > 0 ? `${yearsWhole}.${remMonths}` : `${yearsWhole}`;
  return `At the current pace, they'll remain in debt for approximately ${years} years and pay an estimated ${fmt(Math.round(totalInterest))} in interest alone.<br><br>With a structured debt resolution strategy, many people reduce that timeline to as little as 24–48 months.`;
}

function secondNarrative(months: number, totalPaid: number): string {
  const years = `${Math.floor(months / 12)}.${months % 12}`;
  return `At the current pace, they'll stay in debt for ${years} years and send over ${fmt(totalPaid)} to banks.<br><br>DebtConquest compresses that into just ${DEFAULT_PROGRAM_MONTHS} months - with a clear finish line.`;
}

const thirdNarrative =
  "The chart above shows the debt shrinking every month - not dragging on for decades, but moving steadily toward zero, with a real month on the calendar for the last payment.";
