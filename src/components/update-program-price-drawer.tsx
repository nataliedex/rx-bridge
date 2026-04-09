"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProgramPricing } from "@/lib/actions";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface Guardrails {
  pricingMode: string;
  enableMarkupGuidance: boolean;
  defaultMarkupPct: number;
  preventNegativeMargin: boolean;
  highlightLowMargin: boolean;
  minimumTargetFeePerScript: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  medicationId: string;
  medicationName: string;
  medicationForm: string;
  currentPrice: number | null;
  bestCost: number | null;
  bestCostPharmacy: string | null;
  defaultTermMonths: number;
  guardrails?: Guardrails;
}

const BISK_FEE = 5.00;
const FEES = [5, 7.50, 10];

function defaultQtyForUnit(unit: string): number {
  switch (unit) {
    case "capsule": case "tablet": case "troche": return 30;
    default: return 1;
  }
}

// Approximate market range based on pharmacy cost — simulates typical med spa retail pricing
function marketRange(cost: number, qty: number): { low: number; high: number } {
  if (qty > 1) {
    // Multi-unit (tablets, capsules): market charges per-unit with modest spread
    const lowPerUnit = cost * 1.15;
    const highPerUnit = cost * 1.60;
    return { low: Math.round(lowPerUnit * 100) / 100, high: Math.round(highPerUnit * 100) / 100 };
  }
  // Single-unit (vials, tubes): wider absolute spread
  if (cost < 50) return { low: Math.round(cost * 1.20), high: Math.round(cost * 1.80) };
  if (cost < 150) return { low: Math.round(cost * 1.15), high: Math.round(cost * 1.55) };
  return { low: Math.round(cost * 1.10), high: Math.round(cost * 1.45) };
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function UpdateProgramPriceDrawer({ open, onClose, medicationId, medicationName, medicationForm, currentPrice, bestCost, bestCostPharmacy, defaultTermMonths, guardrails }: Props) {
  const router = useRouter();
  const unit = getPricingUnit(medicationForm);
  const defaultQty = defaultQtyForUnit(unit);

  const [monthlyQty, setMonthlyQty] = useState(String(defaultQty));
  const [selectedPrice, setSelectedPrice] = useState("");
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
      setMonthlyQty(String(defaultQty));
      // Pre-fill: use current price, or markup suggestion if markup/hybrid mode
      let initialPrice = currentPrice?.toFixed(2) ?? "";
      if (!initialPrice && bestCost != null && guardrails?.enableMarkupGuidance && (guardrails.pricingMode === "markup" || guardrails.pricingMode === "hybrid")) {
        const suggested = Math.round(bestCost * (1 + guardrails.defaultMarkupPct / 100) * 100) / 100;
        initialPrice = suggested.toFixed(2);
      }
      setSelectedPrice(initialPrice);
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
      const d = new Date(); d.setMonth(d.getMonth() + defaultTermMonths);
      setEffectiveThrough(d.toISOString().slice(0, 10));
      setNotes(""); setError(""); setSuccess(false);
    }
  }, [open, currentPrice, defaultTermMonths, defaultQty, bestCost, guardrails]);

  const qty = parseInt(monthlyQty) || 1;
  const price = parseFloat(selectedPrice);
  const hasValidPrice = !isNaN(price) && price > 0 && bestCost != null;
  const market = bestCost != null ? marketRange(bestCost, qty) : null;

  // Market comparison
  const belowMarketLow = hasValidPrice && market ? market.low - price : null;
  const aboveMarketHigh = hasValidPrice && market ? price - market.high : null;
  const withinMarket = hasValidPrice && market ? price >= market.low && price <= market.high : false;

  const marginPct = hasValidPrice && price > 0 ? Math.round(((price - bestCost!) / price) * 100) : null;

  function tierPrice(fee: number): number {
    return bestCost != null ? Math.round((bestCost + fee / qty) * 100) / 100 : 0;
  }

  async function handleSave() {
    if (!hasValidPrice) { setError("Select or enter a valid price"); return; }
    if (!effectiveFrom) { setError("Effective From is required"); return; }
    setSaving(true); setError("");
    try {
      await updateProgramPricing(medicationId, { price, effectiveFrom, effectiveThrough: effectiveThrough || undefined, notes: notes || undefined });
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Set Program Price">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>{"\u2713"}</span> Program price updated
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-red-600 text-xs">{error}</p>}

          {/* Context */}
          <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
            <p className="text-sm font-medium text-gray-900">{medicationName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Price</p>
                <p className="text-sm font-semibold text-gray-900">{currentPrice != null ? `${formatCurrency(currentPrice)} / ${unit}` : "Not set"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pharmacy Cost</p>
                <p className="text-sm font-semibold text-gray-900">
                  {bestCost != null ? `${formatCurrency(bestCost)} / ${unit}` : "No contracts"}
                  {bestCostPharmacy && <span className="text-[10px] font-normal text-gray-400 block">{bestCostPharmacy}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Market pricing */}
          {market && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-md px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Market pricing</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(market.low)} {"\u2013"} {formatCurrency(market.high)} <span className="text-[10px] font-normal text-gray-400">/ {unit}</span></span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Based on pricing across similar med spas</p>
            </div>
          )}

          {/* Monthly quantity */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Monthly Quantity</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={monthlyQty}
                onChange={(e) => setMonthlyQty(e.target.value)}
                className={`w-24 ${inputClass}`} />
              <span className="text-sm text-gray-400">{unit}{qty !== 1 ? "s" : ""} / script</span>
            </div>
          </div>

          {/* Quick-pick pricing */}
          {bestCost != null && (
            <div>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Suggested pricing</p>
              <div className="flex gap-2">
                {FEES.map((fee, i) => {
                  const tp = tierPrice(fee);
                  const isActive = selectedPrice === tp.toFixed(2);
                  return (
                    <button key={fee} type="button"
                      onClick={() => setSelectedPrice(tp.toFixed(2))}
                      className={`flex-1 rounded-md py-2.5 text-center border transition-colors ${
                        isActive ? "bg-indigo-50 border-indigo-300" : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}>
                      <span className={`block text-sm font-semibold tabular-nums ${isActive ? "text-indigo-700" : "text-gray-900"}`}>{formatCurrency(tp)}</span>
                      <span className="block text-[10px] text-gray-400 mt-0.5">{formatCurrency(fee)} fee{i === 1 ? " \u2605" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Markup suggestion notice */}
          {!currentPrice && bestCost != null && guardrails?.enableMarkupGuidance && (guardrails.pricingMode === "markup" || guardrails.pricingMode === "hybrid") && (
            <p className="text-[10px] text-indigo-500">Pre-filled from {guardrails.defaultMarkupPct}% markup guidance. {guardrails.pricingMode === "hybrid" ? "Adjust as needed." : ""}</p>
          )}

          {/* Selected price + market comparison */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your Price ($ per {unit})</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" step="0.01" min="0" value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
                className={`${inputClass} pl-7`} />
            </div>
            {hasValidPrice && market && (() => {
              const aboveLow = Math.round((price - market.low) * 100) / 100;
              const aboveHigh = Math.round((price - market.high) * 100) / 100;
              const belowLow = Math.round((market.low - price) * 100) / 100;
              const rangeSize = market.high - market.low;

              // Below market
              if (price < market.low) {
                const stronglyBelow = market.low > 0 && belowLow / market.low > 0.15;
                return (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[12px] font-medium text-green-700">
                      {stronglyBelow ? "Strongly competitive" : "Competitive"} {"\u2014"} {formatCurrency(belowLow)} below lowest market price
                    </span>
                  </div>
                );
              }

              // Above market
              if (price > market.high) {
                return (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-[12px] font-medium text-amber-600">Above market {"\u2014"} {formatCurrency(aboveHigh)} above highest market price</span>
                  </div>
                );
              }

              // Within range — tiered
              const position = rangeSize > 0 ? (price - market.low) / rangeSize : 0.5;
              if (position <= 0.33) {
                return (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[12px] font-medium text-green-700">Competitive {"\u2014"} close to low end of market</span>
                  </div>
                );
              }
              if (position <= 0.66) {
                return (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                    <span className="text-[12px] text-gray-500">Fair market {"\u2014"} {formatCurrency(aboveLow)} above lowest market price</span>
                  </div>
                );
              }
              return (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[12px] font-medium text-amber-600">High market {"\u2014"} near the top of market range</span>
                </div>
              );
            })()}
          </div>

          {/* Margin + Bisk fee — de-emphasized */}
          {hasValidPrice && (
            <div className="flex items-center gap-4 text-[11px] text-gray-400">
              {marginPct != null && <span>Your margin: {marginPct}%</span>}
              <span>Bisk fee: {formatCurrency(BISK_FEE)} / script</span>
            </div>
          )}

          {/* Guardrail warnings */}
          {hasValidPrice && bestCost != null && (() => {
            const warnings: { type: "error" | "warn"; msg: string }[] = [];
            if (guardrails?.preventNegativeMargin && price < bestCost) {
              warnings.push({ type: "error", msg: "Price is below pharmacy cost \u2014 negative margin." });
            }
            if (guardrails?.highlightLowMargin && guardrails.minimumTargetFeePerScript != null && (price - bestCost) < guardrails.minimumTargetFeePerScript && (price >= bestCost)) {
              warnings.push({ type: "warn", msg: `Margin below minimum target fee of ${formatCurrency(guardrails.minimumTargetFeePerScript)} per script.` });
            }
            if (warnings.length === 0) return null;
            return (
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <div key={i} className={`rounded-md px-3 py-2 text-xs ${w.type === "error" ? "bg-red-50 border border-red-200 text-red-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
                    {w.msg}
                  </div>
                ))}
              </div>
            );
          })()}

          {bestCost == null && (
            <div className="rounded-md px-3 py-2 bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">Add a pharmacy contract first to set pricing.</p>
            </div>
          )}

          {/* Term dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective From <span className="text-red-500">*</span></label>
              <input type="date" value={effectiveFrom} onChange={(e) => {
                setEffectiveFrom(e.target.value);
                if (e.target.value) {
                  const d = new Date(e.target.value);
                  d.setMonth(d.getMonth() + defaultTermMonths);
                  setEffectiveThrough(d.toISOString().slice(0, 10));
                }
              }} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective Through</label>
              <input type="date" value={effectiveThrough} onChange={(e) => setEffectiveThrough(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Optional" className={inputClass} />
          </div>

          {/* Save */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !hasValidPrice}
                className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={onClose} className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
