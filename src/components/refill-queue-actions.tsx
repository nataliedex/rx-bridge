"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RefillRow {
  id: string;
  patient: string;
  medicationName: string;
}

interface BulkProps {
  refills: RefillRow[];
}

export function RefillQueueBulkSend({ refills }: BulkProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const count = refills.length;
  if (count === 0) return null;

  async function handleConfirm() {
    setProcessing(true);
    setResult(null);
    try {
      const results = await Promise.all(
        refills.map(async (r) => {
          const res = await fetch(`/api/refills/${r.id}/send`, { method: "POST" });
          return { id: r.id, ok: res.ok };
        })
      );
      const success = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok).length;
      setResult({ success, failed });
      setConfirming(false);
      router.refresh();
      setTimeout(() => setResult(null), 3000);
    } catch {
      setResult({ success: 0, failed: count });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="relative inline-block">
      {result && (
        <div className={`absolute right-0 top-full mt-2 z-10 rounded-md px-3 py-2 text-xs font-medium shadow-lg whitespace-nowrap ${
          result.failed === 0 ? "bg-green-600 text-white" : "bg-amber-500 text-white"
        }`}>
          {result.failed === 0
            ? `${result.success} refill${result.success !== 1 ? "s" : ""} sent`
            : `${result.success} sent, ${result.failed} failed`
          }
        </div>
      )}

      {confirming && (
        <div className="absolute right-0 top-full mt-2 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
          <p className="text-sm font-medium text-gray-900 mb-1">Send {count} refill{count !== 1 ? "s" : ""} to pharmacy?</p>
          <p className="text-xs text-gray-500 mb-3">All validated refills will be transmitted.</p>
          <div className="flex gap-2">
            <button onClick={handleConfirm} disabled={processing}
              className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {processing ? "Sending..." : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={processing}
              className="border border-gray-300 text-gray-700 rounded-md px-3 py-1.5 text-xs hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setConfirming(true)}
        className="bg-indigo-600 text-white rounded-md px-5 py-2 text-sm font-semibold hover:bg-indigo-700 transition-colors">
        Send All Refills ({count})
      </button>
    </div>
  );
}

export function RefillQueueSendOne({ refillId }: { refillId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch(`/api/refills/${refillId}/send`, { method: "POST" });
      if (res.ok) router.refresh();
    } catch {
      // stay
    } finally {
      setSending(false);
    }
  }

  return (
    <button onClick={handleSend} disabled={sending}
      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
      {sending ? "..." : "Send"}
    </button>
  );
}
