import { Fragment, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import type { Chart, ChartDataset, Plugin } from "chart.js";
import { computeAmortizedTotal, type DebtInput, type PayoffResult } from "@debtconquest/calc-engine";
import "./chartSetup";
import { barTooltipOptions } from "./chartSetup";
import {
  PROGRAM_MONTH_OPTIONS,
  computeCompareChartData,
  formatCurrency,
  selectActiveDebts,
  type Assumptions,
  type PayoffComparison,
  type ProgramCostSummary,
} from "./calc";
import { DISCLAIMER, FOOTNOTES, NARRATIVE_HEADING, PROGRAM_COST_ROWS, type ProgramCostRowId } from "./copy";
import { InfoIcon } from "./modals";

// The customer calculator's results, section by section, ported from
// apps/client (comparison/BreakdownSection.tsx, narrative/NarrativeSection
// .tsx, assumptions/*, programCost/*, charts/ProgramPayoffLineChart.tsx,
// compare/CompareSection.tsx, layout/FootnoteSection.tsx) with the same
// controls, copy and chart settings.

const CARD = "rounded-card border border-teal/20 bg-white p-5 shadow-card";

export function BreakdownSection({
  debts,
  totalBalance,
  budgetUsed,
  comparison,
  onOpenHistory,
}: {
  debts: DebtInput[];
  totalBalance: number;
  budgetUsed: number;
  comparison: PayoffComparison;
  onOpenHistory: () => void;
}) {
  const activeDebts = selectActiveDebts(debts);
  const { minimum, snowball, avalanche, hasValidationError } = comparison;

  return (
    <section className="py-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="text-lg font-bold text-deep">Your Debt Breakdown</h2>
          <p className="mt-1 text-sm font-semibold text-teal">Total Balance: {formatCurrency(totalBalance)}</p>
          <div className="mt-4">
            <Bar
              data={{
                labels: activeDebts.map((d) => d.name || "Unnamed"),
                datasets: [{ label: "Balance", data: activeDebts.map((d) => Number(d.balance || 0)), backgroundColor: "#2a7f6f" }],
              }}
              options={{
                plugins: {
                  tooltip: { ...barTooltipOptions, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}` } },
                  legend: { display: false },
                },
              }}
            />
          </div>
        </div>

        <div className={CARD}>
          <h2 className="text-lg font-bold text-deep">If You Try to Pay Off the Debt on Your Own</h2>
          <p className="mt-1 text-sm font-semibold text-teal">Budget used: {formatCurrency(budgetUsed)}/mo</p>

          {hasValidationError ? (
            <p className="mt-4 text-sm font-bold text-error">⚠ Minimum payment too low! Payment must be higher than monthly interest to reduce balance.</p>
          ) : (
            minimum &&
            snowball &&
            avalanche && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <StrategyResult
                    label="Minimums"
                    result={minimum}
                    extra={
                      <button type="button" onClick={onOpenHistory} aria-label="View minimum payment history" className="text-teal">
                        👁
                      </button>
                    }
                  />
                  <StrategyResult label="Snowball" result={snowball} />
                  <StrategyResult label="Avalanche" result={avalanche} />
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
        </div>
      </div>
    </section>
  );
}

function StrategyResult({ label, result, extra }: { label: string; result: PayoffResult; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1">
        <p className="text-sm font-semibold text-deep">{label}</p>
        {extra}
      </div>
      <h3 className="text-lg font-bold text-deep">{result.months} mo</h3>
      <p className="text-xs text-muted">Interest: {formatCurrency(Math.round(result.totalInterest))}</p>
      <p className="text-xs text-muted">Total Pay: {formatCurrency(result.totalPaid)}</p>
    </div>
  );
}

export function NarrativeSection({ paragraphs }: { paragraphs: string[] }) {
  return (
    <section className="py-8">
      <h2 className="text-xl font-bold text-deep">{NARRATIVE_HEADING}</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {paragraphs.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <>
                <br />
                <br />
              </>
            )}
            {p}
          </Fragment>
        ))}
      </p>
    </section>
  );
}

export function BestPathSection({
  totalPrincipal,
  minimumResult,
  programCost,
  programMonths,
  assumptions,
  onAssumptionChange,
  onResetAssumptions,
}: {
  totalPrincipal: number;
  minimumResult: PayoffResult | null;
  programCost: ProgramCostSummary;
  programMonths: number;
  assumptions: Assumptions;
  onAssumptionChange: (key: keyof Assumptions, value: number) => void;
  onResetAssumptions: () => void;
}) {
  return (
    <section className="py-8">
      <h2 className="text-xl font-bold text-deep">Your Best Path to Becoming Debt-Free</h2>
      <p className="mt-1 text-sm text-muted">Compare your options. The math shows which one saves you the most time and money.</p>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CustomizeAssumptionsPanel assumptions={assumptions} onChange={onAssumptionChange} onReset={onResetAssumptions} />
        <ComparisonBars totalPrincipal={totalPrincipal} minimumResult={minimumResult} programCost={programCost} programMonths={programMonths} assumptions={assumptions} />
      </div>
    </section>
  );
}

const TERM_OPTIONS = [36, 48, 60];

function CustomizeAssumptionsPanel({
  assumptions,
  onChange,
  onReset,
}: {
  assumptions: Assumptions;
  onChange: (key: keyof Assumptions, value: number) => void;
  onReset: () => void;
}) {
  const { ccApr, ccMonths, loanApr, loanMonths } = assumptions;

  return (
    <div className={CARD}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-deep">Customize assumptions</h3>
        <button type="button" onClick={onReset} className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-hover">
          Reset to default
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AprControl title="Credit Counseling" value={ccApr} numberMin={0} numberMax={24} onChange={(v) => onChange("ccApr", v)} />
        <TermControl title="Program length" value={ccMonths} onChange={(v) => onChange("ccMonths", v)} />
        <AprControl title="Loan Consolidation" value={loanApr} numberMin={4} numberMax={36} onChange={(v) => onChange("loanApr", v)} />
        <TermControl title="Term:" value={loanMonths} onChange={(v) => onChange("loanMonths", v)} />
      </div>
    </div>
  );
}

// Slider plus number box on the same value, as in the client - the slider
// runs 0-50 while the number box keeps the client's own (narrower) min/max.
function AprControl({ title, value, numberMin, numberMax, onChange }: { title: string; value: number; numberMin: number; numberMax: number; onChange: (v: number) => void }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-deep">
        {title} <span className="font-normal text-muted">APR:</span>
      </h4>
      <input type="range" min={0} max={50} step={0.1} value={value} aria-label={`${title} APR`} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-teal" />
      <label className="mt-1 flex items-center gap-1 text-sm text-deep">
        <input
          type="number"
          min={numberMin}
          max={numberMax}
          step={0.1}
          value={value}
          aria-label={`${title} APR percent`}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded-md border border-teal/40 px-2 py-1"
        />
        %
      </label>
    </div>
  );
}

function TermControl({ title, value, onChange }: { title: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-deep">{title}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full rounded-md border border-teal/40 px-2 py-1.5 text-sm">
        {TERM_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m} months
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonBars({
  totalPrincipal,
  minimumResult,
  programCost,
  programMonths,
  assumptions,
}: {
  totalPrincipal: number;
  minimumResult: PayoffResult | null;
  programCost: ProgramCostSummary;
  programMonths: number;
  assumptions: Assumptions;
}) {
  const { ccApr, ccMonths, loanApr, loanMonths } = assumptions;
  const ccTotal = computeAmortizedTotal(totalPrincipal, ccApr, ccMonths).totalPaid;
  const loanTotal = computeAmortizedTotal(totalPrincipal, loanApr, loanMonths).totalPaid;

  const bars = [
    { id: "dc", label: "DebtConquest", total: programCost.totalCost, years: programMonths / 12, emphasize: true },
    { id: "cc", label: "Credit Counseling", total: ccTotal, years: ccMonths / 12 },
    { id: "loan", label: "Personal Loan Consolidation", total: loanTotal, years: loanMonths / 12 },
    { id: "min", label: "Making Minimum Payments", total: minimumResult?.totalPaid ?? 0, years: (minimumResult?.months ?? 0) / 12 },
  ];
  const maxTotal = Math.max(...bars.map((b) => b.total), 1);

  return (
    <div className={`flex h-full flex-col justify-center gap-4 ${CARD}`}>
      {bars.map((b) => {
        const widthPct = Math.max(16, Math.round((b.total / maxTotal) * 100));
        return (
          <div key={b.id}>
            <div className="mb-1 text-sm font-semibold text-deep">{b.label}</div>
            <div
              className={`flex items-center rounded-full px-4 py-2 text-xs font-bold text-white ${b.emphasize ? "bg-teal" : "bg-deep"}`}
              style={{ width: `${widthPct}%`, minWidth: "9rem" }}
            >
              {formatCurrency(b.total)} ({b.years.toFixed(1)} yrs)
            </div>
          </div>
        );
      })}
    </div>
  );
}

const BANK_FEE_MONTHLY = 9.95;
// The client displays 54.99 here (distinct from the 54.95 inside the cost
// formula) - kept identical so the numbers match what the customer sees.
const LEGAL_FEE_DISPLAY_MONTHLY = 54.99;

export function PersonalizedPlanSection({
  totalPrincipal,
  programCost,
  programMonths,
  legalSupportEnabled,
  onProgramMonthsChange,
  onLegalSupportChange,
  onInfo,
}: {
  totalPrincipal: number;
  programCost: ProgramCostSummary;
  programMonths: number;
  legalSupportEnabled: boolean;
  onProgramMonthsChange: (months: number) => void;
  onLegalSupportChange: (enabled: boolean) => void;
  onInfo: (title: string, message: string) => void;
}) {
  const totalBankFee = programMonths * BANK_FEE_MONTHLY;
  // As in the client: always programMonths x the monthly legal fee, even
  // with legal support set to No.
  const totalLegalSupportFee = programMonths * LEGAL_FEE_DISPLAY_MONTHLY;
  const enrollmentFeeMonths = programCost.monthlyEmi < 451 ? 2 : 1;
  const estimatedSavings = totalPrincipal - programCost.totalCost;

  const selectClass = "w-full rounded-md border border-teal/40 px-2 py-1.5 text-sm text-deep";
  const rows: { id: ProgramCostRowId; value: React.ReactNode }[] = [
    { id: "totalDebtEnrolled", value: formatCurrency(totalPrincipal) },
    {
      id: "legalSupportIncluded",
      value: (
        <select value={legalSupportEnabled ? "yes" : "no"} onChange={(e) => onLegalSupportChange(e.target.value === "yes")} aria-label="Legal Support Included?" className={selectClass}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      ),
    },
    { id: "monthlyLegalFee", value: legalSupportEnabled ? "$54.99" : "$0.00" },
    {
      id: "estimatedTime",
      value: (
        <select value={programMonths} onChange={(e) => onProgramMonthsChange(Number(e.target.value))} aria-label="Estimated Time (months)" className={selectClass}>
          {PROGRAM_MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ),
    },
    { id: "programFee", value: `${programCost.programFeePercent}%` },
    { id: "legalEnrollmentSetup", value: "$349.00" },
    { id: "enrollmentFeeSchedule", value: `${enrollmentFeeMonths} ${enrollmentFeeMonths === 1 ? "Month" : "Months"}` },
    { id: "paymentFrequency", value: "Monthly" },
    { id: "trustAccountFee", value: "$9.95" },
    { id: "estimatedSettlementAmount", value: formatCurrency(programCost.totalSettlementAmount) },
    { id: "totalDebtResolutionFees", value: formatCurrency(programCost.programFeeAmount) },
    { id: "totalTrustAccountFees", value: formatCurrency(totalBankFee) },
    { id: "totalLegalSupportFee", value: formatCurrency(totalLegalSupportFee) },
    { id: "totalEstimatedProgramCost", value: formatCurrency(programCost.totalCost) },
    { id: "totalEstimatedSavings", value: formatCurrency(estimatedSavings) },
    { id: "monthlyPayments", value: formatCurrency(programCost.monthlyEmi) },
  ];

  const labels: string[] = [];
  const remainingDebt: number[] = [];
  for (let i = 0; i <= programMonths; i++) {
    labels.push(i % 10 === 0 || i === programMonths ? `M${i}` : "");
    remainingDebt.push(programCost.totalCost - programCost.monthlyEmi * i);
  }

  return (
    <section className="py-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={CARD}>
          <h2 className="text-lg font-bold text-deep">Your Personalized DebtConquest Plan</h2>
          <p className="mt-1 text-sm text-muted">A clear view of your estimated timeline, fees, and monthly payment based on your debt amount.</p>
          <dl className="mt-4 flex flex-col gap-2 text-sm">
            {rows.map(({ id, value }) => {
              const { label, tooltip } = PROGRAM_COST_ROWS[id];
              const title = label.replace(/:$/, "");
              return (
                <div key={id} className="flex items-center justify-between gap-3 border-b border-teal/10 py-1.5">
                  <dt className="flex items-center text-muted">
                    <InfoIcon title={title} onOpen={() => onInfo(title, tooltip)} />
                    {label}
                  </dt>
                  <dd className="w-32 shrink-0 text-right font-semibold text-deep">{value}</dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className={CARD}>
          <h3 className="text-center text-lg font-bold text-deep">How Your Debt Decreases Over Time</h3>
          <p className="text-center text-sm text-muted">Monthly progress under your customized plan.</p>
          <p className="mt-2 text-sm font-semibold text-teal">Starting Debt: {formatCurrency(totalPrincipal)}</p>
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
          <p className="mt-2 text-right text-xs text-muted">Debt-Free Month: {programMonths}</p>
        </div>
      </div>
    </section>
  );
}

// line_compare.js's fillBetweenLinesPlugin, via the client's CompareSection.
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

export function CompareSection({ totalPrincipal, programCost, programMonths }: { totalPrincipal: number; programCost: ProgramCostSummary; programMonths: number }) {
  const data = useMemo(() => computeCompareChartData(totalPrincipal, programCost, programMonths), [totalPrincipal, programCost, programMonths]);

  const datasets: ChartDataset<"line">[] = [
    // Labelled "(<months> yrs)" exactly as the client does - it only shows
    // in the tooltip.
    { label: `DebtConquest (${programMonths} yrs)`, data: data.dcRemaining, borderColor: "rgba(30,144,255,1)", borderWidth: 2, fill: false, tension: 0.2 },
    { label: `Minimum Payment Plan (${data.minPayYearsLabel} yrs)`, data: data.mpRemaining, borderColor: "rgba(255,99,132,1)", borderWidth: 2, fill: false, tension: 0.2 },
  ];

  return (
    <section className="py-8">
      <div className={CARD}>
        <h4 className="text-center text-base font-semibold text-deep">Here’s what happens if you stay on the minimum-payment path — versus choosing a clear exit.</h4>
        <h3 className="mt-2 text-center text-xl font-bold text-deep">Compare between DebtConquest &amp; Minimum Payments</h3>
        <p className="mt-1 text-center text-sm text-muted">Same debt. Same starting point. Two very different timelines.</p>

        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(30,144,255,1)" }} />
            <span className="text-deep">DebtConquest</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: "rgba(255,99,132,1)" }} />
            <span className="text-deep">Minimum Payment Plan ({data.minPayYearsLabel} yrs)</span>
          </div>
        </div>

        <div className="mt-4">
          <Line
            data={{ labels: data.labels, datasets }}
            options={{
              responsive: true,
              plugins: { legend: { display: false }, tooltip: { enabled: true } },
              scales: {
                x: { title: { display: true, text: "Years" } },
                y: { beginAtZero: true, title: { display: true, text: "Remaining Balance (USD)" } },
              },
            }}
            plugins={[fillBetweenLinesPlugin]}
          />
        </div>
      </div>
    </section>
  );
}

export function FootnoteSection() {
  return (
    <section className="py-8 text-sm text-muted">
      <h4 className="font-bold text-deep">Notes</h4>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {FOOTNOTES.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <h4 className="mt-6 font-bold text-deep">Disclaimer</h4>
      <p className="mt-2 leading-relaxed">{DISCLAIMER}</p>
    </section>
  );
}
