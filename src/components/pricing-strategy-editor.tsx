"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePricingStrategy, type PricingStrategy, type PricingMode } from "@/lib/actions";

interface Props {
  initial: PricingStrategy;
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${on ? "bg-indigo-600" : "bg-gray-200"}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function PricingStrategyEditor({ initial }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<PricingMode>(initial.mode);
  const [enableMarkupGuidance, setEnableMarkupGuidance] = useState(initial.enableMarkupGuidance);
  const [markup, setMarkup] = useState(String(initial.defaultMarkupPct));
  const [preventNegativeMargin, setPreventNegativeMargin] = useState(initial.preventNegativeMargin);
  const [highlightLowMargin, setHighlightLowMargin] = useState(initial.highlightLowMargin);
  const [minFee, setMinFee] = useState(String(initial.minimumTargetFeePerScript ?? ""));
  const [allowManualOverrides, setAllowManualOverrides] = useState(initial.allowManualOverrides);
  const [freshnessMonths, setFreshnessMonths] = useState(String(initial.freshnessMonths ?? 12));
  const [contractTermMonths, setContractTermMonths] = useState(String(initial.defaultContractTermMonths ?? 12));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Auto-sync markup guidance with mode
  function handleModeChange(newMode: PricingMode) {
    setMode(newMode);
    if (newMode === "markup") setEnableMarkupGuidance(true);
    if (newMode === "hybrid") setEnableMarkupGuidance(true);
    if (newMode === "manual") setEnableMarkupGuidance(false);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await savePricingStrategy({
        mode,
        enableMarkupGuidance,
        defaultMarkupPct: parseFloat(markup) || 25,
        preventNegativeMargin,
        highlightLowMargin,
        minimumTargetFeePerScript: minFee ? parseFloat(minFee) : null,
        allowManualOverrides,
        freshnessMonths: parseInt(freshnessMonths) || 12,
        defaultContractTermMonths: parseInt(contractTermMonths) || 12,
        allowMedicationOverrides: allowManualOverrides,
        allowMedSpaOverrides: allowManualOverrides,
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch { /* stay */ }
    finally { setSaving(false); }
  }

  const isDirty = mode !== initial.mode
    || enableMarkupGuidance !== initial.enableMarkupGuidance
    || markup !== String(initial.defaultMarkupPct)
    || preventNegativeMargin !== initial.preventNegativeMargin
    || highlightLowMargin !== initial.highlightLowMargin
    || minFee !== String(initial.minimumTargetFeePerScript ?? "")
    || allowManualOverrides !== initial.allowManualOverrides
    || freshnessMonths !== String(initial.freshnessMonths ?? 12)
    || contractTermMonths !== String(initial.defaultContractTermMonths ?? 12);

  const markupNum = parseFloat(markup) || 25;
  const exampleCost = 100;
  const exampleSell = (exampleCost * (1 + markupNum / 100)).toFixed(2);

  const markupDisabled = mode === "manual" && !enableMarkupGuidance;

  const MODES: { value: PricingMode; label: string; helper: string; badge?: string }[] = [
    { value: "manual", label: "Manual Pricing", helper: "Set proposed prices directly per medication.", badge: "Default" },
    { value: "markup", label: "Markup-Based Pricing", helper: "Automatically calculate proposed prices from pharmacy cost using a default markup percentage." },
    { value: "hybrid", label: "Hybrid Pricing", helper: "Start with markup-based suggested prices, then allow manual overrides per medication." },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 1. Pricing Model */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Pricing Model</h2>
        <p className="text-xs text-gray-500 mt-1 mb-5">Choose how Bisk generates proposed prices for medications</p>

        <div className="space-y-3">
          {MODES.map((opt) => (
            <label key={opt.value}
              className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                mode === opt.value ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 hover:border-gray-300"
              }`}>
              <input type="radio" name="pricing_mode" value={opt.value}
                checked={mode === opt.value} onChange={() => handleModeChange(opt.value)} className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  {opt.badge && (
                    <span className="text-[9px] font-medium text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">{opt.badge}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{opt.helper}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 2. Markup Guidance */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Markup Guidance</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Use markup as an optional pricing assistant to suggest starting prices</p>

        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900">Enable markup guidance</p>
              <p className="text-xs text-gray-500 mt-0.5">Use default markup to suggest initial proposed prices from pharmacy cost.</p>
            </div>
            <Toggle on={enableMarkupGuidance} onToggle={() => {
              if (mode === "markup") return; // Always on for markup mode
              setEnableMarkupGuidance(!enableMarkupGuidance);
            }} disabled={mode === "markup"} />
          </label>

          <div className={`pt-4 border-t border-gray-100 ${markupDisabled ? "opacity-40" : ""}`}>
            <label className="block text-xs font-medium text-gray-600 mb-1">Default Markup %</label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <input type="number" min="1" max="200" step="1" value={markup}
                onChange={(e) => setMarkup(e.target.value)} disabled={markupDisabled}
                className="w-20 border border-gray-300 rounded-md px-3 py-2 text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50" />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              At {markupNum}% markup, a ${exampleCost} pharmacy cost suggests a ${exampleSell} proposed price.
            </p>
          </div>

          {mode === "manual" && !enableMarkupGuidance && (
            <p className="text-[10px] text-gray-400 italic">Markup guidance is not active in Manual Pricing mode.</p>
          )}
        </div>
      </div>

      {/* 3. Pricing Guardrails */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Pricing Guardrails</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Prevent obviously bad pricing decisions</p>

        <div className="space-y-3">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900">Prevent negative margin pricing</p>
              <p className="text-xs text-gray-500 mt-0.5">Warn or block pricing below pharmacy cost.</p>
            </div>
            <Toggle on={preventNegativeMargin} onToggle={() => setPreventNegativeMargin(!preventNegativeMargin)} />
          </label>

          <label className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="text-sm text-gray-900">Highlight low-margin pricing</p>
              <p className="text-xs text-gray-500 mt-0.5">Flag medications where proposed pricing produces very low margin.</p>
            </div>
            <Toggle on={highlightLowMargin} onToggle={() => setHighlightLowMargin(!highlightLowMargin)} />
          </label>

          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Minimum target fee per script</label>
            <div className="flex items-center gap-2 max-w-[200px]">
              <span className="text-sm text-gray-400">$</span>
              <input type="number" min="0" step="0.50" value={minFee}
                onChange={(e) => setMinFee(e.target.value)}
                placeholder="5"
                className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Optional benchmark for evaluating whether a deal is worth pursuing.</p>
          </div>
        </div>
      </div>

      {/* 4. Manual Overrides */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-gray-900">Manual Overrides</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">Control whether proposed prices can be adjusted after system suggestions</p>

        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-900">Allow manual price overrides</p>
            <p className="text-xs text-gray-500 mt-0.5">Let proposed prices be adjusted per medication after system suggestions are generated.</p>
            {mode === "manual" && (
              <p className="text-[10px] text-gray-400 mt-1 italic">Always enabled in Manual Pricing mode.</p>
            )}
          </div>
          <Toggle on={allowManualOverrides} onToggle={() => {
            if (mode === "manual") return; // Always on for manual mode
            setAllowManualOverrides(!allowManualOverrides);
          }} disabled={mode === "manual"} />
        </label>
      </div>

      {/* 5. Contract Settings */}
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
