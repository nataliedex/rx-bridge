"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMedicationPrice } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
  medicationId: string;
  medicationName: string;
  pharmacyId: string;
  pharmacyName: string;
  currentPrice: number;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function UpdatePriceDrawer({ open, onClose, medicationId, medicationName, pharmacyId, pharmacyName, currentPrice }: Props) {
  const router = useRouter();
  const priceRef = useRef<HTMLInputElement>(null);
  const [newPrice, setNewPrice] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setNewPrice("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setError("");
      setSuccess(false);
      setTimeout(() => priceRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleSave() {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) { setError("Enter a valid price"); return; }
    if (!effectiveDate) { setError("Effective date is required"); return; }
    setSaving(true); setError("");
    try {
      await updateMedicationPrice(medicationId, pharmacyId, price, effectiveDate, notes);
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !saving) { e.preventDefault(); handleSave(); }
  }

  const priceNum = parseFloat(newPrice);
  const diff = !isNaN(priceNum) && priceNum > 0 ? priceNum - currentPrice : null;

  return (
    <Drawer open={open} onClose={onClose} title="Update Price">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Price updated
        </div>
      ) : (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {error && <p className="text-red-600 text-xs">{error}</p>}

          {/* Read-only context */}
          <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Medication</p>
              <p className="text-sm font-medium text-gray-900">{medicationName}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pharmacy</p>
              <p className="text-sm text-gray-700">{pharmacyName}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Price</p>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(currentPrice)}</p>
            </div>
          </div>

          {/* New price */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Price <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                ref={priceRef}
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={currentPrice.toFixed(2)}
                className={`${inputClass} pl-7`}
              />
            </div>
            {diff !== null && (
              <p className={`text-xs mt-1 ${diff < 0 ? "text-green-600" : diff > 0 ? "text-red-500" : "text-gray-400"}`}>
                {diff < 0 ? `${formatCurrency(Math.abs(diff))} decrease` : diff > 0 ? `${formatCurrency(diff)} increase` : "No change"}
              </p>
            )}
          </div>

          {/* Effective date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. GPO renegotiation, contract renewal..."
              className={inputClass}
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Update Price"}
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
