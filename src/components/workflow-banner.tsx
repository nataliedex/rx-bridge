"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveOrder, addToQueue, sendToPharmacy } from "@/lib/actions";
import type { SendReadiness, OrderStatus } from "@/lib/types";

interface Props {
  orderId: string;
  sendReadiness: SendReadiness;
  orderStatus: OrderStatus;
  pharmacyName: string;
  openIssueCount: number;
  alreadySent: boolean;
}

export function WorkflowBanner({ orderId, sendReadiness, orderStatus, pharmacyName, openIssueCount, alreadySent }: Props) {
  const router = useRouter();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [showSendNow, setShowSendNow] = useState(false);

  const isReady = sendReadiness === "ready";
  const isBlocked = sendReadiness === "missing_data";
  const isApproved = orderStatus === "approved";
  const isQueued = orderStatus === "queued";
  const isSent = orderStatus === "sent_to_pharmacy";
  const isCompleted = orderStatus === "completed";
  const isRejected = orderStatus === "rejected";

  async function handleApprove() {
    setActing(true); setError("");
    try { await approveOrder(orderId); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); }
  }

  async function handleAddToQueue() {
    setActing(true); setError("");
    try { await addToQueue(orderId); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); }
  }

  async function handleSend(override = false) {
    setActing(true); setError(""); setShowOverride(false); setShowSendNow(false);
    try { await sendToPharmacy(orderId, override); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActing(false); }
  }

  if (isCompleted) {
    return (
      <div className="rounded-lg p-4 mb-6 bg-emerald-50 border border-emerald-200">
        <h2 className="text-sm font-semibold text-emerald-800">Order completed</h2>
      </div>
    );
  }
  if (isRejected) {
    return (
      <div className="rounded-lg p-4 mb-6 bg-red-50 border border-red-200">
        <h2 className="text-sm font-semibold text-red-800">Order rejected</h2>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 mb-6 border ${
      isQueued ? "bg-gray-50 border-gray-200"
        : isReady && isApproved ? "bg-green-50 border-green-200"
        : isSent ? "bg-gray-50 border-gray-200"
        : isReady ? "bg-green-50 border-green-200"
        : isBlocked ? "bg-red-50 border-red-200"
        : "bg-amber-50 border-amber-200"
    }`}>
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {/* State A: Blocking issues */}
      {!isReady && !isSent && !isQueued && (
        <div>
          <h2 className={`text-sm font-semibold ${isBlocked ? "text-red-800" : "text-amber-800"}`}>
            Fix {openIssueCount} issue{openIssueCount !== 1 ? "s" : ""} before sending
          </h2>
          <p className={`text-xs mt-0.5 ${isBlocked ? "text-red-600" : "text-amber-700"}`}>
            Resolve all blocking issues below. Edit the relevant section, then mark the issue resolved.
          </p>
          <div className="mt-3">
            {!showOverride ? (
              <button onClick={() => setShowOverride(true)} className="text-xs text-gray-400 hover:text-gray-600">
                Override and send anyway...
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => handleSend(true)} disabled={acting}
                  className="bg-red-600 text-white rounded px-3 py-1 text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {acting ? "Sending..." : "Confirm Override Send"}
                </button>
                <span className="text-xs text-red-600">Will be logged. Pharmacy may reject.</span>
                <button onClick={() => setShowOverride(false)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* State B: Ready, not approved */}
      {isReady && !isApproved && !isQueued && !isSent && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-green-800">Ready for approval</h2>
            <p className="text-xs text-green-700 mt-0.5">All issues resolved. Approve to proceed.</p>
          </div>
          <button onClick={handleApprove} disabled={acting}
            className="bg-green-600 text-white rounded-md px-5 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 shrink-0 ml-4">
            {acting ? "Approving..." : "Approve Order"}
          </button>
        </div>
      )}

      {/* State C: Approved — primary action is Add to Queue */}
      {isReady && isApproved && !isQueued && !isSent && (
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-green-800">Approved — ready to queue</h2>
              <p className="text-xs text-green-700 mt-0.5">
                Add to the send queue for {pharmacyName}. Orders are sent in batches from the Queue page.
              </p>
            </div>
            <button onClick={handleAddToQueue} disabled={acting}
              className="bg-indigo-600 text-white rounded-md px-5 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0 ml-4">
              {acting ? "Adding..." : "Add to Queue"}
            </button>
          </div>
          <div className="mt-2">
            {!showSendNow ? (
              <button onClick={() => setShowSendNow(true)} className="text-xs text-gray-400 hover:text-gray-600">
                Send immediately instead...
              </button>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => handleSend(false)} disabled={acting}
                  className="border border-purple-300 text-purple-700 rounded px-3 py-1 text-xs font-medium hover:bg-purple-50 disabled:opacity-50">
                  {acting ? "Sending..." : "Send Now"}
                </button>
                <span className="text-xs text-gray-500">Bypasses the queue and sends directly.</span>
                <button onClick={() => setShowSendNow(false)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* State D: In Queue */}
      {isQueued && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Queued for {pharmacyName}</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              This order will be sent from the Queue page with other orders for this pharmacy.
            </p>
          </div>
          <a href="/queue" className="border border-indigo-300 text-indigo-700 rounded-md px-4 py-1.5 text-xs font-medium hover:bg-indigo-50 shrink-0 ml-4">
            Go to Queue
          </a>
        </div>
      )}

      {/* State E: Sent */}
      {isSent && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Sent to {pharmacyName}</h2>
            <p className="text-xs text-gray-600 mt-0.5">This order has been transmitted.{alreadySent && " You can resend if needed."}</p>
          </div>
          <button onClick={() => handleSend(false)} disabled={acting}
            className="border border-purple-300 text-purple-700 rounded-md px-4 py-1.5 text-xs font-medium hover:bg-purple-50 disabled:opacity-50 shrink-0 ml-4">
            {acting ? "Sending..." : "Resend"}
          </button>
        </div>
      )}
    </div>
  );
}
