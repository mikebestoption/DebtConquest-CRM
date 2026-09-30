// The customer calculator's own English copy, verbatim from apps/client/src/
// i18n/locales/en.json, so an agent reads exactly the words the customer
// does. Only the longer passages live here; short labels are inline.

export const NARRATIVE_HEADING = "What this actually means for you";

// narrative.first / narrative.second / narrative.third, split on their <br><br>.
export function firstNarrative(years: string, interest: string): string[] {
  return [
    `At your current pace, you’ll remain in debt for approximately ${years} years and pay an estimated ${interest} in interest alone.`,
    "With a structured debt resolution strategy, many people reduce that timeline to as little as 24–48 months.",
    "Scroll down to see what your minimum payments are actually costing you over time — for many people, it’s money that could have gone toward retirement or long-term security.",
  ];
}

export function secondNarrative(years: string, totalPay: string): string[] {
  return [
    `At your current pace, you’ll stay in debt for ${years} years and send over ${totalPay} to banks.`,
    "DebtConquest compresses that into just 36 months — with a clear finish line.",
  ];
}

export const THIRD_NARRATIVE = [
  "See it: The chart above shows your debt shrinking every month — not dragging on for decades, but moving steadily toward zero.",
  "Hear it: Imagine knowing exactly when your last payment is made — not “someday,” but a real month on the calendar.",
  "Feel it: That relief when the balance finally hits $0 — and the money that used to go to banks is yours again.",
];

// programCost.* labels and their info-icon explanations.
export const PROGRAM_COST_ROWS = {
  totalDebtEnrolled: {
    label: "Total Debt Enrolled:",
    tooltip: "The total amount of unsecured debt you entered above that will be included in the program.",
  },
  legalSupportIncluded: {
    label: "Legal Support Included?:",
    tooltip:
      "Debt resolution is a negotiation process, not bankruptcy. Creditors still have the right to try to collect. Most choose to settle because it’s faster and cheaper for them — but we include the optional legal plan so you’re protected no matter what. It just removes the stress and uncertainty.",
  },
  monthlyLegalFee: {
    label: "Monthly Legal Fee:",
    tooltip: "The monthly cost of the legal protection plan, added into your total monthly payment.",
  },
  estimatedTime: {
    label: "Estimated Time:",
    tooltip: "The estimated number of months needed to complete the program based on your budgeted monthly payment.",
  },
  programFee: {
    label: "Program Fee:",
    tooltip: "This pays for the negotiation service. It’s already included in your monthly payment — not an extra or separate fee.",
  },
  legalEnrollmentSetup: {
    label: "Legal Enrollment Setup:",
    tooltip:
      "This is a one-time setup fee for the legal protection service, not the debt settlement program. It covers the activation of your legal support team. This fee is already included within your monthly payment — it is not paid separately.",
  },
  enrollmentFeeSchedule: {
    label: "Enrollment Fee Schedule:",
    tooltip:
      "To make the program more affordable, the one-time legal service enrollment fee is divided into smaller amounts and included within your first couple of monthly payments, instead of being charged all at once. This keeps your monthly payment steady and predictable, with no upfront payment required.",
  },
  paymentFrequency: {
    label: "Payment Frequency:",
    tooltip:
      "Your payment is debited once per month on the date you choose when your program begins. You can change your payment date at any time if your income timing or budget changes — this helps you avoid unnecessary overdraft/NSF fees and keeps the program comfortable and predictable.",
  },
  trustAccountFee: {
    label: "Trust Account Fee:",
    tooltip:
      "This covers the cost of the dedicated savings account used to securely build funds for your settlements. This fee is included inside your monthly payment, so nothing is billed separately by the bank.",
  },
  estimatedSettlementAmount: {
    label: "Estimated Settlement Amount:",
    tooltip:
      "This shows how much you would pay to resolve your enrolled debt once negotiations are completed — for example, $15,000 in debt may be settled for about $8,000 total.",
  },
  totalDebtResolutionFees: {
    label: "Total Debt Resolution Fees:",
    tooltip: "The total cost of the services included in your program. Already built into your monthly payment — no separate or upfront fees.",
  },
  totalTrustAccountFees: {
    label: "Total Trust Account Fees:",
    tooltip:
      "The total cost of the dedicated program account managed by the servicing bank over the duration of your program. This is already built into your monthly payment — it is not charged separately.",
  },
  totalLegalSupportFee: {
    label: "Total Legal Support Fee:",
    tooltip: "The total cost of legal support fee for the duration of the program. It is already included in your monthly payment.",
  },
  totalEstimatedProgramCost: {
    label: "Total Estimated Program Cost:",
    tooltip:
      "Your total cost to complete the program, which includes your settlement amounts, service fees, and bank account fees. All of these costs are already built into your single monthly payment — there are no separate or upfront charges.",
  },
  totalEstimatedSavings: {
    label: "Total Estimated Savings:",
    tooltip: "The difference between your enrolled debt amount and your total estimated program cost.",
  },
  monthlyPayments: {
    label: "Monthly Payments:",
    tooltip:
      "This is the monthly amount you’ll deposit into your dedicated program account. It includes everything — your settlements, the negotiation service fee, the legal protection service fee (if selected), and the bank account fee.",
  },
} as const;

export type ProgramCostRowId = keyof typeof PROGRAM_COST_ROWS;

export function wealthSummary(mpYears: number, dcYears: number, totalSaved: string): string {
  return `When you finally stop pouring your hard-earned money into debt, something powerful happens: your future opens up. Instead of spending ${mpYears} years paying the banks, you free yourself in just ${dcYears} years — and then every dollar you used to send away becomes a dollar building your wealth. By redirecting the same monthly payment into your investments, your savings can grow to over ${totalSaved}.`;
}

export const FOOTNOTES = [
  "Simulation is month-by-month. Interest accrues first, minimums are applied to all open debts, then any remaining budget is applied by your chosen method (Snowball = smallest balance first; Avalanche = highest APR first).",
  "If your budget is below the total minimums, the tool will automatically use at least the minimums to avoid negative amortization.",
  "For simplicity, fees and new charges are not included.",
];

export const DISCLAIMER =
  "This tool is for education purposes only. We do not provide financial advice, tax advice, or any form of professional financial or tax guidance. Debt settlement results vary by person and situation, and there are no guarantees of successfully settling, reducing, or eliminating any debts. Estimates shown are simulations based on general formulas and may not reflect real-world lender policies, payoff amounts, outcomes, tax implications, or creditor rules. Always verify key details and consult qualified professionals before making decisions, including speaking with a Certified Public Accountant (CPA). This is not tax advice. Consult a licensed Certified Public Accountant.";
