import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import "./chartSetup";
import { DEFAULT_WEALTH_RETURN_RATE, computeWealthGrowthSeries, formatCurrency } from "./calc";
import { wealthSummary } from "./copy";

// apps/client/src/features/wealth/WealthGrowthCalculator.tsx - the
// "Debt-to-Wealth Growth Calculator" form, its chart and the summary below
// it - with the client's wealthStore.ts ported into local state.

interface WealthSeed {
  totalDebt: number;
  mpYears: number;
  dcYears: number;
  mpPayment: number;
}

interface WealthState extends WealthSeed {
  difYears: number;
  savingAmt: number;
  returnRate: number;
  difYearsManuallySet: boolean;
}

// wealthStore.ts's seedFromCalculator: a manually entered "years of saving"
// survives a re-seed, everything else follows the calculator.
function seeded(prev: WealthState, s: WealthSeed): WealthState {
  return {
    ...prev,
    ...s,
    savingAmt: s.mpPayment,
    difYears: prev.difYearsManuallySet ? prev.difYears : Number((s.mpYears - s.dcYears).toFixed(1)),
  };
}

const EMPTY: WealthState = { totalDebt: 0, mpYears: 0, dcYears: 0, mpPayment: 0, difYears: 0, savingAmt: 0, returnRate: DEFAULT_WEALTH_RETURN_RATE, difYearsManuallySet: false };

export function WealthGrowthCalculator({
  totalPrincipal,
  minPayYears,
  dcYears,
  totalMinPayment,
  onEdit,
}: {
  totalPrincipal: number;
  minPayYears: number;
  dcYears: number;
  totalMinPayment: number;
  onEdit: () => void;
}) {
  const [s, setS] = useState<WealthState>(() => seeded(EMPTY, { totalDebt: totalPrincipal, mpYears: minPayYears, dcYears, mpPayment: totalMinPayment }));

  // Re-seed whenever the calculator above changes, as the client does.
  useEffect(() => {
    setS((prev) => seeded(prev, { totalDebt: totalPrincipal, mpYears: minPayYears, dcYears, mpPayment: totalMinPayment }));
  }, [totalPrincipal, minPayYears, dcYears, totalMinPayment]);

  function update(next: (prev: WealthState) => WealthState) {
    setS(next);
    onEdit();
  }

  // The same cross-field rules as wealthStore.ts's setters.
  const setTotalDebt = (v: number) => update((p) => ({ ...p, totalDebt: v }));
  const setMpYears = (v: number) => update((p) => ({ ...p, mpYears: v, difYears: Number((v - p.dcYears).toFixed(1)), difYearsManuallySet: false }));
  const setDcYears = (v: number) =>
    update((p) =>
      p.difYearsManuallySet ? { ...p, dcYears: v, mpYears: Number((p.difYears + v).toFixed(1)) } : { ...p, dcYears: v, difYears: Number((p.mpYears - v).toFixed(1)) },
    );
  const setDifYears = (v: number) => update((p) => ({ ...p, difYears: v, difYearsManuallySet: true, mpYears: Number((v + p.dcYears).toFixed(1)) }));
  const setMpPayment = (v: number) => update((p) => ({ ...p, mpPayment: v, savingAmt: v }));
  const setReturnRate = (v: number) => update((p) => ({ ...p, returnRate: v }));

  const series = useMemo(() => computeWealthGrowthSeries(s.savingAmt, s.difYears, s.returnRate), [s.savingAmt, s.difYears, s.returnRate]);
  const totalSaved = formatCurrency(series.totalSaved);

  return (
    <section className="py-8">
      <div className="rounded-card border border-teal/20 bg-white p-5 shadow-card">
        <div>
          <h2 className="text-xl font-bold text-deep">What happens to that same monthly payment once the debt is gone?</h2>
          <p className="mt-1 text-sm text-muted">Instead of sending it to the banks, see how your money could grow for you over time.</p>

          <h3 className="mt-4 text-lg font-bold text-deep">Debt-to-Wealth Growth Calculator</h3>
          <p className="mt-1 text-sm text-muted">See how fast your wealth can grow when you stop sending all your money to the banks and start investing it.</p>

          <h4 className="mt-4 text-sm font-bold uppercase tracking-wide text-teal">Your Debt Timeline</h4>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField label="Total debt you're dealing with" value={s.totalDebt} onChange={setTotalDebt} />
            <NumberField label="Years of minimum payments" value={s.mpYears} onChange={setMpYears} />
            <NumberField label="Years to become debt-free with DebtConquest" value={s.dcYears} onChange={setDcYears} />
          </div>

          <h4 className="mt-4 text-sm font-bold uppercase tracking-wide text-teal">Your Wealth Growth Plan</h4>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField label="Monthly amount you're sending now" value={s.mpPayment} onChange={setMpPayment} />
            <NumberField label="Expected years of saving after you're debt-free" value={s.difYears} onChange={setDifYears} />
            <NumberField label="Monthly amount invested after DebtConquest" value={s.savingAmt} onChange={setMpPayment} />
            <NumberField label="Expected yearly investment return (%)" value={s.returnRate} onChange={setReturnRate} />
            <label className="text-xs font-medium text-muted">
              Compounding frequency
              <select className="mt-1 w-full rounded-md border border-teal/40 px-2 py-1.5 text-sm text-deep" defaultValue="annually">
                <option value="annually">Annually</option>
              </select>
            </label>
          </div>

          <div className="mt-4 text-center">
            {/* Same as the client: pins the current "years of saving" value. */}
            <button type="button" onClick={() => setDifYears(s.difYears)} className="rounded-lg bg-teal px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-hover">
              Calculate My Wealth Growth
            </button>
          </div>
        </div>

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
                tooltip: { enabled: true, callbacks: { label: (ctx) => formatCurrency(Number(ctx.parsed.y)) } },
                datalabels: { align: "top", anchor: "end", color: "#0f2e2c", font: { size: 10, weight: "bold" }, formatter: (value: number) => formatCurrency(value) },
              },
              scales: { y: { beginAtZero: true, title: { display: true, text: "Projected Value ($)" } } },
            }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-card border border-teal/20 bg-white p-5 shadow-card">
        <p className="text-sm leading-relaxed text-muted">{wealthSummary(s.mpYears, s.dcYears, totalSaved)}</p>
        <p className="mt-3 text-sm font-semibold text-deep">In simple terms:</p>
        <p className="text-sm text-muted">the years that once held you back now become the years that push you forward.</p>
        <p className="mt-3 text-sm text-muted">
          Now take a moment and really picture it…
          <br />A future where you’re not fighting to catch up — you’re building something that lasts.
        </p>
        <p className="mt-3 text-sm font-semibold text-deep">With {totalSaved} growing in your name… what dream would you finally say yes to?</p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted">
          <li>A home?</li>
          <li>A business?</li>
          <li>Freedom to retire early?</li>
          <li>A legacy that your family will remember?</li>
        </ul>
        <p className="mt-3 text-sm font-semibold text-deep">This is the moment where your story begins to change.</p>
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs font-medium text-muted">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-md border border-teal/40 px-2 py-1.5 text-sm text-deep" />
    </label>
  );
}
