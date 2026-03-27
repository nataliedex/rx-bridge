"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/pricing";
import { CANCELLABLE_REFILL_STATUSES, TERMINAL_REFILL_STATUSES, type RefillStatus } from "@/lib/refills/types";

interface Refill {
  id: string;
  status: string;
  source: string;
  medicationName: string;
  quantity: number | null;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string } | null;
  pharmacy: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  requestedBy: { userId: string | null; name: string | null; email: string | null };
  rejection: { code: string; reason: string | null } | null;
  pharmacyFill: {
    pharmacyOrderId: string | null;
    quantityDispensed: number | null;
    pharmacyCostCents: number | null;
    sellPriceCents: number | null;
  } | null;
  createdAt: string;
  validatedAt: string | null;
  sentToPharmacyAt: string | null;
  filledAt: string | null;
  cancelledAt: string | null;
}

interface Props {
  refill: Refill;
}

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  pending_validation: { label: "Pending", color: "text-gray-600", bg: "bg-gray-100" },
  validated: { label: "Validated", color: "text-indigo-700", bg: "bg-indigo-100" },
  queued_for_pharmacy: { label: "Queued", color: "text-indigo-700", bg: "bg-indigo-100" },
  sent_to_pharmacy: { label: "Sent to Pharmacy", color: "text-purple-700", bg: "bg-purple-100" },
  pharmacy_acknowledged: { label: "Pharmacy Received", color: "text-purple-700", bg: "bg-purple-100" },
  filled: { label: "Filled", color: "text-green-700", bg: "bg-green-100" },
  rejected: { label: "Rejected", color: "text-red-700", bg: "bg-red-100" },
  cancelled: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-100" },
  expired: { label: "Expired", color: "text-amber-700", bg: "bg-amber-100" },
};

