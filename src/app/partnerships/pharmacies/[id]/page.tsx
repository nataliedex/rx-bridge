import { notFound } from "next/navigation";
import Link from "next/link";
import { getPharmacyDetail } from "@/lib/actions";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { PharmacyContactCard } from "@/components/pharmacy-contact-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function parseServiceStates(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default async function PharmacyDetailPage({ params }: Props) {
  const { id } = await params;
  const pharmacy = await getPharmacyDetail(id);
  if (!pharmacy) notFound();

  const serviceStates = parseServiceStates(pharmacy.serviceStates);

  return (
    <div>
      <div className="mb-6">
        <Link href="/partnerships/pharmacies" className="text-sm text-indigo-600 hover:underline">&larr; Back to Pharmacies</Link>
        <h1 className="text-2xl font-semibold mt-2">{pharmacy.name}</h1>
        {pharmacy.archivedAt && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 ml-2">Archived</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active pricing */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-medium text-gray-900">Active Medication Pricing</h2>
              <p className="text-xs text-gray-500 mt-0.5">{pharmacy.medicationPriceHistory.length} active price{pharmacy.medicationPriceHistory.length !== 1 ? "s" : ""}</p>
            </div>
            {pharmacy.medicationPriceHistory.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No active pricing.</div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacy.medicationPriceHistory.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/medications/${p.medicationId}`} className="text-[13px] text-gray-900 hover:text-indigo-600">
                          {p.medication.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900">{formatCurrency(p.price)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(p.medication.form)}</span></td>
                      <td className="px-4 py-2.5 text-right text-[11px] text-gray-400">{p.effectiveDate.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Order volume by brand */}
          {pharmacy.ordersByBrand.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-medium text-gray-900">Order Volume by Brand</h2>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Brand</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacy.ordersByBrand.map((b) => (
                    <tr key={b.brandId || "none"} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 text-[13px] text-gray-900">{b.brandName}</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-700">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <PharmacyContactCard
            pharmacyId={pharmacy.id}
            contactName={pharmacy.contactName}
            phone={pharmacy.phone}
            email={pharmacy.email}
            fax={pharmacy.fax}
          />

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Summary</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Total Orders</p>
                <p className="text-lg font-bold text-gray-900">{pharmacy.totalOrders}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Prices</p>
                <p className="text-lg font-bold text-gray-900">{pharmacy.medicationPriceHistory.length}</p>
              </div>
              {(pharmacy.street || pharmacy.city) && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="text-sm">{[pharmacy.street, pharmacy.city, pharmacy.state, pharmacy.zip].filter(Boolean).join(", ")}</p>
                </div>
              )}
              {serviceStates.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500 mb-1">Service States</p>
                  <div className="flex flex-wrap gap-1">
                    {serviceStates.map((s) => (
                      <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Link href={`/medications/audit?pharmacy=${pharmacy.id}`}
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-indigo-600">View Pricing Audit</p>
            <p className="text-xs text-gray-500 mt-0.5">Check pricing freshness and verification status</p>
          </Link>

          <Link href={`/orders?pharmacy=${pharmacy.id}`}
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-indigo-600">View Orders</p>
            <p className="text-xs text-gray-500 mt-0.5">All orders for this pharmacy</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
