import { notFound } from "next/navigation";
import { getProposalById, markProposalViewed } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { ProposalAcceptButton } from "@/components/proposal-accept-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

interface SnapshotRow {
  medicationName: string;
  currentCost: number;
  proposedPrice: number | null;
  unitSavings: number | null;
  monthlyQty: number;
  pharmacyName: string | null;
}

export default async function PublicProposalPage({ params }: Props) {
  const { id } = await params;
  const proposal = await getProposalById(id);
  if (!proposal) notFound();

  // Mark as viewed
  if (!proposal.viewedAt) {
    await markProposalViewed(id);
  }

  const spa = proposal.medSpa;
  let rows: SnapshotRow[] = [];
  try { rows = JSON.parse(proposal.pricingSnapshot); } catch { /* empty */ }

  const totalMonthlySavings = rows.reduce((s, r) => s + (r.unitSavings ?? 0) * r.monthlyQty, 0);
  const isAccepted = proposal.status === "accepted";
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-white">
      <style>{`nav { display: none !important; } main { padding: 0 !important; max-width: 100% !important; }`}</style>
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="border-b border-gray-200 pb-8 mb-8">
          <p className="text-indigo-600 font-semibold text-sm tracking-wider uppercase">Pricing Proposal</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Prepared for {spa.name}</h1>
          <p className="text-gray-500 mt-2">
            {proposal.sentAt ? new Date(proposal.sentAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : today}
          </p>
          {proposal.message && (
            <p className="text-gray-700 mt-4 text-[15px] leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100">{proposal.message}</p>
          )}
        </div>

        {/* Headline savings */}
        {totalMonthlySavings > 0 && (
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="text-center">
              <p className="text-sm text-gray-500">Estimated Monthly Savings</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(totalMonthlySavings)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Estimated Annual Savings</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(totalMonthlySavings * 12)}</p>
            </div>
          </div>
        )}

        {/* Pricing table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-10">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Medication</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Price</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Proposed Price</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Monthly Savings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const ms = (row.unitSavings ?? 0) * row.monthlyQty;
                return (
                  <tr key={idx} className={`border-b border-gray-100 ${ms > 0 ? "bg-green-50/30" : idx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">{row.medicationName}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500 tabular-nums">{formatCurrency(row.currentCost)}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-gray-900 tabular-nums">
                      {row.proposedPrice != null ? formatCurrency(row.proposedPrice) : "\u2014"}
                    </td>
                    <td className={`px-5 py-3 text-right text-sm font-semibold tabular-nums ${ms > 0 ? "text-green-700" : ms < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {formatCurrency(ms)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Accept / Status */}
        {isAccepted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center mb-10">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 text-xl">{"\u2713"}</span>
            </div>
            <h2 className="text-lg font-bold text-green-800">Pricing Confirmed</h2>
            <p className="text-sm text-green-700 mt-1">We{"\u2019"}ll begin onboarding and have your first order ready within 3{"\u2013"}5 business days.</p>
          </div>
        ) : (
          <div className="bg-indigo-50/30 border border-indigo-200 rounded-lg p-6 text-center mb-10">
            <h2 className="text-lg font-semibold text-gray-900">Ready to move forward?</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">Accept this proposal to lock in your pricing and begin onboarding.</p>
            <ProposalAcceptButton proposalId={id} />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 pt-4 border-t border-gray-100 space-y-2">
          <p className="text-gray-500">Pricing based on current network rates across multiple U.S. compounding pharmacies.</p>
          <p>Prepared by <span className="font-medium text-indigo-600">Bisk</span></p>
          <p>This proposal is valid for 30 days from the date above.</p>
        </div>
      </div>
    </div>
  );
}
