"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/actions";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

export function StatusUpdater({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  async function handleUpdate() {
    if (status === currentStatus) return;
    setUpdating(true);
    setError("");
    try {
      await updateOrderStatus(orderId, status, note);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Update Status</h3>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as OrderStatus)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
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

      <button
        onClick={handleUpdate}
        disabled={updating || status === currentStatus}
        className="w-full bg-indigo-600 text-white rounded-md px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {updating ? "Updating..." : "Update Status"}
      </button>

      <p className="text-xs text-gray-400 mt-2">
        Status reflects human decisions. Use Approve and Send actions above for the standard workflow.
      </p>
    </div>
  );
}
