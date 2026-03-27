"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface RefillSummary {
  id: string;
  status: string;
  createdAt: string;
  filledAt: string | null;
  sentToPharmacyAt: string | null;
}

interface OrderRow {
  id: string;
  medicationName: string;
  strength: string | null;
  quantity: number | null;
  refills: number;
  status: string;
  patient: string;
  patientId: string;
  pharmacy: string;
  pharmacyId: string;
  brand: string | null;
  brandId: string | null;
  filledCount: number;
  inFlightCount: number;
  remaining: number;
  refillRequests: RefillSummary[];
  createdAt: string;
}

interface Props {
  orders: OrderRow[];
}

const REFILL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  pending_validation: { label: "Pending", color: "text-gray-500" },
  validated: { label: "Validated", color: "text-indigo-600" },
  queued_for_pharmacy: { label: "Queued", color: "text-indigo-600" },
  sent_to_pharmacy: { label: "Sent", color: "text-purple-600" },
  pharmacy_acknowledged: { label: "Ack'd", color: "text-purple-600" },
  filled: { label: "Filled", color: "text-green-600" },
  rejected: { label: "Rejected", color: "text-red-600" },
  cancelled: { label: "Cancelled", color: "text-gray-400" },
};

export function BrandSimulatorOrders({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-400">No eligible prescriptions.</p>
        <p className="text-xs text-gray-400 mt-1">Create a prescription using the form on the left.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-700">Prescriptions ({orders.length})</h2>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const canRequest = order.remaining > 0 && order.inFlightCount === 0;

  async function handleRequestRefill() {
    setRequesting(true);
    setError("");
    try {
      const res = await fetch("/api/refills/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: order.brandId || undefined,
          patientId: order.patientId,
          prescriptionId: order.id,
          source: "brand_simulator",
          idempotencyKey: `bsim-${order.id}-${Date.now()}`,
          requestedBy: { name: "Brand Simulator" },
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.duplicate) {
        setError(data.errorMessage || data.message || "Failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[13px] font-medium text-gray-900 truncate">{order.medicationName}</span>
          {order.strength && <span className="text-[11px] text-gray-400">{order.strength}</span>}
          <span className="text-[11px] text-gray-400">qty {order.quantity ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-gray-500">{order.patient}</span>
          <span className="text-[11px] text-gray-300">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Refill accounting bar */}
      <div className="px-4 pb-2 flex items-center gap-4 text-[11px]">
        <span className="text-gray-500">{order.filledCount}/{order.refills} filled</span>
        {order.inFlightCount > 0 && <span className="text-indigo-600 font-medium">{order.inFlightCount} in flight</span>}
        <span className={order.remaining === 0 ? "text-red-500 font-medium" : "text-gray-500"}>{order.remaining} remaining</span>
        <span className="text-gray-300 ml-auto">{order.pharmacy}</span>
        {order.brand && <span className="text-gray-300">{order.brand}</span>}
      </div>

      {/* Latest refill status — visible without expanding */}
      {order.refillRequests.length > 0 && (() => {
        const latest = order.refillRequests[0];
        const statusInfo: Record<string, { label: string; hint: string; color: string; bg: string }> = {
          validated: { label: "Refill requested", hint: "Rx-Bridge is preparing to send to pharmacy", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
          queued_for_pharmacy: { label: "Refill queued", hint: "Will be sent to pharmacy shortly", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
          sent_to_pharmacy: { label: "At pharmacy", hint: "Waiting for pharmacy to process", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
          pharmacy_acknowledged: { label: "Pharmacy processing", hint: "Pharmacy is preparing the medication", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
          filled: { label: `Filled${latest.filledAt ? ` ${new Date(latest.filledAt).toLocaleDateString()}` : ""}`, hint: "Medication dispensed — ready for patient", color: "text-green-700", bg: "bg-green-50 border-green-200" },
          rejected: { label: "Rejected", hint: "Pharmacy could not fill — request a new refill", color: "text-red-700", bg: "bg-red-50 border-red-200" },
          cancelled: { label: "Cancelled", hint: "", color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
          pending_validation: { label: "Pending", hint: "Validating refill request", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
        };
        const info = statusInfo[latest.status];
        if (!info) return null;
        return (
          <div className={`mx-4 mb-2 px-3 py-1.5 rounded-md border text-[11px] ${info.bg}`}>
            <span className={`font-medium ${info.color}`}>{info.label}</span>
            {info.hint && <span className="text-gray-500 ml-2">{info.hint}</span>}
          </div>
        );
      })()}

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {canRequest ? (
          <button onClick={handleRequestRefill} disabled={requesting}
            className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {requesting ? "Requesting..." : "Request Refill"}
          </button>
        ) : order.remaining === 0 && order.inFlightCount === 0 ? (
          <span className="text-[11px] text-amber-600 font-medium">No refills remaining</span>
        ) : null}

        <Link href={`/orders/${order.id}/refills`}
          className="text-[11px] text-gray-400 hover:text-indigo-600 font-medium ml-auto">
          View in Rx-Bridge
        </Link>

        {error && <span className="text-red-600 text-[11px]">{error}</span>}
      </div>

      {/* Expanded: refill history */}
      {expanded && order.refillRequests.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Refill History</p>
          <div className="space-y-1.5">
            {order.refillRequests.map((r) => {
              const d = REFILL_STATUS_DISPLAY[r.status] ?? { label: r.status, color: "text-gray-500" };
              return (
                <div key={r.id} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${d.color}`}>{d.label}</span>
                    <span className="text-gray-400 font-mono text-[10px]">{r.id.slice(0, 12)}</span>
                  </div>
                  <span className="text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expanded && order.refillRequests.length === 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-[11px] text-gray-400">No refill requests yet.</p>
        </div>
      )}
    </div>
  );
}
