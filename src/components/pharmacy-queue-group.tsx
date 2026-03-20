"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { bulkSendToPharmacy } from "@/lib/actions";
import type { UrgencyTier } from "@/lib/format";
import { LifefileExportButton } from "./lifefile-export-button";
import { parsePricing, aggregatePricing, formatCurrency, formatPercent } from "@/lib/pricing";

interface QueueOrderRow {
  id: string;
  patient: string;
  medication: string;
  brand: string | null;
  priority: string;
  pricingJson: string | null;
  age: string;
  urgency: UrgencyTier;
  createdAt: string;
}

interface ExportBatchRecord {
  id: string;
  fileName: string;
  orderCount: number;
  createdAt: string;
}

interface Props {
  pharmacyId: string;
  pharmacyName: string;
  hasUrgent: boolean;
  hasStale: boolean;
  orders: QueueOrderRow[];
  recentExports: ExportBatchRecord[];
}

const PRIORITY_SORT: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  urgent: { badge: "bg-red-600 text-white font-semibold", dot: "bg-red-500" },
  high: { badge: "bg-orange-500 text-white font-semibold", dot: "bg-orange-400" },
  normal: { badge: "", dot: "" },
  low: { badge: "", dot: "" },
};

const URGENCY_TEXT: Record<UrgencyTier, string> = {
  recent: "text-gray-400",
  moderate: "text-orange-500 font-medium",
  stale: "text-red-500 font-medium",
};

