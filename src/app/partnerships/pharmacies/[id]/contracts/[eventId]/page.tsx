import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { formatPhone } from "@/lib/format";
import { ContractDocumentActions } from "@/components/contract-document-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; eventId: string }>;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Contract Created",
  updated: "Contract Updated",
  renewed: "Contract Renewed",
  verified: "Contract Verified",
  deleted: "Medication Removed",
};

interface SnapshotMed { medication: string; form: string; price: number }
interface ComparisonMed { medication: string; form: string; previousPrice: number | null; newPrice: number | null }

function parsePricingData(raw: string | null): { snapshot: SnapshotMed[]; comparison: ComparisonMed[]; effectiveFrom: string | null; effectiveThrough: string | null } {
  if (!raw) return { snapshot: [], comparison: [], effectiveFrom: null, effectiveThrough: null };
  try {
    const p = JSON.parse(raw);
    const snapshot: SnapshotMed[] = p.snapshot ?? [];
    let comparison: ComparisonMed[] = p.comparison ?? [];
    if (p.medication && comparison.length === 0 && snapshot.length === 0) {
      comparison = [{ medication: p.medication, form: "", previousPrice: p.oldPrice ?? null, newPrice: p.newPrice ?? null }];
    }
    return { snapshot, comparison, effectiveFrom: p.effectiveFrom ?? p.effectiveDate ?? null, effectiveThrough: p.effectiveThrough ?? null };
  } catch { return { snapshot: [], comparison: [], effectiveFrom: null, effectiveThrough: null }; }
}

export default async function ContractDocumentPage({ params }: Props) {
  const { id, eventId } = await params;

  const [pharmacy, log] = await Promise.all([
    prisma.pharmacy.findUnique({ where: { id }, select: { id: true, name: true, contactName: true, phone: true, email: true, fax: true } }),
    prisma.contractAuditLog.findUnique({ where: { id: eventId } }),
  ]);

  if (!pharmacy || !log || log.pharmacyId !== id) notFound();

  const eventLabel = ACTION_LABELS[log.actionType] ?? `Contract ${log.actionType}`;
  const { snapshot, comparison, effectiveFrom, effectiveThrough } = parsePricingData(log.changedFields);

  // Also get pharmacy-level verification data
  const pharmacyFull = await prisma.pharmacy.findUnique({
    where: { id },
    select: { contractVerifiedAt: true, contractVerifiedBy: true },
  });
  const hasComparison = comparison.length > 0;
  const hasSnapshot = snapshot.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar — not printed */}
      <div className="print:hidden border-b border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <a href={`/partnerships/pharmacies/${id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Back to {pharmacy.name}
        </a>
        <ContractDocumentActions />
      </div>

      {/* Document body */}
      <div className="max-w-3xl mx-auto px-8 py-8 print:px-0 print:py-0 print:max-w-none">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-gray-900">{pharmacy.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{eventLabel} &mdash; {log.performedAt.toLocaleDateString()}</p>
        </div>

        {/* Metadata + Contact — compact two-column */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] mb-5 pb-5 border-b border-gray-200">
          <div>
            <span className="text-gray-400 uppercase text-[10px] tracking-wider">Event Date</span>
            <p className="text-gray-700">{log.performedAt.toLocaleDateString()}</p>
          </div>
          {effectiveFrom && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Effective From</span>
              <p className="text-gray-700">{new Date(effectiveFrom).toLocaleDateString()}</p>
            </div>
          )}
          {effectiveThrough && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Effective Through</span>
              <p className="text-gray-700">{new Date(effectiveThrough).toLocaleDateString()}</p>
            </div>
          )}
          {pharmacyFull?.contractVerifiedAt && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Verified At</span>
              <p className="text-gray-700">{pharmacyFull.contractVerifiedAt.toLocaleDateString()}</p>
            </div>
          )}
          {pharmacyFull?.contractVerifiedBy && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Verified By</span>
              <p className="text-gray-700">{pharmacyFull.contractVerifiedBy}</p>
            </div>
          )}
          {log.performedBy && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Performed By</span>
              <p className="text-gray-700">{log.performedBy}</p>
            </div>
          )}
          {log.notes && (
            <div className="col-span-2">
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Notes</span>
              <p className="text-gray-700">{log.notes}</p>
            </div>
          )}

          {/* Contact inline */}
          {pharmacy.contactName && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Contact</span>
              <p className="text-gray-700">{pharmacy.contactName}</p>
            </div>
          )}
          {pharmacy.phone && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Phone</span>
              <p className="text-gray-700">{formatPhone(pharmacy.phone)}</p>
            </div>
          )}
          {pharmacy.email && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Email</span>
              <p className="text-gray-700">{pharmacy.email}</p>
            </div>
          )}
          {pharmacy.fax && (
            <div>
              <span className="text-gray-400 uppercase text-[10px] tracking-wider">Fax</span>
              <p className="text-gray-700">{formatPhone(pharmacy.fax)}</p>
            </div>
          )}
        </div>

        {/* Pricing — THE MAIN CONTENT */}
        {hasComparison ? (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pricing Changes</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 pr-4 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Previous</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">New</th>
                  <th className="text-right py-2 pl-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Difference</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c, i) => {
                  const diff = (c.previousPrice != null && c.newPrice != null) ? Math.round((c.newPrice - c.previousPrice) * 100) / 100 : null;
                  const unit = c.form ? getPricingUnit(c.form) : "";
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-900">
                        {c.medication}
                        {unit && <span className="text-[10px] text-gray-400 ml-1">/ {unit}</span>}
                        {c.previousPrice === null && <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded ml-1.5">New</span>}
                        {c.newPrice === null && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1 py-0.5 rounded ml-1.5">Removed</span>}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-gray-600">{c.previousPrice != null ? formatCurrency(c.previousPrice) : "\u2014"}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-gray-900">{c.newPrice != null ? formatCurrency(c.newPrice) : "\u2014"}</td>
                      <td className={`py-2 pl-2 text-right tabular-nums font-medium ${diff != null && diff > 0 ? "text-red-600" : diff != null && diff < 0 ? "text-green-600" : "text-gray-400"}`}>
                        {diff != null ? `${diff > 0 ? "+" : ""}${formatCurrency(diff)}` : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : hasSnapshot ? (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contract Pricing</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 pr-4 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                  <th className="text-left py-2 px-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Unit</th>
                  <th className="text-right py-2 pl-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Contract Price</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">{s.medication}</td>
                    <td className="py-2 px-2 text-gray-400">{getPricingUnit(s.form)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium text-gray-900">{formatCurrency(s.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No pricing data available for this event.</p>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400">
          Generated by Bisk &middot; {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
