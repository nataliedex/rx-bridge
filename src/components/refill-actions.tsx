"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface LatestRefill {
  id: string;
  status: string;
  createdAt: string;
  validatedAt: string | null;
  sentToPharmacyAt: string | null;
  filledAt: string | null;
  cancelledAt: string | null;
}

interface Props {
  orderId: string;
  orderStatus: string;
  refillsAuthorized: number;
  refillsFilled: number;
  refillsInFlight: number;
  refillsRemaining: number;
  latestRefill: LatestRefill | null;
}

type RefillState = "awaiting_brand" | "in_flight" | "exhausted" | "not_active" | "hidden";

const REFILL_STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  pending_validation: { label: "Pending", color: "text-gray-600", bg: "bg-gray-100" },
  validated: { label: "Ready to Send", color: "text-indigo-700", bg: "bg-indigo-100" },
  queued_for_pharmacy: { label: "Queued", color: "text-indigo-700", bg: "bg-indigo-100" },
  sent_to_pharmacy: { label: "At Pharmacy", color: "text-purple-700", bg: "bg-purple-100" },
  pharmacy_acknowledged: { label: "Pharmacy Received", color: "text-purple-700", bg: "bg-purple-100" },
  filled: { label: "Filled", color: "text-green-700", bg: "bg-green-100" },
  rejected: { label: "Rejected", color: "text-red-700", bg: "bg-red-100" },
  cancelled: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-100" },
};

function computeRefillState(props: Props): RefillState {
  if (props.refillsAuthorized === 0) return "hidden";
  const isActive = props.orderStatus === "completed" || props.orderStatus === "sent_to_pharmacy";
  if (props.refillsInFlight > 0) return "in_flight";
  if (props.refillsRemaining <= 0) return "exhausted";
  if (!isActive) return "not_active";
  return "awaiting_brand";
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString();
}

export function RefillActions(props: Props) {
  const { orderId, refillsAuthorized, refillsFilled, refillsInFlight, refillsRemaining, latestRefill } = props;
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const state = computeRefillState(props);

  if (state === "hidden") return null;

  async function handleSend() {
    if (!latestRefill) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/refills/${latestRefill.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to send"); return; }
      router.refresh();
    } catch { setError("Network error"); }
    finally { setSending(false); }
  }

  const display = latestRefill ? REFILL_STATUS_DISPLAY[latestRefill.status] : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Refills</h3>
        <Link href={`/orders/${orderId}/refills`} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium">
          View History
        </Link>
      </div>

      {/* Accounting */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <span>{refillsFilled} filled</span>
        {refillsInFlight > 0 && <span className="text-indigo-600 font-medium">{refillsInFlight} in flight</span>}
        <span>{refillsRemaining} remaining</span>
        <span className="text-gray-300">of {refillsAuthorized}</span>
      </div>

      {/* Latest refill status */}
      {latestRefill && display && (
        <div className="mb-3 border border-gray-100 rounded-md px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${display.bg} ${display.color}`}>{display.label}</span>
            </div>
            {latestRefill.filledAt && (
              <span className="text-[10px] text-gray-400">{formatShortDate(latestRefill.filledAt)}</span>
            )}
            {!latestRefill.filledAt && latestRefill.sentToPharmacyAt && (
              <span className="text-[10px] text-gray-400">Sent {formatShortDate(latestRefill.sentToPharmacyAt)}</span>
            )}
            {!latestRefill.filledAt && !latestRefill.sentToPharmacyAt && latestRefill.validatedAt && (
              <span className="text-[10px] text-gray-400">Validated {formatShortDate(latestRefill.validatedAt)}</span>
            )}
          </div>

          {/* Next-action hint */}
          {(latestRefill.status === "validated" || latestRefill.status === "queued_for_pharmacy") && (
            <p className="text-[10px] text-indigo-600 mt-1">Next: Send this refill to the pharmacy</p>
          )}
          {(latestRefill.status === "sent_to_pharmacy" || latestRefill.status === "pharmacy_acknowledged") && (
            <p className="text-[10px] text-purple-600 mt-1">Waiting for pharmacy to fill</p>
          )}
          {latestRefill.status === "filled" && (
            <p className="text-[10px] text-green-600 mt-1">Complete — medication dispensed</p>
          )}
          {latestRefill.status === "rejected" && (
            <p className="text-[10px] text-red-500 mt-1">Pharmacy rejected — brand can request a new refill</p>
          )}

          {/* Inline Send to Pharmacy for validated refills */}
          {(latestRefill.status === "validated" || latestRefill.status === "queued_for_pharmacy") && (
            <button onClick={handleSend} disabled={sending}
              className="mt-2 w-full bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {sending ? "Sending..." : "Send to Pharmacy"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {/* State messages */}
      {state === "awaiting_brand" && (
        <p className="text-[11px] text-gray-400">Refills are requested by the brand when needed.</p>
      )}

      {state === "in_flight" && !latestRefill && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-indigo-700">Refill in progress</p>
        </div>
      )}

      {state === "exhausted" && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <p className="text-xs font-medium text-amber-700">New Rx required</p>
          <p className="text-[11px] text-amber-600 mt-0.5">
            All {refillsAuthorized} authorized refill{refillsAuthorized !== 1 ? "s have" : " has"} been used.
          </p>
        </div>
      )}

      {state === "not_active" && (
        <p className="text-[11px] text-gray-400">Refills available after order is completed.</p>
      )}
    </div>
  );
}
