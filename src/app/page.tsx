import Link from "next/link";
import { getDashboardData } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">What needs your attention today</p>
      </div>

      {/* Needs Attention — grouped by med spa */}
      {data.attention.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50/50">
            <h2 className="text-sm font-semibold text-amber-900">Needs Attention</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.attention.map((item) => (
              <Link key={item.href} href={item.href}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-[13px] font-medium text-gray-900">{item.name}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {item.issues.map((issue, i) => (
                      <li key={i} className="text-[12px] text-gray-500 flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5 shrink-0">&#8226;</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="text-gray-300 text-sm shrink-0 ml-4">&rsaquo;</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Snapshot */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Treatments This Month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.snapshot.orderCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Client Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(data.snapshot.revenue)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Your Profit</p>
          <p className={`text-2xl font-bold mt-1 ${data.snapshot.grossProfit > 0 ? "text-green-700" : "text-gray-900"}`}>
            {formatCurrency(data.snapshot.grossProfit)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Avg Profit / Treatment</p>
          <p className={`text-2xl font-bold mt-1 ${data.snapshot.avgProfit > 0 ? "text-green-700" : "text-gray-900"}`}>
            {data.snapshot.orderCount > 0 ? formatCurrency(data.snapshot.avgProfit) : "—"}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-gray-400 uppercase tracking-wider mr-1">Quick Actions</span>
        <Link href="/ledger?new=1"
          className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
          + Record Transaction
        </Link>
        <Link href="/med-spas?new=1"
          className="border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors">
          + Add Med Spa
        </Link>
        <Link href="/partnerships/pharmacies?new=1"
          className="border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors">
          + Add Pharmacy
        </Link>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Recent Orders</h2>
            <Link href="/ledger" className="text-[11px] text-indigo-600 hover:text-indigo-800">View all &rarr;</Link>
          </div>
          {data.recentActivity.length === 0 ? (
            <div className="p-5 text-center text-gray-400 text-sm">No orders logged yet — start tracking to see profit.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.recentActivity.map((item) => (
                <Link key={item.id} href={item.href}
                  className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors">
                  <p className="text-[13px] text-gray-700">{item.label}</p>
                  <p className="text-[11px] text-gray-400">{new Date(item.date).toLocaleDateString()}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
