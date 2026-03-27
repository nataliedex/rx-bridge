"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/pricing";
import { TERMINAL_REFILL_STATUSES, type RefillStatus } from "@/lib/refills/types";

interface RefillRow {
  id: string;
  orderId: string;
  status: string;
  medicationName: string;
  quantity: number | null;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string };
  pharmacy: { id: string; name: string };
  brand: { id: string; name: string } | null;
  order: { id: string; medicationName: string; strength: string | null; quantity: number | null };
  pharmacyOrderId: string | null;
  quantityDispensed: number | null;
  pharmacyCostCents: number | null;
  sellPriceCents: number | null;
  sentToPharmacyAt: string | null;
  filledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface Props {
  refills: RefillRow[];
}

const STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  pending_validation: { label: "Pending", bg: "bg-gray-100", text: "text-gray-600" },
  validated: { label: "Validated", bg: "bg-indigo-100", text: "text-indigo-700" },
  queued_for_pharmacy: { label: "Queued", bg: "bg-indigo-100", text: "text-indigo-700" },
  sent_to_pharmacy: { label: "Sent to Pharmacy", bg: "bg-purple-100", text: "text-purple-700" },
  pharmacy_acknowledged: { label: "Acknowledged", bg: "bg-purple-100", text: "text-purple-700" },
  filled: { label: "Filled", bg: "bg-green-100", text: "text-green-700" },
  rejected: { label: "Rejected", bg: "bg-red-100", text: "text-red-700" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
  expired: { label: "Expired", bg: "bg-amber-100", text: "text-amber-700" },
};

export function PharmacySimulatorList({ refills }: Props) {
  return (
    <div className="space-y-3">
      {refills.map((r) => (
        <PharmacySimulatorCard key={r.id} refill={r} />
      ))}
    </div>
  );
}

