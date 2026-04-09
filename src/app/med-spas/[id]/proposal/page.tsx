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

  // Parse pharmacy selections from URL: JSON-encoded { lineId: pharmacyId }
  let selections: Record<string, string> = {};
  if (sp.selections) {
    try { selections = JSON.parse(sp.selections); } catch { /* use defaults */ }
  }

  // Build proposal rows using program price as the proposed price
  const rows = spa.pricingComparison.map((line) => {
    const selectedId = selections[line.lineId] ?? line.pharmacyOptions[0]?.pharmacyId;
    const selected = line.pharmacyOptions.find((p) => p.pharmacyId === selectedId) ?? line.pharmacyOptions[0] ?? null;
    // Proposed price = program price (what we charge the med spa), NOT pharmacy cost
    const proposedPrice = line.programPrice;
    const unitSavings = proposedPrice != null ? Math.round((line.currentCost - proposedPrice) * 100) / 100 : null;
    const monthlySavings = unitSavings != null ? Math.round(unitSavings * line.monthlyQty * 100) / 100 : 0;
    const savingsPct = unitSavings != null && line.currentCost > 0 ? unitSavings / line.currentCost : 0;
    return {
      medicationName: line.medicationName,
      unit: line.unit,
      currentPrice: line.currentCost,
      proposedPrice,
      monthlyQty: line.monthlyQty,
      unitSavings,
      monthlySavings,
      savingsPct,
      pharmacy: selected?.pharmacyName ?? null,
    };
  }).filter((r) => r.proposedPrice != null);

  const currentMonthlySpend = rows.reduce((s, r) => s + r.currentPrice * r.monthlyQty, 0);
  const proposedMonthlySpend = rows.reduce((s, r) => s + (r.proposedPrice ?? 0) * r.monthlyQty, 0);
  const totalMonthlySavings = Math.round((currentMonthlySpend - proposedMonthlySpend) * 100) / 100;
  const overallSavingsPct = currentMonthlySpend > 0 ? Math.round((totalMonthlySavings / currentMonthlySpend) * 100) : 0;
  const hasSavings = totalMonthlySavings > 0;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-white -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 px-0">
      <style>{`nav { display: none !important; } main { padding: 0 !important; max-width: 100% !important; }`}</style>
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="border-b border-gray-200 pb-8 mb-8">
          <p className="text-indigo-600 font-semibold text-sm tracking-wider uppercase">Pricing Proposal</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Prepared for {spa.name}</h1>
          <p className="text-gray-500 mt-2">{today}</p>
          {hasSavings ? (
            <p className="text-gray-700 mt-4 text-[15px] leading-relaxed">
              We identified a <span className="font-semibold text-green-700">{overallSavingsPct}% cost reduction</span> across your current compounding medications.
            </p>
          ) : (
            <p className="text-gray-700 mt-4 text-[15px] leading-relaxed">
              Below is our proposed pricing across your current compounding medications.
            </p>
          )}
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="text-center">
            <p className="text-sm text-gray-500">Estimated Monthly Savings</p>
            <p className={`text-3xl font-bold mt-1 ${totalMonthlySavings > 0 ? "text-green-700" : totalMonthlySavings < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(totalMonthlySavings)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Estimated Annual Savings</p>
            <p className={`text-3xl font-bold mt-1 ${totalMonthlySavings > 0 ? "text-green-700" : totalMonthlySavings < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(totalMonthlySavings * 12)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Products in Scope</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{rows.length}</p>
          </div>
        </div>

        {/* Proposal table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-10">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Medication</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Price</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Proposed Price</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Monthly Savings</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pharmacy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const positive = row.monthlySavings > 0;
                const negative = row.monthlySavings < 0;
                return (
                  <tr key={idx} className={`border-b border-gray-100 ${positive ? "bg-green-50/30" : negative ? "bg-red-50/20" : idx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">{row.medicationName}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500">
                      {formatCurrency(row.currentPrice)} <span className="text-xs text-gray-400">/ {row.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(row.proposedPrice!)} <span className="text-xs font-normal text-gray-400">/ {row.unit}</span>
                    </td>
                    <td className={`px-5 py-3 text-right text-sm font-semibold ${positive ? "text-green-700" : negative ? "text-red-600" : "text-gray-400"}`}>
                      {formatCurrency(row.monthlySavings)}
                      {row.savingsPct !== 0 && <span className="text-xs font-normal opacity-70"> ({Math.round(row.savingsPct * 100)}%)</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.pharmacy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-10">
          <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex justify-between px-5 py-3">
              <span className="text-sm text-gray-600">Current Monthly Spend</span>
              <span className="text-sm text-gray-900">{formatCurrency(currentMonthlySpend)}</span>
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-sm text-gray-600">Proposed Monthly Spend</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(proposedMonthlySpend)}</span>
            </div>
            <div className={`flex justify-between px-5 py-3 ${hasSavings ? "bg-green-50/50" : ""}`}>
              <span className={`text-sm font-semibold ${hasSavings ? "text-green-800" : "text-gray-700"}`}>Estimated Monthly Savings</span>
              <span className={`text-sm font-bold ${totalMonthlySavings > 0 ? "text-green-700" : totalMonthlySavings < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(totalMonthlySavings)}</span>
            </div>
            <div className={`flex justify-between px-5 py-3 ${hasSavings ? "bg-green-50/50" : ""}`}>
              <span className={`text-sm font-semibold ${hasSavings ? "text-green-800" : "text-gray-700"}`}>Estimated Annual Savings</span>
              <span className={`text-sm font-bold ${totalMonthlySavings > 0 ? "text-green-700" : totalMonthlySavings < 0 ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(totalMonthlySavings * 12)}</span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="border border-indigo-200 rounded-lg overflow-hidden mb-10 bg-indigo-50/30">
          <div className="px-5 py-4 border-b border-indigo-100">
            <h2 className="text-sm font-semibold text-indigo-900">Next Steps</h2>
          </div>
          <div className="px-5 py-4">
            <ol className="space-y-2.5 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">1</span>
                <span>Confirm your interest in moving forward with the proposed pricing</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">2</span>
                <span>We handle all pharmacy coordination and onboarding on your behalf</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">3</span>
                <span>First orders can be fulfilled within <strong>3{"\u2013"}5 business days</strong></span>
              </li>
            </ol>
            <div className="mt-5 pt-4 border-t border-indigo-100">
              <p className="text-sm font-medium text-indigo-800">Ready to get started? Reply to this proposal or reach out to confirm and activate your pricing.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 pt-4 border-t border-gray-100 space-y-2">
          <p className="text-gray-500">Pricing based on current program rates across multiple U.S. compounding pharmacies.</p>
          <p>Prepared by <span className="font-medium text-indigo-600">Bisk</span></p>
          <p>This proposal is valid for 30 days from the date above.</p>
        </div>
      </div>
    </div>
  );
}
