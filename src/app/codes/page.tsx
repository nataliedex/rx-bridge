import { getReferenceCodes } from "@/lib/actions";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS, type ProgramStatus } from "@/lib/types";
import { CodeFilters } from "@/components/code-filters";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export default async function ReferencCodesPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";

  const codes = await getReferenceCodes(search || undefined);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>
      <div className="shrink-0">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold">Reference Codes</h1>
          <p className="text-sm text-gray-500 mt-1">{codes.length} code{codes.length !== 1 ? "s" : ""} across all programs</p>
        </div>

        <CodeFilters currentSearch={search} />
      </div>

      {codes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">{search ? "No codes match this search." : "No reference codes yet."}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[1.2]">Code</div>
            <div className="px-4 py-2.5 flex-[1]">Brand</div>
            <div className="px-4 py-2.5 flex-[1.3]">Medication</div>
            <div className="px-4 py-2.5 flex-[1]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[0.6] text-right">Rate</div>
            <div className="px-4 py-2.5 flex-[0.5] text-center">Status</div>
            <div className="px-4 py-2.5 flex-[0.8]">Expiration</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {codes.map((c, idx) => {
              const status = c.status as ProgramStatus;
              return (
                <div key={c.id}
                  className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                  <div className="px-4 py-2.5 flex-[1.2] text-[13px] font-mono text-indigo-600 truncate">{c.referenceCode}</div>
                  <div className="px-4 py-2.5 flex-[1] text-[13px] text-gray-900 truncate">{c.brand.name}</div>
                  <div className="px-4 py-2.5 flex-[1.3] text-[13px] text-gray-600 truncate">{c.medication.name}</div>
                  <div className="px-4 py-2.5 flex-[1] text-[13px] text-gray-600 truncate">{c.pharmacy.name}</div>
                  <div className="px-4 py-2.5 flex-[0.6] text-right text-[13px] font-medium text-gray-900">
                    {formatCurrency(c.negotiatedRate)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(c.medication.form)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex-[0.5] text-center">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${PROGRAM_STATUS_COLORS[status]}`}>
                      {PROGRAM_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex-[0.8] text-[12px] text-gray-500">
                    {c.effectiveEnd ? new Date(c.effectiveEnd).toLocaleDateString() : "No expiration"}
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
