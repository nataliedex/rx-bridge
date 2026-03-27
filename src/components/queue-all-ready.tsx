"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkAddToQueue } from "@/lib/actions";

interface Props {
  orderIds: string[];
}

export function QueueAllReady({ orderIds }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const count = orderIds.length;

  if (count === 0) return null;

  async function handleConfirm() {
    setProcessing(true);
    setResult(null);
    try {
      const results = await bulkAddToQueue(orderIds);
      const success = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      setResult({ success, failed });
      setConfirming(false);
      router.refresh();
      // Clear result after 3 seconds
      setTimeout(() => setResult(null), 3000);
    } catch {
      setResult({ success: 0, failed: count });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="relative inline-block">
      {/* Success toast */}
      {result && (
        <div className={`absolute right-0 top-full mt-2 z-10 rounded-md px-3 py-2 text-xs font-medium shadow-lg whitespace-nowrap ${
          result.failed === 0 ? "bg-green-600 text-white" : "bg-amber-500 text-white"
        }`}>
          {result.failed === 0
            ? `${result.success} order${result.success !== 1 ? "s" : ""} queued`
            : `${result.success} queued, ${result.failed} failed`
          }
        </div>
      )}

      {/* Confirmation */}
      {confirming && (
        <div className="absolute right-0 top-full mt-2 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
          <p className="text-sm font-medium text-gray-900 mb-1">Queue {count} order{count !== 1 ? "s" : ""}?</p>
          <p className="text-xs text-gray-500 mb-3">These approved orders will be added to the pharmacy send queue.</p>
          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={processing}
              className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {processing ? "Queueing..." : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={processing}
              className="border border-gray-300 text-gray-700 rounded-md px-3 py-1.5 text-xs hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Button */}
      <button
        onClick={() => setConfirming(true)}
        className="border border-indigo-300 text-indigo-700 rounded-md px-3 py-2 text-sm font-medium hover:bg-indigo-50 transition-colors"
      >
        Queue All Ready ({count})
      </button>
    </div>
  );
}
