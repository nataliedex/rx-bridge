"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMedicationPrice } from "@/lib/actions";
import { formatCurrency, getPricingUnit, calcSellPriceFromMarkup, calcMarkupFromSellPrice, calcMarginPct } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
  medicationId: string;
  medicationName: string;
  medicationForm?: string;
  pharmacyId: string;
  pharmacyName: string;
  currentPrice: number;
  currentSellPrice?: number | null;
  defaultMarkupPct?: number;
  onRemove?: () => void;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function UpdatePriceDrawer({ open, onClose, medicationId, medicationName, medicationForm, pharmacyId, pharmacyName, currentPrice, currentSellPrice, defaultMarkupPct = 25, onRemove }: Props) {
  const router = useRouter();
  const costRef = useRef<HTMLInputElement>(null);
  const [newCost, setNewCost] = useState("");
  const [newSellPrice, setNewSellPrice] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setNewCost(""); setNewSellPrice("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setNotes(""); setError(""); setSuccess(false);
      setTimeout(() => costRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleSave() {
    const cost = parseFloat(newCost);
    if (isNaN(cost) || cost <= 0) { setError("Enter a valid cost"); return; }
    if (!effectiveDate) { setError("Effective date is required"); return; }
    const sell = newSellPrice ? parseFloat(newSellPrice) : undefined;
    if (sell != null && (isNaN(sell) || sell <= 0)) { setError("Enter a valid client price"); return; }
    // If no explicit sell price entered, use suggested
    const finalSell = sell ?? suggestedSell;
    setSaving(true); setError("");
    try {
      await updateMedicationPrice(medicationId, pharmacyId, cost, effectiveDate, notes, finalSell > 0 ? finalSell : undefined);
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !saving) { e.preventDefault(); handleSave(); }
  }

  const unit = medicationForm ? getPricingUnit(medicationForm) : "unit";

  // Compute suggested sell price from the cost being entered (or current cost)
  const activeCost = parseFloat(newCost) || currentPrice;
  const suggestedSell = calcSellPriceFromMarkup(activeCost, defaultMarkupPct);

  // Determine actual sell price for preview
  const actualSell = parseFloat(newSellPrice) || currentSellPrice || suggestedSell;
  const isOverridden = newSellPrice !== "" && Math.abs(parseFloat(newSellPrice) - suggestedSell) > 0.01;

  // Profit preview
  const grossProfit = actualSell - activeCost;
  const marginPct = calcMarginPct(actualSell, activeCost);
  const markupPct = calcMarkupFromSellPrice(actualSell, activeCost);

  const costDiff = parseFloat(newCost) > 0 ? parseFloat(newCost) - currentPrice : null;

  return (
    <Drawer open={open} onClose={onClose} title="Update Pricing">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Pricing updated
        </div>
      ) : (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {error && <p className="text-red-600 text-xs">{error}</p>}

          {/* Context */}
          <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Medication</p>
              <p className="text-sm font-medium text-gray-900">{medicationName}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pharmacy</p>
              <p className="text-sm text-gray-700">{pharmacyName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Your Cost</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(currentPrice)} <span className="text-xs font-normal text-gray-400">/ {unit}</span></p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Client Price</p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentSellPrice != null ? <>{formatCurrency(currentSellPrice)} <span className="text-xs font-normal text-gray-400">/ {unit}</span></> : <span className="text-gray-400">Not set</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Pharmacy Cost */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your Cost <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input ref={costRef} type="number" step="0.01" min="0" value={newCost}
                onChange={(e) => setNewCost(e.target.value)} placeholder={currentPrice.toFixed(2)}
                className={`${inputClass} pl-7`} />
            </div>
            {costDiff !== null && (
              <p className={`text-xs mt-1 ${costDiff < 0 ? "text-green-600" : costDiff > 0 ? "text-red-500" : "text-gray-400"}`}>
                {costDiff < 0 ? `${formatCurrency(Math.abs(costDiff))} decrease` : costDiff > 0 ? `${formatCurrency(costDiff)} increase` : "No change"}
              </p>
            )}
          </div>

          {/* Suggested Sell Price — read only */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Suggested Client Price</label>
            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 font-medium">
              {formatCurrency(suggestedSell)} <span className="text-xs font-normal text-gray-400">/ {unit}</span>
              <span className="text-[10px] text-gray-400 ml-2">({defaultMarkupPct}% markup)</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Based on {defaultMarkupPct}% markup over your cost</p>
          </div>

          {/* Current Client Price — editable */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current Client Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" step="0.01" min="0" value={newSellPrice}
                onChange={(e) => setNewSellPrice(e.target.value)}
                placeholder={suggestedSell.toFixed(2)}
                className={`${inputClass} pl-7`} />
            </div>
            {isOverridden ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Override</span>
                <button type="button" onClick={() => setNewSellPrice("")}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">Use Suggested Price</button>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">Leave blank to use suggested price</p>
            )}
          </div>

          {/* Difference from Suggested */}
          {isOverridden && (() => {
            const diff = parseFloat(newSellPrice) - suggestedSell;
            return (
              <div className="bg-amber-50/50 border border-amber-200 rounded-md px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-700">Difference from Suggested</span>
                  <span className={`text-sm font-medium ${diff > 0 ? "text-amber-700" : "text-blue-600"}`}>
                    {diff > 0 ? "+" : ""}{formatCurrency(diff)} <span className="font-normal text-xs">/ {unit}</span>
                  </span>
                </div>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  {diff > 0 ? "Above" : "Below"} the {defaultMarkupPct}% markup recommendation
                </p>
              </div>
            );
          })()}

          {/* Profit preview */}
          <div className={`rounded-md px-3 py-2.5 ${grossProfit > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Your Profit</span>
              <span className={`text-sm font-bold ${grossProfit > 0 ? "text-green-700" : grossProfit < 0 ? "text-red-600" : "text-gray-400"}`}>
                {formatCurrency(grossProfit)} <span className="font-normal text-xs">/ {unit}</span>
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500">Margin %</span>
              <span className={`text-sm font-medium ${grossProfit > 0 ? "text-green-700" : grossProfit < 0 ? "text-red-600" : "text-gray-400"}`}>{marginPct}%</span>
            </div>
            {grossProfit > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">Markup {markupPct}%</span>
              </div>
            )}
            {isOverridden && (() => {
              const suggestedProfit = suggestedSell - activeCost;
              const suggestedMargin = calcMarginPct(suggestedSell, activeCost);
              return (
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-200/50">
                  <span className="text-[10px] text-gray-400">Profit at Suggested</span>
                  <span className="text-[11px] text-gray-400">{formatCurrency(suggestedProfit)} / {unit} ({suggestedMargin}%)</span>
                </div>
              );
            })()}
          </div>

          {/* Effective date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
            <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputClass} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="e.g. GPO renegotiation, contract renewal..." className={inputClass} />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving..." : "Update Pricing"}
              </button>
              <button onClick={onClose} className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Saving marks this cost as verified today.</p>
          </div>

          {onRemove && (
            <div className="pt-3 mt-3 border-t border-gray-100">
              <button onClick={onRemove} className="text-xs text-gray-400 hover:text-red-600 transition-colors">
                Remove this price entry
              </button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
