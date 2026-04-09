import Link from "next/link";
import { getMedications, getNetworkPharmacies } from "@/lib/actions";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { NetworkFilters } from "@/components/network-filters";
import { MedicationActions } from "@/components/network-actions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; pharmacy?: string }>;
}

export default async function MedicationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const pharmacyFilter = params.pharmacy || "";

  const [medications, pharmacies] = await Promise.all([
    getMedications(search || undefined, pharmacyFilter || undefined),
    getNetworkPharmacies(),
  ]);

  const hasFilters = search || pharmacyFilter;
  const selectedPharmacy = pharmacies.find((p) => p.id === pharmacyFilter);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      {/* Fixed controls */}
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Medications</h1>
            <p className="text-sm text-gray-500 mt-1">
              {medications.length} medication{medications.length !== 1 ? "s" : ""}
              {selectedPharmacy ? ` at ${selectedPharmacy.name}` : " in catalog"}
            </p>
          </div>
          <MedicationActions />
        </div>

        <NetworkFilters currentSearch={search} currentPharmacy={pharmacyFilter} pharmacies={pharmacies} />
      </div>

      {/* Data grid */}
      {medications.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <div className="text-center">
            <p className="text-gray-400">{hasFilters ? "No medications match these filters." : "No medications in the catalog yet."}</p>
            {hasFilters && <Link href="/medications" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Clear filters</Link>}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Medication</div>
            <div className="px-4 py-2.5 flex-[0.6] text-center">Pharmacies</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">{selectedPharmacy ? "Your Cost" : "Lowest Cost"}</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Client Price</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Your Profit</div>
            <div className="px-4 py-2.5 flex-[0.8] text-center">Status</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {medications.map((med, idx) => {
              const issues = med.staleCount + med.agingCount + med.missingCount;
              const noSellPrice = med.programPrice == null;
              return (
                <Link
                  key={med.id}
                  href={`/medications/${med.id}`}
                  className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors duration-100 cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                >
                  <div className="px-4 py-2.5 flex-[2] text-[13px] font-semibold text-gray-900 truncate">{med.name}</div>
                  <div className="px-4 py-2.5 flex-[0.6] text-center text-[13px] text-gray-400">{med.pharmacyCount}</div>
                  <div className="px-4 py-2.5 flex-[0.8] text-right text-[13px] font-medium text-gray-900">
                    {med.lowestPrice !== null ? <>{formatCurrency(med.lowestPrice)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(med.form)}</span></> : <span className="text-gray-300">—</span>}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.7] text-right text-[13px] text-gray-700">
                    {med.programPrice != null ? <>{formatCurrency(med.programPrice)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(med.form)}</span></> : <span className="text-gray-300">—</span>}
                  </div>
                  <div className={`px-4 py-2.5 flex-[0.7] text-right text-[13px] font-medium ${med.bestMargin != null && med.bestMargin >= 0 ? "text-green-700" : med.bestMargin != null ? "text-red-600" : ""}`}>
                    {med.bestMargin != null ? formatCurrency(med.bestMargin) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.8] text-center">
                    {issues === 0 && !noSellPrice ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">OK</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                        {noSellPrice && <span>No client price</span>}
                        {!noSellPrice && med.missingCount > 0 && <span>{med.missingCount} missing</span>}
                        {!noSellPrice && med.missingCount === 0 && (med.staleCount + med.agingCount) > 0 && <span>{med.staleCount + med.agingCount} stale</span>}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
