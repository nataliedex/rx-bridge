"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendToPharmacy, approveOrder } from "@/lib/actions";
import type { SendReadiness, OrderStatus } from "@/lib/types";
import { SEND_READINESS_LABELS } from "@/lib/types";

interface Props {
  orderId: string;
  sendReadiness: SendReadiness;
  orderStatus: OrderStatus;
  pharmacyName: string;
  alreadySent: boolean;
}

export function SendToPharmacy({ orderId, sendReadiness: sr, orderStatus, pharmacyName, alreadySent }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const isReady = sr === "ready";
  const isApproved = orderStatus === "approved";
  const canSend = isReady && isApproved;
  const isFinalState = orderStatus === "sent_to_pharmacy" || orderStatus === "completed" || orderStatus === "rejected";

  async function handleSend(override = false) {
    setSending(true);
    setError("");
    try {
      await sendToPharmacy(orderId, override);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
      setShowOverride(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError("");
    try {
      await approveOrder(orderId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  if (isFinalState && !alreadySent) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-1">Send to Pharmacy</h3>
      <p className="text-xs text-gray-500 mb-3">{pharmacyName}</p>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {alreadySent && (
        <p className="text-xs text-purple-600 mb-3">Previously sent. Can send again if needed.</p>
      )}

      {canSend && (
        <button onClick={() => handleSend(false)} disabled={sending}
          className="w-full bg-purple-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {sending ? "Sending..." : "Send to Pharmacy"}
        </button>
      )}

      {isReady && !isApproved && !isFinalState && (
        <div>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
            <p className="text-xs text-blue-800 font-medium">Complete — must be approved before sending.</p>
          </div>
          <button onClick={handleApprove} disabled={approving}
            className="w-full bg-green-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 mb-2">
            {approving ? "Approving..." : "Approve Order"}
          </button>
          <button disabled={true} className="w-full bg-purple-600 text-white rounded-md px-4 py-2 text-sm opacity-40 cursor-not-allowed">
            Send to Pharmacy
          </button>
        </div>
      )}

      {!isReady && !isFinalState && (
        <div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
            <p className="text-xs text-yellow-800">
              Send Readiness: {SEND_READINESS_LABELS[sr]}. Resolve open issues first.
            </p>
          </div>
          <button disabled={true} className="w-full bg-purple-600 text-white rounded-md px-4 py-2 text-sm opacity-40 cursor-not-allowed mb-2">
            Send to Pharmacy
          </button>
          {!showOverride ? (
            <button onClick={() => setShowOverride(true)} className="w-full text-xs text-gray-500 hover:text-gray-700 py-1">
              Override and send anyway...
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-xs text-red-800 mb-2">Override will be logged. Pharmacy may reject.</p>
              <button onClick={() => handleSend(true)} disabled={sending}
                className="w-full bg-red-600 text-white rounded-md px-3 py-1.5 text-xs hover:bg-red-700 disabled:opacity-50">
                {sending ? "Sending..." : "Confirm Override Send"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
