import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrandDetail } from "@/lib/actions";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { BrandContactCard } from "@/components/brand-contact-card";
import { PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS, type ProgramStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BrandDetailPage({ params }: Props) {
  const { id } = await params;
  const brand = await getBrandDetail(id);
  if (!brand) notFound();

  const activePrograms = brand.programs.filter((p) => p.status === "active");
  const referenceCodes = [...new Set(brand.programs.map((p) => p.referenceCode))];

  return (
    <div>
      <div className="mb-6">
        <Link href="/partnerships/brands" className="text-sm text-indigo-600 hover:underline">&larr; Back to Brands</Link>
        <h1 className="text-2xl font-semibold mt-2">{brand.name}</h1>
        {!brand.active && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 ml-2">Inactive</span>
        )}
        {brand.notes && <p className="text-sm text-gray-500 mt-1">{brand.notes}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Programs */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-medium text-gray-900">Programs</h2>
              <p className="text-xs text-gray-500 mt-0.5">{brand.programs.length} program{brand.programs.length !== 1 ? "s" : ""}</p>
            </div>
            {brand.programs.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No programs yet.</div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Rate</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {brand.programs.map((p, idx) => {
                    const status = p.status as ProgramStatus;
                    return (
                      <tr key={p.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                        <td className="px-4 py-2.5 text-[13px] text-gray-900">{p.medication.name}</td>
                        <td className="px-4 py-2.5 text-[13px] text-gray-600">
                          <Link href={`/partnerships/pharmacies/${p.pharmacyId}`} className="hover:text-indigo-600">{p.pharmacy.name}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900">
                          {formatCurrency(p.negotiatedRate)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(p.medication.form)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] font-mono text-indigo-600">{p.referenceCode}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${PROGRAM_STATUS_COLORS[status]}`}>
                            {PROGRAM_STATUS_LABELS[status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Fill Activity */}
          {brand.fillRecords.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-medium text-gray-900">Recent Fill Activity</h2>
                <p className="text-xs text-gray-500 mt-0.5">Last {brand.fillRecords.length} fills</p>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Expected</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Actual</th>
                    <th className="px-4 py-2 text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {brand.fillRecords.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-[12px] text-gray-500">{new Date(r.fillDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-[13px] text-gray-900">{r.medication.name}</td>
                      <td className="px-4 py-2 text-[13px] text-gray-600">{r.pharmacy.name}</td>
                      <td className="px-4 py-2 text-right text-[13px] text-gray-700">{formatCurrency(r.expectedRate)}</td>
                      <td className={`px-4 py-2 text-right text-[13px] font-medium ${r.status === "mismatch" ? "text-red-600" : "text-gray-900"}`}>{formatCurrency(r.actualRate)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${r.status === "match" ? "bg-green-100 text-green-700" : r.status === "mismatch" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                          {r.status === "match" ? "Match" : r.status === "mismatch" ? "Mismatch" : "Missing"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <BrandContactCard brandId={brand.id} contactName={brand.contactName} email={brand.email} phone={brand.phone} website={brand.website} notes={brand.notes} />

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Summary</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Active Programs</p>
                <p className="text-lg font-bold text-gray-900">{activePrograms.length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reference Codes</p>
                <p className="text-lg font-bold text-gray-900">{referenceCodes.length}</p>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm">{brand.active ? "Active" : "Inactive"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm">{brand.createdAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <Link href={`/programs?brand=${brand.id}`}
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-indigo-600">View All Programs</p>
            <p className="text-xs text-gray-500 mt-0.5">Programs for {brand.name}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
