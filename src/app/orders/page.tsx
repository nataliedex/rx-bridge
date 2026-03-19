import Link from "next/link";
import { getOrders, getDashboardStats } from "@/lib/actions";
import { STATUS_LABELS, STATUS_COLORS, ORDER_STATUSES, SEND_READINESS_LABELS, SEND_READINESS_COLORS, SEND_READINESS_VALUES, isSendReadinessRelevant, type OrderStatus, type SendReadiness } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { ClickableRow } from "@/components/clickable-row";
import { SearchInput } from "@/components/search-input";
import { HighlightText } from "@/components/highlight-text";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; status?: string; readiness?: string; approval?: string; attention?: string }>;
}

function actionPriority(status: string, sr: string): number {
  if (!isSendReadinessRelevant(status)) return 3;
  if (sr === "missing_data") return 0;
  if (sr === "needs_review") return 1;
  return 2;
}

// Build a URL with one param removed
function removeParam(params: Record<string, string>, key: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== key && v && v !== "all") next.set(k, v);
  }
  const qs = next.toString();
  return `/orders${qs ? `?${qs}` : ""}`;
}

// Build a URL with one param changed
function setParam(params: Record<string, string>, key: string, value: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") next.set(k, v);
  }
  if (value && value !== "all") next.set(key, value);
  else next.delete(key);
  const qs = next.toString();
  return `/orders${qs ? `?${qs}` : ""}`;
}

