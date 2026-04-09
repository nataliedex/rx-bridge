"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendProposal } from "@/lib/actions";
import { Drawer } from "./drawer";

interface ProposalLine {
  medicationName: string;
  currentCost: number;
  proposedPrice: number | null;
  unitSavings: number | null;
  unitProfit: number | null;
  monthlyQty: number;
  pharmacyName: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  medSpaId: string;
  medSpaName: string;
  contactEmail: string | null;
  proposalLines: ProposalLine[];
  monthlySavings: number;
  monthlyProfit: number;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function SendProposalModal({ open, onClose, medSpaId, medSpaName, contactEmail, proposalLines, monthlySavings, monthlyProfit }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(contactEmail ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(contactEmail ?? "");
      setMessage("");
      setError(""); setSuccess(false);
    }
  }, [open, contactEmail]);

  async function handleSend() {
    if (!email.trim()) { setError("Email is required"); return; }
    setSaving(true); setError("");
    try {
      await sendProposal(medSpaId, {
        recipientEmail: email.trim(),
        message: message.trim() || undefined,
        monthlySavings,
        monthlyProfit,
        pricingSnapshot: JSON.stringify(proposalLines),
      });
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Send Proposal">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>{"\u2713"}</span> Proposal sent to {email}
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sending to</p>
            <p className="text-sm font-medium text-gray-900">{medSpaName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{proposalLines.length} medication{proposalLines.length !== 1 ? "s" : ""} in proposal</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recipient email <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="client@medspa.com" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="Hi — here's our proposed pricing for your review." className={inputClass} />
          </div>

          <p className="text-[10px] text-gray-400">The client will receive a link to review and accept the proposal.</p>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex gap-2">
              <button onClick={handleSend} disabled={saving || !email.trim()}
                className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Sending..." : "Send Proposal"}
              </button>
              <button onClick={onClose} className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
