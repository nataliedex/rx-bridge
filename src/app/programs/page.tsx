import { getPrograms, getAllBrandsForAdmin, getNetworkPharmacies } from "@/lib/actions";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS, type ProgramStatus } from "@/lib/types";
import { ProgramFilters } from "@/components/program-filters";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; brand?: string; pharmacy?: string; status?: string }>;
}

export default async function ProgramsPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const brandFilter = params.brand || "";
  const pharmacyFilter = params.pharmacy || "";
  const statusFilter = params.status || "all";

  const [programs, brands, pharmacies] = await Promise.all([
    getPrograms({ search: search || undefined, brandId: brandFilter || undefined, pharmacyId: pharmacyFilter || undefined, status: statusFilter }),
    getAllBrandsForAdmin(),
    getNetworkPharmacies(),
  ]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-semibold">Programs</h1>
            <p className="text-sm text-gray-500 mt-1">
              {programs.length} pricing program{programs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <a href="/programs/new" className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">
            Create Program
          </a>
        </div>

        <ProgramFilters
          currentSearch={search}
          currentBrand={brandFilter}
          currentPharmacy={pharmacyFilter}
          currentStatus={statusFilter}
          brands={brands.map((b) => ({ id: b.id, name: b.name }))}
          pharmacies={pharmacies}
        />
      </div>

      {programs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No programs match these filters.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[1.2]">Brand</div>
            <div className="px-4 py-2.5 flex-[1.2]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[1.5]">Medication</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Negotiated Rate</div>
            <div className="px-4 py-2.5 flex-[1]">Effective Dates</div>
            <div className="px-4 py-2.5 flex-[0.6] text-center">Status</div>
            <div className="px-4 py-2.5 flex-[1]">Reference Code</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {programs.map((p, idx) => {
              const status = p.status as ProgramStatus;
              return (
                <div key={p.id}
                  className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                  <div className="px-4 py-2.5 flex-[1.2] text-[13px] text-gray-900 truncate">{p.brand.name}</div>
                  <div className="px-4 py-2.5 flex-[1.2] text-[13px] text-gray-600 truncate">{p.pharmacy.name}</div>
                  <div className="px-4 py-2.5 flex-[1.5] text-[13px] text-gray-900 truncate">{p.medication.name}</div>
                  <div className="px-4 py-2.5 flex-[0.7] text-right text-[13px] font-medium text-gray-900">
                    {formatCurrency(p.negotiatedRate)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(p.medication.form)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex-[1] text-[12px] text-gray-500">
                    {new Date(p.effectiveStart).toLocaleDateString()} — {p.effectiveEnd ? new Date(p.effectiveEnd).toLocaleDateString() : "Ongoing"}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.6] text-center">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${PROGRAM_STATUS_COLORS[status]}`}>
                      {PROGRAM_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex-[1] text-[12px] font-mono text-indigo-600 truncate">
                    {p.referenceCode}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
