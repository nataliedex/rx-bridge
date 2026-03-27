"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCorrectionRequest } from "@/lib/actions";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string;
  defaultReason?: string;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

const RECIPIENTS = [
  { value: "provider", label: "Provider / Prescriber" },
  { value: "clinician", label: "Clinician" },
  { value: "brand", label: "Brand" },
];

export function CorrectionRequestDrawer({ open, onClose, orderId, defaultReason }: Props) {
  const router = useRouter();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [requestedFrom, setRequestedFrom] = useState("provider");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(defaultReason || "");
      setRequestedFrom("provider");
      setMessage("");
      setError("");
      setSuccess(false);
      setTimeout(() => reasonRef.current?.focus(), 100);
    }
  }, [open, defaultReason]);

  async function handleSend() {
    if (!reason.trim()) { setError("Describe what needs correcting"); return; }
    setSaving(true); setError("");
    try {
      await createCorrectionRequest(orderId, { reason, requestedFrom, message });
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Request Correction">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Correction request sent
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
            <p className="text-xs text-purple-700">
              This order was submitted by an external source. Rx-Bridge cannot edit prescription data directly.
              Use this form to request a correction from the original source.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">What needs correcting? <span className="text-red-500">*</span></label>
            <textarea
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Patient DOB is missing, prescriber NPI is invalid..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Request from <span className="text-red-500">*</span></label>
            <select value={requestedFrom} onChange={(e) => setRequestedFrom(e.target.value)} className={inputClass}>
              {RECIPIENTS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Additional context for the recipient..."
              className={inputClass}
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleSend} disabled={saving}
              className="bg-purple-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {saving ? "Sending..." : "Send Correction Request"}
            </button>
            <button onClick={onClose} className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
