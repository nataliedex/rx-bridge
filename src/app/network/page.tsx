import Link from "next/link";
import { getMedications, getNetworkPharmacies } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { NetworkFilters } from "@/components/network-filters";
import { NetworkActions } from "@/components/network-actions";
import { NetworkTabs } from "@/components/network-tabs";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; pharmacy?: string }>;
}

export default async function NetworkPage({ searchParams }: Props) {
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
            <h1 className="text-2xl font-semibold">Network</h1>
            <p className="text-sm text-gray-500 mt-1">
              {medications.length} medication{medications.length !== 1 ? "s" : ""}
              {selectedPharmacy ? ` at ${selectedPharmacy.name}` : " across pharmacy network"}
            </p>
          </div>
          <NetworkActions />
        </div>

        <NetworkTabs />

        <NetworkFilters currentSearch={search} currentPharmacy={pharmacyFilter} pharmacies={pharmacies} />
      </div>

      {/* Data grid */}
      {medications.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <div className="text-center">
            <p className="text-gray-400">{hasFilters ? "No medications match these filters." : "No medications in the network yet."}</p>
            {hasFilters && <Link href="/network" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Clear filters</Link>}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Medication</div>
            <div className="px-4 py-2.5 flex-[1]">Form</div>
            <div className="px-4 py-2.5 flex-[1]">Strength</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Pharmacies</div>
            <div className="px-4 py-2.5 flex-[1] text-right">{selectedPharmacy ? "Price" : "Lowest Price"}</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {medications.map((med, idx) => (
              <Link
                key={med.id}
                href={`/network/${med.id}`}
                className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors duration-100 cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
              >
                <div className="px-4 py-2.5 flex-[2] text-[13px] font-semibold text-gray-900 truncate">{med.name}</div>
                <div className="px-4 py-2.5 flex-[1] text-[13px] text-gray-500 truncate">{med.form}</div>
                <div className="px-4 py-2.5 flex-[1] text-[13px] text-gray-500 truncate">{med.strength}</div>
                <div className="px-4 py-2.5 flex-[0.7] text-center text-[13px] text-gray-400">{med.pharmacyCount}</div>
                <div className="px-4 py-2.5 flex-[1] text-right text-[13px] font-medium text-gray-900">
                  {med.lowestPrice !== null ? formatCurrency(med.lowestPrice) : "—"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