export default async function OrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "all";
  const readinessFilter = params.readiness || "all";
  const approvalFilter = params.approval || "";
  const attentionFilter = params.attention || "";

  // Canonical params object for URL building
  const activeParams: Record<string, string> = {};
  if (search) activeParams.search = search;
  if (statusFilter !== "all") activeParams.status = statusFilter;
  if (readinessFilter !== "all") activeParams.readiness = readinessFilter;
  if (approvalFilter) activeParams.approval = approvalFilter;
  if (attentionFilter) activeParams.attention = attentionFilter;

  const [stats, allOrders] = await Promise.all([
    getDashboardStats(),
    getOrders(search || undefined, statusFilter),
  ]);

  let orders = allOrders;

  if (readinessFilter && readinessFilter !== "all") {
    orders = orders.filter((o) => o.sendReadiness === readinessFilter);
  }
  if (attentionFilter === "true") {
    orders = orders.filter((o) =>
      (o.sendReadiness === "missing_data" || o.sendReadiness === "needs_review" || o.status === "needs_clarification") &&
      o.status !== "sent_to_pharmacy" && o.status !== "completed" && o.status !== "rejected"
    );
  }
  if (approvalFilter === "pending") {
    orders = orders.filter((o) =>
      o.sendReadiness === "ready" &&
      o.status !== "approved" && o.status !== "queued" &&
      o.status !== "sent_to_pharmacy" && o.status !== "completed" && o.status !== "rejected"
    );
  }

  orders.sort((a, b) => actionPriority(a.status, a.sendReadiness) - actionPriority(b.status, b.sendReadiness));

  const hasAnyFilter = Object.keys(activeParams).length > 0;

  // Build filter chips
  const chips: { label: string; removeHref: string }[] = [];
  if (attentionFilter === "true") chips.push({ label: "Needs Attention", removeHref: removeParam(activeParams, "attention") });
  if (approvalFilter === "pending") chips.push({ label: "Awaiting Approval", removeHref: removeParam(activeParams, "approval") });
  if (statusFilter !== "all") chips.push({ label: `Status: ${STATUS_LABELS[statusFilter as OrderStatus] || statusFilter}`, removeHref: removeParam(activeParams, "status") });
  if (readinessFilter !== "all") chips.push({ label: `Action: ${SEND_READINESS_LABELS[readinessFilter as SendReadiness] || readinessFilter}`, removeHref: removeParam(activeParams, "readiness") });
  if (search) chips.push({ label: `Search: "${search}"`, removeHref: removeParam(activeParams, "search") });

  const tiles = [
    { label: "Draft", value: stats.draft, href: "/orders?status=draft", active: statusFilter === "draft" },
    { label: "Needs Attention", value: stats.needsAttention, href: "/orders?attention=true", active: attentionFilter === "true", alert: true },
    { label: "Approved", value: stats.approved, href: "/orders?status=approved", active: statusFilter === "approved" },
    { label: "Queued", value: stats.queued, href: "/queue", active: false },
    { label: "Sent", value: stats.sentToPharmacy, href: "/orders?status=sent_to_pharmacy", active: statusFilter === "sent_to_pharmacy" },
  ];

  // Non-search params for the search input to preserve
  const searchBaseParams: Record<string, string> = {};
  if (statusFilter !== "all") searchBaseParams.status = statusFilter;
  if (readinessFilter !== "all") searchBaseParams.readiness = readinessFilter;
  if (approvalFilter) searchBaseParams.approval = approvalFilter;
  if (attentionFilter) searchBaseParams.attention = attentionFilter;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Link href="/orders/new" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">
          + Manual Order
        </Link>
      </div>

      {/* Workflow tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
        {tiles.map((tile) => {
          const isEmpty = tile.value === 0;
          const isAlert = tile.alert && tile.value > 0;
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className={`tile-hover border rounded-lg p-4 ${
                tile.active ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200"
                  : isAlert ? "bg-red-50 border-red-300"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <p className={`text-sm ${isEmpty ? "text-gray-400" : "text-gray-500"}`}>{tile.label}</p>
              <p className={`text-2xl font-bold mt-1 ${isEmpty ? "text-gray-300" : ""}`}>{tile.value}</p>
              {isEmpty && tile.alert && <p className="text-[10px] text-gray-400 mt-0.5">No orders need attention</p>}
            </Link>
          );
        })}
      </div>

      {/* Active filters bar */}
      {hasAnyFilter && (
        <div className="flex items-center gap-2 flex-wrap mb-4 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.removeHref}
              className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs text-gray-700 hover:border-gray-400 transition-colors"
            >
              {chip.label}
              <span className="text-gray-400 hover:text-gray-600 ml-0.5">&#10005;</span>
            </Link>
          ))}
          <Link href="/orders" className="ml-auto text-xs text-gray-500 hover:text-gray-700 font-medium">Clear all</Link>
        </div>
      )}

      {/* Search + count bar */}
      <div className="flex items-center justify-between mb-3">
        <SearchInput currentSearch={search} baseParams={searchBaseParams} />
        <p className="text-xs text-gray-400">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      {orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400">{hasAnyFilter ? "No orders match these filters." : "No orders yet."}</p>
          {hasAnyFilter ? (
            <Link href="/orders" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Clear filters to see all orders</Link>
          ) : (
            <Link href="/orders/new" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Create your first order</Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pl-3 pr-2 py-1.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Patient</th>
                <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Brand</th>
                <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  <HeaderDropdown label="Status" value={statusFilter} options={[{ value: "all", label: "All" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} paramKey="status" activeParams={activeParams} />
                </th>
                <th className="px-2 py-1.5 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  <HeaderDropdown label="Action" value={readinessFilter} options={[{ value: "all", label: "All" }, ...SEND_READINESS_VALUES.map((r) => ({ value: r, label: SEND_READINESS_LABELS[r] }))]} paramKey="readiness" activeParams={activeParams} />
                </th>
                <th className="pl-2 pr-3 py-1.5 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Age</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => {
                const needsAction = isSendReadinessRelevant(order.status) && order.sendReadiness !== "ready";
                const stripe = idx % 2 === 1 ? "bg-gray-50/40" : "";
                return (
                  <ClickableRow
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className={`border-b border-gray-100 ${needsAction ? "bg-red-50/50 hover:bg-red-100/50" : `${stripe} hover:bg-gray-100/50`} transition-colors duration-100`}
                  >
                    <td className="pl-3 pr-2 py-1.5">
                      <span className="text-[13px] font-semibold text-gray-900 leading-tight">
                        <HighlightText text={`${order.patient.firstName} ${order.patient.lastName}`} search={search} />
                      </span>
                      <p className="text-[10px] text-gray-300 font-mono leading-none mt-0.5">{order.id.slice(-8)}</p>
                    </td>
                    <td className="px-2 py-1.5 text-[13px] text-gray-400">{order.brand?.name ? <HighlightText text={order.brand.name} search={search} /> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-1.5 text-[13px] text-gray-600"><HighlightText text={order.medicationName} search={search} /></td>
                    <td className="px-2 py-1.5 text-[13px] text-gray-400"><HighlightText text={order.pharmacy.name} search={search} /></td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${STATUS_COLORS[order.status as OrderStatus]}`}>
                        {STATUS_LABELS[order.status as OrderStatus] || order.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      {isSendReadinessRelevant(order.status) ? (
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${SEND_READINESS_COLORS[order.sendReadiness as SendReadiness]}`}>
                          {SEND_READINESS_LABELS[order.sendReadiness as SendReadiness]}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="pl-2 pr-3 py-1.5 text-right text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{timeAgo(order.createdAt)}</td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Inline dropdown for table headers — renders as links, no JS needed
function HeaderDropdown({ label, value, options, paramKey, activeParams }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  paramKey: string;
  activeParams: Record<string, string>;
}) {
  const isFiltered = value !== "all";
  const activeLabel = options.find((o) => o.value === value)?.label || label;

  return (
    <details className="relative inline-block group">
      <summary className={`cursor-pointer select-none list-none flex items-center gap-1 ${isFiltered ? "text-indigo-600" : ""}`}>
        {isFiltered ? activeLabel : label}
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </summary>
      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[140px] py-1">
        {options.map((opt) => (
          <Link
            key={opt.value}
            href={setParam(activeParams, paramKey, opt.value)}
            className={`block px-3 py-1.5 text-xs hover:bg-gray-50 ${opt.value === value ? "text-indigo-600 font-medium" : "text-gray-700"}`}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