export function PharmacyQueueGroup({ pharmacyId, pharmacyName, hasUrgent, hasStale, orders, recentExports }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [failedResults, setFailedResults] = useState<{ orderId: string; error: string }[]>([]);

  const sorted = [...orders]
    .filter((o) => !sentIds.has(o.id))
    .sort((a, b) => (PRIORITY_SORT[a.priority] ?? 2) - (PRIORITY_SORT[b.priority] ?? 2));

  const remainingCount = sorted.length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === remainingCount ? new Set() : new Set(sorted.map((o) => o.id)));
  }

  async function handleSend(ids: string[]) {
    setSending(true);
    setFailedResults([]);
    try {
      const res = await bulkSendToPharmacy(ids);
      const newSent = new Set(sentIds);
      const failed: { orderId: string; error: string }[] = [];
      for (const r of res) {
        if (r.success) newSent.add(r.orderId);
        else failed.push({ orderId: r.orderId, error: r.error || "Unknown error" });
      }
      setSentIds(newSent);
      setFailedResults(failed);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of newSent) next.delete(id);
        return next;
      });
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  // All sent — success state
  if (remainingCount === 0 && sentIds.size > 0) {
    return (
      <div className="border border-green-200 rounded-lg overflow-hidden bg-green-50">
        <div className="px-4 py-4 flex items-center gap-3">
          <span className="text-green-600 text-lg">&#10003;</span>
          <div>
            <h2 className="font-semibold text-green-800">{pharmacyName}</h2>
            <p className="text-xs text-green-700">{sentIds.size} order{sentIds.size !== 1 ? "s" : ""} sent successfully</p>
          </div>
        </div>
      </div>
    );
  }

  const allRemainingIds = sorted.map((o) => o.id);
  const sendLabel = selected.size > 0 ? `Send ${selected.size} selected` : `Send all orders`;

  return (
    <div className="border border-green-200 rounded-lg overflow-hidden">
      {/* Header — green tint */}
      <div className="border-b border-green-200 px-4 py-3 flex justify-between items-center bg-green-50">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-8 rounded-full ${hasUrgent ? "bg-red-500" : hasStale ? "bg-orange-400" : "bg-green-500"}`} />
          <div>
            <h2 className="font-semibold text-gray-900">{pharmacyName}</h2>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{remainingCount}</span> order{remainingCount !== 1 ? "s" : ""} ready to send
              {hasUrgent && <span className="text-red-600 ml-1">— includes urgent</span>}
              {!hasUrgent && hasStale && <span className="text-orange-600 ml-1">— some waiting 24h+</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LifefileExportButton
            orderIds={selected.size > 0 ? Array.from(selected) : allRemainingIds}
            pharmacyId={pharmacyId}
            pharmacyName={pharmacyName}
            orders={sorted.map((o) => ({ id: o.id, patient: o.patient, medication: o.medication }))}
            recentExports={recentExports}
          />
          <button
            onClick={() => handleSend(selected.size > 0 ? Array.from(selected) : allRemainingIds)}
            disabled={sending}
            className="bg-green-700 text-white rounded-md px-5 py-2 text-sm font-semibold hover:bg-green-800 disabled:opacity-50 shadow-sm transition-colors"
          >
            {sending ? "Sending..." : sendLabel}
          </button>
        </div>
      </div>

      {/* Partial send success */}
      {sentIds.size > 0 && remainingCount > 0 && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-xs text-green-700 flex items-center gap-1.5">
          <span>&#10003;</span> {sentIds.size} sent. {remainingCount} remaining.
        </div>
      )}

      {/* Errors */}
      {failedResults.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs space-y-0.5">
          {failedResults.map((r) => (
            <p key={r.orderId} className="text-red-700">{r.orderId.slice(0, 8)}... failed: {r.error}</p>
          ))}
        </div>
      )}

      {/* Pricing summary */}
      {(() => {
        const pricingItems = sorted.map((o) => parsePricing(o.pricingJson));
        const agg = aggregatePricing(pricingItems);
        if (!agg) return null;
        return (
          <div className="px-4 py-2 bg-white border-b border-green-100 flex items-center gap-6 text-xs">
            <span className="text-gray-500">Batch total:</span>
            <span className="text-gray-400 line-through">{formatCurrency(agg.totalRetail)}</span>
            <span className="font-semibold text-gray-900">{formatCurrency(agg.totalGpo)}</span>
            <span className="text-green-700 font-medium">Save {formatCurrency(agg.totalSavings)} ({formatPercent(agg.avgSavingsPercent)})</span>
          </div>
        );
      })()}

      <table className="min-w-full divide-y divide-gray-100 bg-white">
        <thead>
          <tr className="text-xs text-gray-400 uppercase">
            <th className="px-3 py-2 text-left w-8">
              <input type="checkbox" checked={selected.size === remainingCount && remainingCount > 0}
                onChange={toggleAll} className="h-3.5 w-3.5 rounded border-gray-300 text-green-600" />
            </th>
            <th className="px-3 py-2 text-left w-12"></th>
            <th className="px-3 py-2 text-left">Patient</th>
            <th className="px-3 py-2 text-left">Medication</th>
            <th className="px-3 py-2 text-left">Brand</th>
            <th className="px-3 py-2 text-left w-16">Status</th>
            <th className="px-3 py-2 text-right w-20">Waiting</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((order) => {
            const pStyle = PRIORITY_STYLES[order.priority] || PRIORITY_STYLES.normal;
            const showPriorityBadge = order.priority === "urgent" || order.priority === "high";

            return (
              <tr key={order.id} className="hover:bg-green-50/30 transition-colors duration-150">
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={selected.has(order.id)}
                    onChange={() => toggleSelect(order.id)} className="h-3.5 w-3.5 rounded border-gray-300 text-green-600" />
                </td>
                <td className="px-3 py-1.5">
                  {showPriorityBadge ? (
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${pStyle.badge}`}>
                      {order.priority}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-sm">
                  <Link href={`/orders/${order.id}`} className="text-indigo-600 hover:underline font-medium">
                    {order.patient}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-sm text-gray-600">{order.medication}</td>
                <td className="px-3 py-1.5 text-sm text-gray-500">{order.brand || "—"}</td>
                <td className="px-3 py-1.5">
                  <span className="bg-green-50 text-green-700 text-xs rounded px-2 py-0.5">Ready</span>
                </td>
                <td className={`px-3 py-1.5 text-right text-xs tabular-nums ${URGENCY_TEXT[order.urgency] || "text-gray-400"}`}>
                  {order.age}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