function PharmacySimulatorCard({ refill }: { refill: RefillRow }) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [showFillForm, setShowFillForm] = useState(false);

  // Fill form state with sensible defaults (dollars for display)
  const [qtyDispensed, setQtyDispensed] = useState(String(refill.quantity ?? refill.order.quantity ?? 30));
  const [costDollars, setCostDollars] = useState("125.80");
  const [sellDollars, setSellDollars] = useState("182.41");

  const status = refill.status as RefillStatus;
  const display = STATUS_DISPLAY[status] ?? { label: status, bg: "bg-gray-100", text: "text-gray-600" };
  const isTerminal = TERMINAL_REFILL_STATUSES.has(status);
  const canAcknowledge = status === "sent_to_pharmacy";
  const canFill = status === "sent_to_pharmacy" || status === "pharmacy_acknowledged";
  const canReject = status === "sent_to_pharmacy" || status === "pharmacy_acknowledged";
  const canCancel = status === "sent_to_pharmacy" || status === "pharmacy_acknowledged";

  async function sendWebhook(webhookStatus: string, extra?: Record<string, unknown>) {
    setActing(true);
    setError("");
    try {
      const res = await fetch("/api/webhooks/pharmacy/fill-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacyId: refill.pharmacy.id,
          refillRequestId: refill.id,
          prescriptionId: refill.orderId,
          rxBridgeOrderId: refill.orderId,
          status: webhookStatus,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Action failed");
      } else {
        setShowFillForm(false);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setActing(false);
    }
  }

  function handleFillSubmit() {
    sendWebhook("filled", {
      quantityDispensed: parseInt(qtyDispensed) || undefined,
      pharmacyCostCents: Math.round((parseFloat(costDollars) || 0) * 100) || undefined,
      sellPriceCents: Math.round((parseFloat(sellDollars) || 0) * 100) || undefined,
      filledAt: new Date().toISOString(),
    });
  }

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${
      isTerminal ? "border-gray-200 opacity-70" : "border-purple-200"
    }`}>
      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${display.bg} ${display.text}`}>
            {display.label}
          </span>
          <span className="text-[13px] font-medium text-gray-900 truncate">{refill.medicationName}</span>
          {refill.order.strength && <span className="text-[11px] text-gray-400">{refill.order.strength}</span>}
          {refill.quantity && <span className="text-[11px] text-gray-400">qty {refill.quantity}</span>}
        </div>
        <Link href={`/orders/${refill.orderId}/refills`} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium shrink-0">
          View in Rx-Bridge
        </Link>
      </div>

      {/* Detail grid */}
      <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Patient</span>
          <p className="text-gray-700">{refill.patient.lastName}, {refill.patient.firstName}</p>
        </div>
        <div>
          <span className="text-gray-400">Pharmacy</span>
          <p className="text-gray-700">{refill.pharmacy.name}</p>
        </div>
        <div>
          <span className="text-gray-400">Brand</span>
          <p className="text-gray-700">{refill.brand?.name ?? <span className="text-gray-300">—</span>}</p>
        </div>
        <div>
          <span className="text-gray-400">Refill ID</span>
          <p className="text-gray-500 font-mono text-[10px]">{refill.id.slice(0, 16)}</p>
        </div>
        {refill.sentToPharmacyAt && (
          <div>
            <span className="text-gray-400">Sent</span>
            <p className="text-gray-700">{new Date(refill.sentToPharmacyAt).toLocaleString()}</p>
          </div>
        )}
        {refill.filledAt && (
          <div>
            <span className="text-gray-400">Filled</span>
            <p className="text-gray-700">{new Date(refill.filledAt).toLocaleString()}</p>
          </div>
        )}
        {refill.quantityDispensed != null && (
          <div>
            <span className="text-gray-400">Qty Dispensed</span>
            <p className="text-gray-700">{refill.quantityDispensed}</p>
          </div>
        )}
        {refill.sellPriceCents != null && (
          <div>
            <span className="text-gray-400">Brand Pays</span>
            <p className="text-gray-700">{formatCurrency(refill.sellPriceCents / 100)}</p>
          </div>
        )}
        {refill.pharmacyCostCents != null && (
          <div>
            <span className="text-gray-400">Pharmacy Cost</span>
            <p className="text-gray-700">{formatCurrency(refill.pharmacyCostCents / 100)}</p>
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-2 text-red-600 text-xs">{error}</p>}

      {/* Actions — only for non-terminal */}
      {!isTerminal && (canAcknowledge || canFill || canReject || canCancel) && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          {!showFillForm ? (
            <div className="flex items-center gap-2">
              {canAcknowledge && (
                <button onClick={() => sendWebhook("acknowledged")} disabled={acting}
                  className="bg-purple-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {acting ? "..." : "Acknowledge"}
                </button>
              )}
              {canFill && (
                <button onClick={() => setShowFillForm(true)} disabled={acting}
                  className="bg-green-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                  Mark Filled
                </button>
              )}
              {canReject && (
                <button onClick={() => sendWebhook("rejected")} disabled={acting}
                  className="border border-red-300 text-red-600 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                  {acting ? "..." : "Reject"}
                </button>
              )}
              {canCancel && (
                <button onClick={() => sendWebhook("cancelled")} disabled={acting}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium disabled:opacity-50 transition-colors ml-auto">
                  {acting ? "..." : "Cancel"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700">Fill Details</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Qty Dispensed</label>
                  <input type="number" value={qtyDispensed} onChange={(e) => setQtyDispensed(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Pharmacy Cost ($)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input type="number" step="0.01" value={costDollars} onChange={(e) => setCostDollars(e.target.value)}
                      className="w-full border border-gray-300 rounded pl-5 pr-2 py-1 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Brand Pays ($)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input type="number" step="0.01" value={sellDollars} onChange={(e) => setSellDollars(e.target.value)}
                      className="w-full border border-gray-300 rounded pl-5 pr-2 py-1 text-xs" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleFillSubmit} disabled={acting}
                  className="bg-green-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {acting ? "Processing..." : "Confirm Fill"}
                </button>
                <button onClick={() => setShowFillForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
