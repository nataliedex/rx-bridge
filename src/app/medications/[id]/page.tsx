import { notFound } from "next/navigation";
import Link from "next/link";
import { getMedication } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { formatCurrency, formatPercent, getPricingUnit } from "@/lib/pricing";
import { MedicationPricingTable } from "@/components/medication-pricing-table";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const FRESH_DAYS = 30;
const AGING_DAYS = 60;

type HealthStatus = "fresh" | "aging" | "stale";

function classifyFreshness(verifiedAt: Date | null): HealthStatus {
  if (!verifiedAt) return "stale";
  const days = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (days > AGING_DAYS) return "stale";
  if (days > FRESH_DAYS) return "aging";
  return "fresh";
}

export default async function MedicationDetailPage({ params }: Props) {
  const { id } = await params;
  const [medication, allPharmacies] = await Promise.all([
    getMedication(id),
    prisma.pharmacy.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!medication) notFound();

  const sellPrice = medication.sellPrice;

  const activePrices = medication.priceHistory
    .filter((p) => p.endDate === null)
    .sort((a, b) => a.price - b.price);
  const historicalPrices = medication.priceHistory
    .filter((p) => p.endDate !== null)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  const lowestPrice = activePrices.length > 0 ? activePrices[0].price : null;

  // Pricing health — per-pharmacy breakdown
  const freshPharmacies: string[] = [];
  const agingPharmacies: string[] = [];
  const stalePharmacies: string[] = [];
  const pricedPharmacyIds = new Set<string>();

  for (const p of activePrices) {
    pricedPharmacyIds.add(p.pharmacy.id);
    const status = classifyFreshness(p.verifiedAt);
    if (status === "fresh") freshPharmacies.push(p.pharmacy.name);
    else if (status === "aging") agingPharmacies.push(p.pharmacy.name);
    else stalePharmacies.push(p.pharmacy.name);
  }

  const missingPharmacies = allPharmacies
    .filter((ph) => !pricedPharmacyIds.has(ph.id))
    .map((ph) => ph.name);

  const freshCount = freshPharmacies.length;
  const agingCount = agingPharmacies.length;
  const staleCount = stalePharmacies.length;
  const missingCount = missingPharmacies.length;
  const hasIssues = staleCount + agingCount + missingCount > 0;

  const historyByPharmacy: Record<string, typeof historicalPrices> = {};
  for (const entry of historicalPrices) {
    const key = entry.pharmacy.id;
    if (!historyByPharmacy[key]) historyByPharmacy[key] = [];
    historyByPharmacy[key].push(entry);
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/medications" className="text-sm text-indigo-600 hover:underline">&larr; Back to Medications</Link>
        <h1 className="text-2xl font-semibold mt-2">{medication.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{medication.form} &middot; {medication.strength}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pricing health summary */}
          <div className={`border rounded-lg ${hasIssues ? "bg-amber-50/50 border-amber-200" : "bg-green-50/50 border-green-200"}`}>
            <details className="group">
              <summary className="p-4 cursor-pointer select-none list-none">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-medium ${hasIssues ? "text-amber-800" : "text-green-800"}`}>
                        Pricing Health
                      </h3>
                      <span className="text-[10px] text-gray-400 group-open:hidden">Show breakdown</span>
                      <span className="text-[10px] text-gray-400 hidden group-open:inline">Hide breakdown</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[12px] text-gray-600">
                        <span className="font-medium text-green-700">{freshCount}</span> fresh
                      </span>
                      {agingCount > 0 && (
                        <span className="text-[12px] text-amber-600 font-medium">
                          {agingCount} aging
                        </span>
                      )}
                      {staleCount > 0 && (
                        <span className="text-[12px] text-red-600 font-medium">
                          {staleCount} stale
                        </span>
                      )}
                      {missingCount > 0 && (
                        <span className="text-[12px] text-amber-600 font-medium">
                          {missingCount} missing
                        </span>
                      )}
                    </div>
                  </div>
                  {hasIssues && (
                    <Link href={`/medications/audit?medication=${medication.id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0">
                      Open Pricing Audit
                    </Link>
                  )}
                </div>
              </summary>

              {/* Per-pharmacy breakdown */}
              <div className="px-4 pb-4 pt-1 border-t border-gray-200/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {freshCount > 0 && (
                    <div>
                      <p className="text-green-700 font-medium mb-0.5">Fresh ({freshCount})</p>
                      <p className="text-gray-600 leading-relaxed">{freshPharmacies.join(", ")}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Verified within {FRESH_DAYS} days</p>
                    </div>
                  )}
                  {agingCount > 0 && (
                    <div>
                      <p className="text-amber-600 font-medium mb-0.5">Aging ({agingCount})</p>
                      <p className="text-gray-600 leading-relaxed">{agingPharmacies.join(", ")}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Verified {FRESH_DAYS}–{AGING_DAYS} days ago</p>
                    </div>
                  )}
                  {staleCount > 0 && (
                    <div>
                      <p className="text-red-600 font-medium mb-0.5">Stale ({staleCount})</p>
                      <p className="text-gray-600 leading-relaxed">{stalePharmacies.join(", ")}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Not verified in over {AGING_DAYS} days, or never verified</p>
                    </div>
                  )}
                  {missingCount > 0 && (
                    <div>
                      <p className="text-amber-600 font-medium mb-0.5">Missing ({missingCount})</p>
                      <p className="text-gray-600 leading-relaxed">{missingPharmacies.join(", ")}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">No pricing set for this pharmacy</p>
                    </div>
                  )}
                </div>
              </div>
            </details>
          </div>

          <MedicationPricingTable
            medicationId={medication.id}
            medicationName={medication.name}
            medicationForm={medication.form}
            activePrices={activePrices.map((p) => ({
              id: p.id,
              price: p.price,
              effectiveDate: p.effectiveDate.toISOString(),
              verifiedAt: p.verifiedAt?.toISOString() ?? null,
              freshness: classifyFreshness(p.verifiedAt),
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
            sellPrice={sellPrice}
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
              {sellPrice != null && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500">Sell Price</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(sellPrice)} <span className="text-sm font-normal text-gray-400">/ {getPricingUnit(medication.form)}</span></p>
                </div>
              )}
              {lowestPrice !== null && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500">Best Pharmacy Cost</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(lowestPrice)} <span className="text-sm font-normal text-gray-400">/ {getPricingUnit(medication.form)}</span></p>
                  <p className="text-xs text-gray-400">{activePrices[0]?.pharmacy.name}</p>
                  {sellPrice != null && (() => {
                    const margin = sellPrice - lowestPrice;
                    const pct = sellPrice > 0 ? margin / sellPrice : 0;
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

          <Link href={`/medications/audit?medication=${medication.id}`}
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-indigo-600">View Pricing Audit</p>
            <p className="text-xs text-gray-500 mt-0.5">Check freshness and verify prices across pharmacies</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
