import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrandDetail } from "@/lib/actions";
import { buildBrandAnalytics } from "@/lib/brand-analytics";
import { BrandContactCard } from "@/components/brand-contact-card";
import { BrandAnalyticsDashboard } from "@/components/brand-analytics-dashboard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BrandDetailPage({ params }: Props) {
  const { id } = await params;
  const brand = await getBrandDetail(id);
  if (!brand) notFound();

  const analytics = buildBrandAnalytics(brand.rawOrders);

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
        <div className="lg:col-span-2">
          {brand.missingCostCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6">
              <p className="text-xs text-amber-700">
                {brand.missingCostCount} order{brand.missingCostCount !== 1 ? "s" : ""} missing pharmacy cost — margin may be incomplete
              </p>
            </div>
          )}

          <BrandAnalyticsDashboard
            analytics={analytics}
            totalOrders={brand.totalOrders}
            recentActivity={brand.recentActivity}
          />

          {/* Pharmacy distribution */}
          {brand.pharmacyDistribution.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-6">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-medium text-gray-900">Pharmacy Distribution</h2>
                <p className="text-xs text-gray-500 mt-0.5">Where orders are routed</p>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {brand.pharmacyDistribution.map((p, idx) => (
                    <tr key={p.pharmacyId} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <td className="px-4 py-2.5">
                        <Link href={`/partnerships/pharmacies/${p.pharmacyId}`} className="text-[13px] text-gray-900 hover:text-indigo-600">{p.pharmacyName}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-700 tabular-nums">{p.count}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-gray-400">
                        {brand.totalOrders > 0 ? `${Math.round((p.count / brand.totalOrders) * 100)}%` : "—"}
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
          <BrandContactCard
            brandId={brand.id}
            contactName={brand.contactName}
            email={brand.email}
            phone={brand.phone}
            website={brand.website}
            notes={brand.notes}
          />

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Status</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Active</p>
                <p className="text-sm">{brand.active ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Created</p>
                <p className="text-sm">{brand.createdAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <Link href={`/orders?pharmacy=&search=${encodeURIComponent(brand.name)}`}
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-indigo-600">View All Orders</p>
            <p className="text-xs text-gray-500 mt-0.5">Orders associated with {brand.name}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
