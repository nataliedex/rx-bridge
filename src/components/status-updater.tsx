"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
  hasBlockingIssues: boolean;
  orderSource: string;
}

// Allowed forward transitions from each stage.
// "needs_clarification" and "rejected" are always available as exception paths.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft:                  ["under_review", "needs_clarification", "correction_requested", "rejected"],
  submitted:              ["under_review", "needs_clarification", "correction_requested", "rejected"],
  under_review:           ["approved", "needs_clarification", "correction_requested", "rejected"],
  needs_clarification:    ["under_review", "approved", "correction_requested", "rejected"],
  correction_requested:   ["under_review", "rejected"],
  approved:               ["queued", "needs_clarification", "rejected"],
  queued:                 ["sent_to_pharmacy", "needs_clarification", "rejected"],
  sent_to_pharmacy:       ["completed", "needs_clarification", "rejected"],
  completed:              [],
  rejected:               [],
};

// Stages that require no blocking issues
const REQUIRES_READY: Set<string> = new Set(["approved", "queued", "sent_to_pharmacy", "completed"]);

function getOptions(currentStatus: OrderStatus, hasBlockingIssues: boolean): { value: OrderStatus; disabled: boolean; hint: string }[] {
  const allowed = TRANSITIONS[currentStatus] || [];
  const result: { value: OrderStatus; disabled: boolean; hint: string }[] = [];

  // Current stage is always first
  result.push({ value: currentStatus, disabled: false, hint: "" });

  for (const s of allowed) {
    const blocked = hasBlockingIssues && REQUIRES_READY.has(s);
    result.push({ value: s, disabled: blocked, hint: blocked ? "(resolve issues first)" : "" });
  }

  return result;
}

export function StatusUpdater({ orderId, currentStatus, hasBlockingIssues }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const options = getOptions(currentStatus, hasBlockingIssues);
  const selectedOption = options.find((o) => o.value === status);
  const isDisabled = selectedOption?.disabled || false;
  const noTransitions = options.length <= 1;

  const [confirmingDestructive, setConfirmingDestructive] = useState(false);
  const isDestructive = status === "rejected";

  async function handleUpdate() {
    if (status === currentStatus) return;
    if (isDestructive && !confirmingDestructive) {
      setConfirmingDestructive(true);
      return;
    }
    setUpdating(true);
    setError("");
    setConfirmingDestructive(false);
    try {
      await updateOrderStatus(orderId, status, note);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdating(false);
    }
  }

  if (noTransitions) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-1">Stage</h3>
        <p className="text-sm text-gray-600">{STATUS_LABELS[currentStatus]}</p>
        <p className="text-xs text-gray-400 mt-1">This order has reached a final stage.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Update Status</h3>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      <select
        value={status}
        onChange={(e) => { setStatus(e.target.value as OrderStatus); setConfirmingDestructive(false); }}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {STATUS_LABELS[o.value]}{o.value === currentStatus ? " (current)" : ""}{o.hint ? ` ${o.hint}` : ""}
          </option>
        ))}
      </select>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note..."
        rows={2}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
      />

      {confirmingDestructive && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-3">
          <p className="text-xs text-red-700 font-medium">Reject this order? This action cannot be undone.</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleUpdate}
          disabled={updating || status === currentStatus || isDisabled}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors ${
            confirmingDestructive
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {updating ? "Updating..." : confirmingDestructive ? "Yes, Reject Order" : "Update Status"}
        </button>
        {confirmingDestructive && (
          <button
            onClick={() => setConfirmingDestructive(false)}
            className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Used for exceptions. Most orders follow the standard workflow.
      </p>
    </div>
  );
}