// Lifecycle milestones in order
const MILESTONES = [
  { key: "created", label: "Requested", field: "createdAt" },
  { key: "validated", label: "Validated", field: "validatedAt" },
  { key: "sent", label: "Sent to Pharmacy", field: "sentToPharmacyAt" },
  { key: "filled", label: "Filled", field: "filledAt" },
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function RefillTimeline({ refill }: Props) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const status = refill.status as RefillStatus;
  const display = STATUS_DISPLAY[status] ?? { label: status, color: "text-gray-600", bg: "bg-gray-100" };
  const isTerminal = TERMINAL_REFILL_STATUSES.has(status);
  const isCancellable = CANCELLABLE_REFILL_STATUSES.has(status);
  const isSendable = status === "validated" || status === "queued_for_pharmacy";
  const isRejected = status === "rejected";
  const isCancelled = status === "cancelled";
  const isFilled = status === "filled";

  // Determine which milestones are completed
  const milestoneData = MILESTONES.map((m) => {
    const value = refill[m.field as keyof Refill] as string | null;
    return { ...m, date: value, completed: !!value };
  });

  // Find the current milestone index
  let currentIdx = -1;
  for (let i = milestoneData.length - 1; i >= 0; i--) {
    if (milestoneData[i].completed) { currentIdx = i; break; }
  }

  async function handleSend() {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/refills/${refill.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.message || "Failed to send");
      } else {
        router.refresh();
      }
    } catch {
      setSendError("Network error");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/refills/${refill.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.message || "Failed to cancel");
      } else {
        router.refresh();
      }
    } catch {
      setCancelError("Network error");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${
      isRejected ? "border-red-200" : isCancelled ? "border-gray-200 opacity-70" : isFilled ? "border-green-200" : "border-gray-200"
    }`}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${display.bg} ${display.color}`}>
            {display.label}
          </span>
          <span className="text-[13px] text-gray-900 font-medium truncate">{refill.medicationName}</span>
          {refill.quantity && <span className="text-[11px] text-gray-400">qty {refill.quantity}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-gray-400">{new Date(refill.createdAt).toLocaleDateString()}</span>
          <span className="text-[11px] text-gray-300">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Timeline visualization */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-0">
              {milestoneData.map((m, idx) => {
                const isComplete = m.completed;
                const isCurrent = idx === currentIdx && !isTerminal;
                return (
                  <div key={m.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        isComplete ? "bg-green-500 border-green-500"
                          : isCurrent ? "bg-indigo-500 border-indigo-500"
                          : "bg-white border-gray-300"
                      }`} />
                      <p className={`text-[10px] mt-1 ${isComplete ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                        {m.label}
                      </p>
                      {m.date && (
                        <p className="text-[9px] text-gray-400">{new Date(m.date).toLocaleDateString()}</p>
                      )}
                    </div>
                    {idx < milestoneData.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${
                        milestoneData[idx + 1].completed ? "bg-green-500" : "bg-gray-200"
                      }`} />
                    )}
                  </div>
                );
              })}
              {/* Terminal state indicator */}
              {(isRejected || isCancelled) && (
                <div className="flex flex-col items-center ml-2">
                  <div className={`w-3 h-3 rounded-full ${isRejected ? "bg-red-500" : "bg-gray-400"}`} />
                  <p className={`text-[10px] mt-1 font-medium ${isRejected ? "text-red-600" : "text-gray-500"}`}>
                    {isRejected ? "Rejected" : "Cancelled"}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    {isRejected ? new Date(refill.createdAt).toLocaleDateString() : refill.cancelledAt ? new Date(refill.cancelledAt).toLocaleDateString() : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Detail grid */}
          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <DetailRow label="Refill ID" value={refill.id.slice(0, 16)} mono />
            <DetailRow label="Status" value={display.label} />
            <DetailRow label="Source" value={refill.source} />
            <DetailRow label="Created" value={formatDate(refill.createdAt)} />
            <DetailRow label="Validated" value={formatDate(refill.validatedAt)} />
            <DetailRow label="Sent to Pharmacy" value={formatDate(refill.sentToPharmacyAt)} />
            {isFilled && <DetailRow label="Filled" value={formatDate(refill.filledAt)} />}
            {isCancelled && <DetailRow label="Cancelled" value={formatDate(refill.cancelledAt)} />}
            {refill.pharmacy && <DetailRow label="Pharmacy" value={refill.pharmacy.name} />}
            {refill.brand && <DetailRow label="Brand" value={refill.brand.name} />}
            {refill.requestedBy.name && <DetailRow label="Requested By" value={refill.requestedBy.name} />}
            {refill.notes && <DetailRow label="Notes" value={refill.notes} />}
          </div>

          {/* Rejection detail */}
          {refill.rejection && (
            <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <p className="text-xs font-medium text-red-700">{refill.rejection.code}</p>
              {refill.rejection.reason && <p className="text-[11px] text-red-600 mt-0.5">{refill.rejection.reason}</p>}
            </div>
          )}

          {/* Fill economics */}
          {refill.pharmacyFill && (
            <div className="mx-4 mb-4 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <p className="text-xs font-medium text-green-700 mb-1">Fill Economics</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {refill.pharmacyFill.quantityDispensed != null && (
                  <div><span className="text-gray-500">Qty Dispensed:</span> <span className="text-gray-900 font-medium">{refill.pharmacyFill.quantityDispensed}</span></div>
                )}
                {refill.pharmacyFill.sellPriceCents != null && (
                  <div><span className="text-gray-500">Brand Pays:</span> <span className="text-gray-900 font-medium">{formatCurrency(refill.pharmacyFill.sellPriceCents / 100)}</span></div>
                )}
                {refill.pharmacyFill.pharmacyCostCents != null && (
                  <div><span className="text-gray-500">Pharmacy Cost:</span> <span className="text-gray-900 font-medium">{formatCurrency(refill.pharmacyFill.pharmacyCostCents / 100)}</span></div>
                )}
                {refill.pharmacyFill.sellPriceCents != null && refill.pharmacyFill.pharmacyCostCents != null && (() => {
                  const margin = refill.pharmacyFill!.sellPriceCents! - refill.pharmacyFill!.pharmacyCostCents!;
                  return (
                    <div><span className="text-gray-500">Rx-Bridge Margin:</span> <span className={`font-medium ${margin >= 0 ? "text-green-700" : "text-red-600"}`}>{formatCurrency(margin / 100)}</span></div>
                  );
                })()}
                {refill.pharmacyFill.pharmacyOrderId && (
                  <div><span className="text-gray-500">Pharmacy Order:</span> <span className="text-gray-900 font-mono">{refill.pharmacyFill.pharmacyOrderId}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {(isSendable || isCancellable) && (
            <div className="px-4 pb-4">
              {sendError && <p className="text-red-600 text-xs mb-2">{sendError}</p>}
              {cancelError && <p className="text-red-600 text-xs mb-2">{cancelError}</p>}
              <div className="flex items-center gap-3">
                {isSendable && (
                  <button
                    onClick={handleSend}
                    disabled={sending}
                    className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {sending ? "Sending..." : "Send to Pharmacy"}
                  </button>
                )}
                {isCancellable && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="text-xs text-gray-400 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Cancel Refill"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}
