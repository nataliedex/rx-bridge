import { notFound } from "next/navigation";
import Link from "next/link";
import { getMedication, getProviderPrices } from "@/lib/actions";
import { formatCurrency, formatPercent } from "@/lib/pricing";
import { MedicationPricingTable } from "@/components/medication-pricing-table";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MedicationDetailPage({ params }: Props) {
  const { id } = await params;
  const medication = await getMedication(id);
  if (!medication) notFound();
  const providerPrices = await getProviderPrices(id);

  // Split into active and historical
  const activePrices = medication.priceHistory
    .filter((p) => p.endDate === null)
    .sort((a, b) => a.price - b.price);
  const historicalPrices = medication.priceHistory
    .filter((p) => p.endDate !== null)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  const lowestPrice = activePrices.length > 0 ? activePrices[0].price : null;

  // Group history by pharmacy for the expandable view
  const historyByPharmacy: Record<string, typeof historicalPrices> = {};
  for (const entry of historicalPrices) {
    const key = entry.pharmacy.id;
    if (!historyByPharmacy[key]) historyByPharmacy[key] = [];
    historyByPharmacy[key].push(entry);
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/network" className="text-sm text-indigo-600 hover:underline">&larr; Back to Network</Link>
        <h1 className="text-2xl font-semibold mt-2">{medication.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{medication.form} &middot; {medication.strength}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MedicationPricingTable
            medicationId={medication.id}
            medicationName={medication.name}
            activePrices={activePrices.map((p) => ({
              id: p.id,
              price: p.price,
              effectiveDate: p.effectiveDate.toISOString(),
              notes: p.notes,
              pharmacy: { id: p.pharmacy.id, name: p.pharmacy.name },
            }))}
            historyByPharmacy={Object.fromEntries(
              Object.entries(historyByPharmacy).map(([k, entries]) => [
                k,
                entries.map((h) => ({
                  id: h.id,
                  price: h.price,
                  effectiveDate: h.effectiveDate.toISOString(),
                  endDate: h.endDate ? h.endDate.toISOString() : null,
                  notes: h.notes,
                })),
              ])
            )}
            providerPrice={providerPrices.length > 0 ? providerPrices[0].price : null}
          />
        </div>

        {/* Summary sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Summary</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Medication</p>
                <p className="text-sm font-medium">{medication.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Form</p>
                <p className="text-sm">{medication.form}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Strength</p>
                <p className="text-sm">{medication.strength}</p>
              </div>
              {providerPrices.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500">Provider Price</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(providerPrices[0].price)}</p>
                  <p className="text-xs text-gray-400">{providerPrices[0].provider.name}</p>
                </div>
              )}
              {lowestPrice !== null && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500">Best Pharmacy Cost</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(lowestPrice)}</p>
                  <p className="text-xs text-gray-400">{activePrices[0]?.pharmacy.name}</p>
                  {providerPrices.length > 0 && (() => {
                    const margin = providerPrices[0].price - lowestPrice;
                    const pct = providerPrices[0].price > 0 ? margin / providerPrices[0].price : 0;
                    return (
                      <p className={`text-xs font-medium mt-0.5 ${margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(margin)} margin ({formatPercent(pct)})
                      </p>
                    );
                  })()}
                </div>
              )}
              {historicalPrices.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-400">{historicalPrices.length} historical price record{historicalPrices.length !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
