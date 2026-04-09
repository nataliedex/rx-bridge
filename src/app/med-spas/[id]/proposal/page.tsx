import { notFound } from "next/navigation";
import { getMedSpaDetail } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ selections?: string }>;
}

export default async function ProposalPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const spa = await getMedSpaDetail(id);
  if (!spa) notFound();

  let selections: Record<string, string> = {};
  if (sp.selections) {
    try { selections = JSON.parse(sp.selections); } catch { /* use defaults */ }
  }

  const rows = spa.pricingComparison.map((line) => {
    const selectedId = selections[line.lineId] ?? line.pharmacyOptions[0]?.pharmacyId;
    const selected = line.pharmacyOptions.find((p) => p.pharmacyId === selectedId) ?? line.pharmacyOptions[0] ?? null;
    const proposedPrice = line.programPrice;
    const unitSavings = proposedPrice != null ? Math.round((line.currentCost - proposedPrice) * 100) / 100 : null;
    const monthlySavings = unitSavings != null ? Math.round(unitSavings * line.monthlyQty * 100) / 100 : 0;
    return {
      medicationName: line.medicationName,
      unit: line.unit,
      currentPrice: line.currentCost,
      proposedPrice,
      monthlyQty: line.monthlyQty,
      unitSavings,
      monthlySavings,
      pharmacy: selected?.pharmacyName ?? null,
    };
  }).filter((r) => r.proposedPrice != null);

  const currentMonthlySpend = rows.reduce((s, r) => s + r.currentPrice * r.monthlyQty, 0);
  const proposedMonthlySpend = rows.reduce((s, r) => s + (r.proposedPrice ?? 0) * r.monthlyQty, 0);
  const totalMonthlySavings = Math.round((currentMonthlySpend - proposedMonthlySpend) * 100) / 100;
  const overallSavingsPct = currentMonthlySpend > 0 ? Math.round((totalMonthlySavings / currentMonthlySpend) * 100) : 0;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`nav { display: none !important; } main { padding: 0 !important; max-width: 100% !important; }`}</style>

      <div className="max-w-[600px] mx-auto px-6 py-8 sm:py-12">

        {/* Memo header */}
        <div className="pb-4 border-b-2 border-gray-900 mb-8 flex items-baseline justify-between">
          <span className="text-xl font-bold tracking-tight text-gray-900" style={{ letterSpacing: "-0.5px" }}>Bisk</span>
          <span className="text-[13px] text-gray-400">Pricing Proposal</span>
        </div>

        {/* Proposal details */}
        <div className="mb-8">
          <div className="text-[14px] font-semibold text-gray-900 mb-3">Proposal Details</div>
          <table className="text-[14px]">
            <tbody>
              <tr>
                <td className="py-1 pr-6 text-[12px] text-gray-400 align-top" style={{ width: "100px" }}>Prepared for</td>
                <td className="py-1 text-gray-900 font-medium">{spa.name}</td>
              </tr>
              <tr>
                <td className="py-1 pr-6 text-[12px] text-gray-400 align-top">Date</td>
                <td className="py-1 text-gray-900 font-medium">{today}</td>
              </tr>
              <tr>
                <td className="py-1 pr-6 text-[12px] text-gray-400 align-top">Products</td>
                <td className="py-1 text-gray-900 font-medium">{rows.length} medication{rows.length !== 1 ? "s" : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Outcome statement */}
        <div className="mb-8">
          <p className="text-[14px] text-gray-500 leading-relaxed">
            Based on current purchasing, we{"\u2019"}ve identified a <span className="font-semibold text-gray-900">{overallSavingsPct}% cost reduction</span> across
            {" "}{rows.length} medication{rows.length !== 1 ? "s" : ""} using Bisk{"\u2019"}s preferred compounding pharmacy network {"\u2014"} with no changes to your current workflow.
          </p>
        </div>

        {/* Summary metrics */}
        <div className="mb-8 flex gap-8">
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Monthly Savings</div>
            <div className="text-[20px] font-bold text-gray-900 mt-0.5">{formatCurrency(totalMonthlySavings)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Annual Savings</div>
            <div className="text-[20px] font-bold text-gray-900 mt-0.5">{formatCurrency(totalMonthlySavings * 12)}</div>
          </div>
        </div>

        {/* Pricing comparison table */}
        <div className="mb-8">
          <div className="text-[14px] font-semibold text-gray-900 mb-3">Pricing Comparison</div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">Medication</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">Current</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">Proposed</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">Savings</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-[14px] text-gray-900 border-b border-gray-100">{row.medicationName}</td>
                    <td className="px-3 py-2 text-right text-[14px] text-gray-900 border-b border-gray-100 tabular-nums">
                      {formatCurrency(row.currentPrice)}
                      <span className="text-[11px] text-gray-400 ml-0.5">/ {row.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-[14px] text-gray-900 font-medium border-b border-gray-100 tabular-nums">
                      {formatCurrency(row.proposedPrice!)}
                      <span className="text-[11px] text-gray-400 font-normal ml-0.5">/ {row.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-[14px] text-gray-900 font-medium border-b border-gray-100 tabular-nums">
                      {formatCurrency(row.monthlySavings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial summary */}
        <div className="mb-8">
          <div className="text-[14px] font-semibold text-gray-900 mb-3">Summary</div>
          <table className="text-[14px] w-full" style={{ maxWidth: "320px" }}>
            <tbody>
              <tr>
                <td className="py-1.5 text-gray-400">Current Monthly Spend</td>
                <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums">{formatCurrency(currentMonthlySpend)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-400">Projected Monthly Spend</td>
                <td className="py-1.5 text-right text-gray-900 font-medium tabular-nums">{formatCurrency(proposedMonthlySpend)}</td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="pt-2.5 pb-1.5 text-gray-900 font-semibold">Monthly Savings</td>
                <td className="pt-2.5 pb-1.5 text-right text-gray-900 font-bold tabular-nums">{formatCurrency(totalMonthlySavings)}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-900 font-semibold">Annual Savings</td>
                <td className="py-1.5 text-right text-gray-900 font-bold tabular-nums">{formatCurrency(totalMonthlySavings * 12)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* How it works */}
        <div className="mb-8">
          <div className="text-[14px] font-semibold text-gray-900 mb-3">How It Works</div>
          <table className="text-[14px]">
            <tbody>
              <tr>
                <td className="py-1.5 pr-4 text-[12px] text-gray-400 align-top font-semibold" style={{ width: "24px" }}>1</td>
                <td className="py-1.5 text-gray-500">We negotiate preferred pricing across a network of licensed compounding pharmacies.</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 text-[12px] text-gray-400 align-top font-semibold">2</td>
                <td className="py-1.5 text-gray-500">You access those rates with no changes to your ordering workflow.</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 text-[12px] text-gray-400 align-top font-semibold">3</td>
                <td className="py-1.5 text-gray-500">Bisk handles pharmacy coordination, onboarding, and ongoing fulfillment.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Next steps */}
        <div className="mb-8">
          <div className="text-[14px] font-semibold text-gray-900 mb-3">Next Steps</div>
          <p className="text-[14px] text-gray-500 leading-relaxed">
            Confirm your interest in moving forward. Bisk will handle onboarding and coordination {"\u2014"} orders can begin within 3{"\u2013"}5 business days.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200 text-[11px] text-gray-400">
          Pricing proposal generated via Bisk {"\u00B7"} {today} {"\u00B7"} Valid for 30 days
        </div>

      </div>
    </div>
  );
}
