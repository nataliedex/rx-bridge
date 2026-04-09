"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePricingStrategy, type PricingStrategy, type PricingMode } from "@/lib/actions";

interface Props {
  initial: PricingStrategy;
}

export function PricingStrategyEditor({ initial }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<PricingMode>(initial.mode);
  const [markup, setMarkup] = useState(String(initial.defaultMarkupPct));
  const [allowMedOverrides, setAllowMedOverrides] = useState(initial.allowMedicationOverrides);
  const [allowSpaOverrides, setAllowSpaOverrides] = useState(initial.allowMedSpaOverrides);
  const [freshnessMonths, setFreshnessMonths] = useState(String(initial.freshnessMonths ?? 12));
  const [contractTermMonths, setContractTermMonths] = useState(String(initial.defaultContractTermMonths ?? 12));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await savePricingStrategy({
        mode,
        defaultMarkupPct: parseFloat(markup) || 25,
        allowMedicationOverrides: allowMedOverrides,
        allowMedSpaOverrides: allowSpaOverrides,
        freshnessMonths: parseInt(freshnessMonths) || 12,
        defaultContractTermMonths: parseInt(contractTermMonths) || 12,
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch { /* stay */ }
    finally { setSaving(false); }
  }

  const isDirty = mode !== initial.mode
    || markup !== String(initial.defaultMarkupPct)
    || allowMedOverrides !== initial.allowMedicationOverrides
    || allowSpaOverrides !== initial.allowMedSpaOverrides
    || freshnessMonths !== String(initial.freshnessMonths ?? 12)
    || contractTermMonths !== String(initial.defaultContractTermMonths ?? 12);

  const markupNum = parseFloat(markup) || 25;
  const exampleCost = 100;
  const exampleSell = (exampleCost * (1 + markupNum / 100)).toFixed(2);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Pricing Strategy */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Pricing Strategy</h2>
        <p className="text-xs text-gray-500 mt-1 mb-5">Choose how Bisk calculates client pricing from your cost</p>

        <div className="space-y-3">
          {/* Markup-Based */}
          <label
            className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
              mode === "markup_based" ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input type="radio" name="pricing_mode" value="markup_based"
              checked={mode === "markup_based"} onChange={() => setMode("markup_based")} className="mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">Markup-Based Pricing</p>
                <span className="text-[9px] font-medium text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">Recommended</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Client price is calculated from your cost plus a target markup percentage. Markup is the source of truth.</p>
              <p className="text-[10px] text-gray-400 mt-1 font-mono">client price = your cost &times; (1 + markup%)</p>
            </div>
          </label>

          {/* Fixed Sell Price */}
          <label
            className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
              mode === "fixed_sell_price" ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input type="radio" name="pricing_mode" value="fixed_sell_price"
              checked={mode === "fixed_sell_price"} onChange={() => setMode("fixed_sell_price")} className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Fixed Client Price</p>
              <p className="text-xs text-gray-500 mt-1">Client price is manually set per medication. Markup and margin are derived from the difference between client price and your cost.</p>
              <p className="text-[10px] text-gray-400 mt-1 font-mono">markup% = (client price - your cost) / your cost</p>
            </div>
          </label>
        </div>

        {mode === "markup_based" && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-600 mb-1">Default Target Markup %</label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <input type="number" min="1" max="200" step="1" value={markup}
                onChange={(e) => setMarkup(e.target.value)}
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              At {markup}% markup, a ${exampleCost} cost results in a ${exampleSell} client price.
            </p>
          </div>
        )}

        {mode === "fixed_sell_price" && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500">Client prices must be entered manually at the medication or program level. There is no global default client price.</p>
          </div>
        )}
      </div>

      {/* Sell Price Overrides */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Client Price Overrides</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Control where client price can deviate from the global strategy</p>

        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900">Allow per-medication client price overrides</p>
              <p className="text-xs text-gray-500 mt-0.5">Individual medications can have a custom client price that differs from the global markup</p>
            </div>
            <button type="button" onClick={() => setAllowMedOverrides(!allowMedOverrides)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${allowMedOverrides ? "bg-indigo-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${allowMedOverrides ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </label>

          <label className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="text-sm text-gray-900">Allow per-med spa client price overrides</p>
              <p className="text-xs text-gray-500 mt-0.5">Specific med spa accounts can have custom client prices that differ from the global strategy</p>
            </div>
            <button type="button" onClick={() => setAllowSpaOverrides(!allowSpaOverrides)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${allowSpaOverrides ? "bg-indigo-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${allowSpaOverrides ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </label>
        </div>
      </div>

      {/* Contract Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Contract Settings</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Configure contract terms and pricing freshness</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Default Contract Term</label>
            <select value={contractTermMonths} onChange={(e) => setContractTermMonths(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
              <option value="24">24 months</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Recommended contract duration. &ldquo;Effective Through&rdquo; will default to {contractTermMonths} months from the start date.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-600 mb-1">Pricing Freshness Threshold</label>
            <select value={freshnessMonths} onChange={(e) => setFreshnessMonths(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="9">9 months</option>
              <option value="12">12 months</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Prices not verified within {freshnessMonths} months will show as &ldquo;Needs Renewal&rdquo; on the Pricing page.
            </p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving || !isDirty}
          className="bg-indigo-600 text-white rounded-md px-5 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved</span>}
        {!isDirty && !saved && <span className="text-xs text-gray-400">No unsaved changes</span>}
      </div>
    </div>
  );
}
