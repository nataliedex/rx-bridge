"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveCorrectionRequest } from "@/lib/actions";
import { OpenIssues } from "./open-issues";
import { CorrectionRequestDrawer } from "./correction-request-drawer";
import { ORDER_SOURCE_LABELS, type OrderSource } from "@/lib/types";

interface IssueItem {
  id: string;
  type: string;
  severity: string;
  source: string;
  fieldPath: string | null;
  title: string;
  message: string;
  status: string;
  resolutionNote: string | null;
  resolvedAt: Date | null;
}

interface CorrectionRequest {
  id: string;
  reason: string;
  requestedFrom: string;
  message: string | null;
  status: string;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
}

interface Props {
  orderId: string;
  isInbound: boolean;
  orderSource: string;
  issues: IssueItem[];
  sendReadiness: string;
  correctionRequests: CorrectionRequest[];
}

const RECIPIENT_LABELS: Record<string, string> = {
  provider: "Provider",
  clinician: "Clinician",
  brand: "Brand",
};

export function OrderCorrectionPanel({ orderId, isInbound, orderSource, issues, sendReadiness, correctionRequests }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defaultReason, setDefaultReason] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const openRequests = correctionRequests.filter((r) => r.status === "open");
  const resolvedRequests = correctionRequests.filter((r) => r.status === "resolved");

  function handleRequestCorrection(reason: string) {
    setDefaultReason(reason);
    setDrawerOpen(true);
  }

  async function handleResolveRequest(requestId: string) {
    setResolvingId(requestId);
    try {
      await resolveCorrectionRequest(requestId, "Corrected information received");
      router.refresh();
    } catch {
      // stay
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <>
      {/* Issues list */}
      <OpenIssues
        issues={issues}
        sendReadiness={sendReadiness}
        isInbound={isInbound}
        onRequestCorrection={isInbound ? handleRequestCorrection : undefined}
      />

      {/* Inbound order: show request correction button when there are open issues */}
      {isInbound && issues.filter((i) => i.status === "open").length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-800">Inbound order from {ORDER_SOURCE_LABELS[orderSource as OrderSource] || orderSource}</p>
              <p className="text-xs text-purple-600 mt-0.5">
                Prescription data cannot be edited directly. Request a correction from the original source.
              </p>
            </div>
            <button onClick={() => { setDefaultReason(""); setDrawerOpen(true); }}
              className="bg-purple-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-purple-700 shrink-0 ml-4">
              Request Correction
            </button>
          </div>
        </div>
      )}

      {/* Open correction requests */}
      {openRequests.length > 0 && (
        <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-purple-800">Pending Correction Requests</h3>
          {openRequests.map((req) => (
            <div key={req.id} className="bg-white border border-purple-100 rounded-md px-3 py-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-medium text-gray-900">{req.reason}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                      {RECIPIENT_LABELS[req.requestedFrom] || req.requestedFrom}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Requested {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {req.message && <p className="text-xs text-gray-500 mt-1">{req.message}</p>}
                </div>
                <button
                  onClick={() => handleResolveRequest(req.id)}
                  disabled={resolvingId === req.id}
                  className="text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50 shrink-0 ml-3"
                >
                  {resolvingId === req.id ? "..." : "Mark Received"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved correction requests — collapsed */}
      {resolvedRequests.length > 0 && (
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
            {resolvedRequests.length} resolved correction request{resolvedRequests.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-1.5">
            {resolvedRequests.map((req) => (
              <div key={req.id} className="bg-white/50 border border-gray-100 rounded-md px-3 py-2">
                <p className="text-sm text-gray-400 line-through">{req.reason}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{RECIPIENT_LABELS[req.requestedFrom] || req.requestedFrom}</span>
                  {req.resolvedAt && <span className="text-[10px] text-green-500">Resolved {new Date(req.resolvedAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <CorrectionRequestDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        orderId={orderId}
        defaultReason={defaultReason}
      />
    </>
  );
}
