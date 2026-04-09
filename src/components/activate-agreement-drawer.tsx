"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { activateAgreement } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface ProposalLine {
  medicationName: string;
  medicationId: string;
  agreedPrice: number;
  pharmacyId: string;
  pharmacyName: string;
  monthlyQty: number;
  unit: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  medSpaId: string;
  medSpaName: string;
  proposalLines: ProposalLine[];
  defaultTermMonths: number;
  isRenewal?: boolean;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function ActivateAgreementDrawer({ open, onClose, medSpaId, medSpaName, proposalLines, defaultTermMonths, isRenewal }: Props) {
  const router = useRouter();
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveThrough, setEffectiveThrough] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + defaultTermMonths);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      const d = new Date(); d.setMonth(d.getMonth() + defaultTermMonths);
      setEffectiveThrough(d.toISOString().slice(0, 10));
      setNotes(""); setError(""); setSuccess(false);
    }
  }, [open, defaultTermMonths]);

  async function handleSave() {
    if (!effectiveFrom || !effectiveThrough) { setError("Both dates are required"); return; }
    if (proposalLines.length === 0) { setError("No medications in proposal"); return; }
    setSaving(true); setError("");
    try {
      await activateAgreement(medSpaId, {
        effectiveFrom,
        effectiveThrough,
        notes: notes || undefined,
        lines: proposalLines.map((l) => ({
          medicationId: l.medicationId,
          medicationName: l.medicationName,
          agreedPrice: l.agreedPrice,
          pharmacyId: l.pharmacyId,
          pharmacyName: l.pharmacyName,
          estimatedMonthlyQty: l.monthlyQty,
        })),
      });
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate");
    } finally { setSaving(false); }
  }

  const totalMonthly = proposalLines.reduce((s, l) => s + l.agreedPrice * l.monthlyQty, 0);

  return (
    <Drawer open={open} onClose={onClose} title={isRenewal ? "Renew Agreement" : "Activate Agreement"}>
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>{"\u2713"}</span> Agreement {isRenewal ? "renewed" : "activated"} with {proposalLines.length} medication{proposalLines.length !== 1 ? "s" : ""}
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Med Spa</p>
            <p className="text-sm font-medium text-gray-900">{medSpaName}</p>
          </div>

          {/* Agreement snapshot */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Pricing ({proposalLines.length} medications)</label>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-400 uppercase">Medication</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-medium text-gray-400 uppercase">Price</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-400 uppercase">Pharmacy</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-medium text-gray-400 uppercase">Mo. Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {proposalLines.map((l, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-1.5 text-gray-900">{l.medicationName}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-gray-900">{formatCurrency(l.agreedPrice)} <span className="text-[10px] text-gray-400">/ {l.unit}</span></td>
                      <td className="px-3 py-1.5 text-gray-500">{l.pharmacyName}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{l.monthlyQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Est. monthly: {formatCurrency(totalMonthly)}</p>
          </div>

          {/* Term */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective From <span className="text-red-500">*</span></label>
              <input type="date" value={effectiveFrom} onChange={(e) => {
                setEffectiveFrom(e.target.value);
                if (e.target.value) {
                  const d = new Date(e.target.value); d.setMonth(d.getMonth() + defaultTermMonths);
                  setEffectiveThrough(d.toISOString().slice(0, 10));
                }
              }} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective Through <span className="text-red-500">*</span></label>
              <input type="date" value={effectiveThrough} onChange={(e) => setEffectiveThrough(e.target.value)} className={inputClass} />
              <p className="text-[10px] text-gray-400 mt-0.5">{defaultTermMonths} month default</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Signed after pricing call..." className={inputClass} />
          </div>

          {/* Save */}
          <div className="pt-4 border-t border-gray-100">
            <button onClick={handleSave} disabled={saving || proposalLines.length === 0}
              className="w-full bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : isRenewal ? "Renew Agreement" : "Activate Agreement"}
            </button>
            <p className="text-[10px] text-gray-400 mt-2 text-center">Creates a binding pricing agreement. Previous agreements will be superseded.</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
