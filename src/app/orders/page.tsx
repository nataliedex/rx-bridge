import Link from "next/link";
import { getOrders, getDashboardStats } from "@/lib/actions";
import { STATUS_LABELS, STATUS_COLORS, ORDER_STATUSES, SEND_READINESS_LABELS, SEND_READINESS_COLORS, SEND_READINESS_VALUES, isSendReadinessRelevant, getNextStep, type OrderStatus, type SendReadiness } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { ClickableRow } from "@/components/clickable-row";
import { SearchInput } from "@/components/search-input";
import { HighlightText } from "@/components/highlight-text";
import { HeaderDropdown } from "@/components/header-dropdown";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ search?: string; status?: string; readiness?: string; approval?: string; attention?: string; pharmacy?: string }>;
}

function actionPriority(status: string, sr: string): number {
  if (!isSendReadinessRelevant(status)) return 3;
  if (sr === "missing_data") return 0;
  if (sr === "needs_review") return 1;
  return 2;
}

function removeParam(params: Record<string, string>, key: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== key && v && v !== "all") next.set(k, v);
  }
  const qs = next.toString();
  return `/orders${qs ? `?${qs}` : ""}`;
}

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
  const pharmacyFilter = params.pharmacy || "";

  const activeParams: Record<string, string> = {};
  if (search) activeParams.search = search;
  if (statusFilter !== "all") activeParams.status = statusFilter;
  if (readinessFilter !== "all") activeParams.readiness = readinessFilter;
  if (approvalFilter) activeParams.approval = approvalFilter;
  if (attentionFilter) activeParams.attention = attentionFilter;
  if (pharmacyFilter) activeParams.pharmacy = pharmacyFilter;

  const [stats, allOrders] = await Promise.all([
    getDashboardStats(),
    getOrders(search || undefined, statusFilter, pharmacyFilter || undefined),
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

  const chips: { label: string; removeHref: string }[] = [];
  if (attentionFilter === "true") chips.push({ label: "Needs Attention", removeHref: removeParam(activeParams, "attention") });
  if (approvalFilter === "pending") chips.push({ label: "Awaiting Approval", removeHref: removeParam(activeParams, "approval") });
  if (statusFilter !== "all") chips.push({ label: `Status: ${STATUS_LABELS[statusFilter as OrderStatus] || statusFilter}`, removeHref: removeParam(activeParams, "status") });
  if (readinessFilter !== "all") chips.push({ label: `Next Step: ${SEND_READINESS_LABELS[readinessFilter as SendReadiness] || readinessFilter}`, removeHref: removeParam(activeParams, "readiness") });
  if (pharmacyFilter) {
    const pharmacyName = allOrders[0]?.pharmacy?.name || "Pharmacy";
    chips.push({ label: `Pharmacy: ${pharmacyName}`, removeHref: removeParam(activeParams, "pharmacy") });
  }
  if (search) chips.push({ label: `Search: "${search}"`, removeHref: removeParam(activeParams, "search") });

  const tiles = [
    { label: "Draft", value: stats.draft, href: "/orders?status=draft", active: statusFilter === "draft", tone: "gray" as const },
    { label: "Needs Attention", value: stats.needsAttention, href: "/orders?attention=true", active: attentionFilter === "true", tone: "red" as const },
    { label: "Ready to Queue", value: stats.approved, href: "/orders?status=approved", active: statusFilter === "approved", tone: "green" as const },
    { label: "Queued", value: stats.queued, href: "/queue", active: false, tone: "gray" as const },
    { label: "Sent", value: stats.sentToPharmacy, href: "/orders?status=sent_to_pharmacy", active: statusFilter === "sent_to_pharmacy", tone: "gray" as const },
  ];

  const searchBaseParams: Record<string, string> = {};
  if (statusFilter !== "all") searchBaseParams.status = statusFilter;
  if (readinessFilter !== "all") searchBaseParams.readiness = readinessFilter;
  if (approvalFilter) searchBaseParams.approval = approvalFilter;
  if (attentionFilter) searchBaseParams.attention = attentionFilter;
  if (pharmacyFilter) searchBaseParams.pharmacy = pharmacyFilter;

  // Full-height layout: viewport minus nav (3.5rem) minus main padding (2rem top + 2rem bottom)
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 4rem)" }}>

      {/* Fixed controls — these don't scroll */}
      <div className="shrink-0">
        {/* Title + action */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold">Orders</h1>
          <Link href="/orders/new" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors">
            + Manual Order
          </Link>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          {tiles.map((tile) => {
            const isEmpty = tile.value === 0;
            const toneStyles = {
              gray: "bg-gray-50 border-gray-200",
              red: tile.value > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200",
              green: tile.value > 0 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200",
            };
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className={`tile-hover border rounded-lg px-3 py-2.5 ${
                  tile.active ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200"
                    : toneStyles[tile.tone]
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-xs ${isEmpty ? "text-gray-400" : "text-gray-500"}`}>{tile.label}</p>
                  <p className={`text-lg font-bold ${isEmpty ? "text-gray-300" : ""}`}>{tile.value}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Search + filter chips */}
        <div className="flex items-center justify-between mb-2">
          <SearchInput currentSearch={search} baseParams={searchBaseParams} />
          <p className="text-xs text-gray-400">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        </div>

        {hasAnyFilter && (
          <div className="flex items-center gap-2 flex-wrap mb-2 px-2 py-1.5 bg-gray-50 border border-gray-100 rounded">
            {chips.map((chip) => (
              <Link key={chip.label} href={chip.removeHref}
                className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs text-gray-700 hover:border-gray-400 transition-colors">
                {chip.label}
                <span className="text-gray-400 hover:text-gray-600 ml-0.5">&#10005;</span>
              </Link>
            ))}
            <Link href="/orders" className="ml-auto text-xs text-gray-500 hover:text-gray-700 font-medium">Clear all</Link>
          </div>
        )}
      </div>

      {/* Data grid — this is the only scrolling area */}
      {orders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <div className="text-center">
            <p className="text-gray-400">{hasAnyFilter ? "No orders match these filters." : "No orders yet."}</p>
            {hasAnyFilter ? (
              <Link href="/orders" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Clear filters</Link>
            ) : (
              <Link href="/orders/new" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">Create your first order</Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers — fixed at top of grid */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="pl-3 pr-2 py-2 flex-[2]">Patient</div>
            <div className="px-2 py-2 flex-[1.2]">Brand</div>
            <div className="px-2 py-2 flex-[1.5]">Medication</div>
            <div className="px-2 py-2 flex-[1.2]">Pharmacy</div>
            <div className="px-2 py-2 flex-[1]">
              <HeaderDropdown label="Status" value={statusFilter} options={[{ value: "all", label: "All" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} paramKey="status" activeParams={activeParams} />
            </div>
            <div className="px-2 py-2 flex-[1]">
              <HeaderDropdown label="Next Step" value={readinessFilter} options={[{ value: "all", label: "All" }, ...SEND_READINESS_VALUES.map((r) => ({ value: r, label: SEND_READINESS_LABELS[r] }))]} paramKey="readiness" activeParams={activeParams} />
            </div>
            <div className="pl-2 pr-3 py-2 flex-[0.7] text-right">Age</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {orders.map((order, idx) => {
              const step = getNextStep(order.status, order.sendReadiness);
              const needsAction = step !== null && order.sendReadiness !== "ready";
              const stripe = idx % 2 === 1 ? "bg-gray-50/40" : "";
              return (
                <ClickableRow
                  key={order.id}
                  as="div"
                  href={`/orders/${order.id}`}
                  className={`flex items-center border-b border-gray-100 ${needsAction ? "bg-red-50/50 hover:bg-red-100/50" : `${stripe} hover:bg-gray-100/50`} transition-colors duration-100`}
                >
                  <div className="pl-3 pr-2 py-1.5 flex-[2] min-w-0">
                    <span className="text-[13px] font-semibold text-gray-900 leading-tight block truncate">
                      <HighlightText text={`${order.patient.firstName} ${order.patient.lastName}`} search={search} />
                    </span>
                    <p className="text-[10px] text-gray-300 font-mono leading-none mt-0.5">{order.id.slice(-8)}</p>
                  </div>
                  <div className="px-2 py-1.5 flex-[1.2] text-[13px] text-gray-400 truncate">{order.brand?.name ? <HighlightText text={order.brand.name} search={search} /> : <span className="text-gray-300">—</span>}</div>
                  <div className="px-2 py-1.5 flex-[1.5] text-[13px] text-gray-600 truncate"><HighlightText text={order.medicationName} search={search} /></div>
                  <div className="px-2 py-1.5 flex-[1.2] text-[13px] text-gray-400 truncate"><HighlightText text={order.pharmacy.name} search={search} /></div>
                  <div className="px-2 py-1.5 flex-[1]">
                    <span className={`text-[11px] ${STATUS_COLORS[order.status as OrderStatus]}`}>
                      {STATUS_LABELS[order.status as OrderStatus] || order.status}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 flex-[1]">
                    {(() => {
                      const step = getNextStep(order.status, order.sendReadiness);
                      return step ? (
                        <span className={`text-[11px] ${step.color}`}>{step.label}</span>
                      ) : (
                        <span className="text-gray-300 text-[11px]">—</span>
                      );
                    })()}
                  </div>
                  <div className="pl-2 pr-3 py-1.5 flex-[0.7] text-right text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{timeAgo(order.createdAt)}</div>
                </ClickableRow>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
