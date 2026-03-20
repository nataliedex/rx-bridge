"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoutingPolicyAction } from "@/lib/actions";

interface RoutingPolicy {
  agingPenalty: number;
  stalePenalty: number;
  unverifiedPenalty: number;
  brandDefaultBonus: number;
  freshDays: number;
  agingDays: number;
  veryStaledays: number;
  allowUnverifiedPricing: boolean;
  maxPriceDelta: number | null;
}

interface Props {
  policy: RoutingPolicy;
  defaults: RoutingPolicy;
}

interface FieldDef {
  key: keyof RoutingPolicy;
  label: string;
  description: string;
  type: "number" | "boolean";
  unit?: string;
  nullable?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "freshDays", label: "Fresh threshold", description: "Price is considered fresh if verified within this many days", type: "number", unit: "days" },
  { key: "agingDays", label: "Aging threshold", description: "Price is aging between fresh threshold and this value", type: "number", unit: "days" },
  { key: "veryStaledays", label: "Very stale threshold", description: "Beyond this, prices are treated as low-confidence", type: "number", unit: "days" },
  { key: "agingPenalty", label: "Aging price penalty", description: "Score penalty added to pharmacies with aging prices", type: "number", unit: "$" },
  { key: "stalePenalty", label: "Stale price penalty", description: "Score penalty added to pharmacies with stale prices", type: "number", unit: "$" },
  { key: "unverifiedPenalty", label: "Unverified price penalty", description: "Score penalty for prices that have never been verified", type: "number", unit: "$" },
  { key: "brandDefaultBonus", label: "Brand default bonus", description: "Score bonus (subtracted) for brand-preferred pharmacies", type: "number", unit: "$" },
  { key: "allowUnverifiedPricing", label: "Allow unverified pricing", description: "If disabled, never-verified prices are excluded from routing entirely", type: "boolean" },
  { key: "maxPriceDelta", label: "Max price delta", description: "Maximum acceptable $ above lowest price for alternatives (blank = no cap)", type: "number", unit: "$", nullable: true },
];

export function RoutingPolicyEditor({ policy, defaults }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of FIELDS) {
      if (f.type === "boolean") {
        init[f.key] = policy[f.key] as boolean;
      } else {
        const v = policy[f.key];
        init[f.key] = v === null ? "" : String(v);
      }
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function isModified(key: string): boolean {
    const field = FIELDS.find((f) => f.key === key);
    if (!field) return false;
    const defaultVal = defaults[field.key];
    const current = values[key];
    if (field.type === "boolean") return current !== defaultVal;
    if (field.nullable && current === "") return defaultVal !== null;
    return Number(current) !== defaultVal;
  }

  function resetToDefault(key: string) {
    const field = FIELDS.find((f) => f.key === key);
    if (!field) return;
    const defaultVal = defaults[field.key];
    if (field.type === "boolean") {
      setValues((prev) => ({ ...prev, [key]: defaultVal as boolean }));
    } else {
      setValues((prev) => ({ ...prev, [key]: defaultVal === null ? "" : String(defaultVal) }));
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updates: Record<string, unknown> = {};
      for (const f of FIELDS) {
        if (f.type === "boolean") {
          updates[f.key] = values[f.key];
        } else if (f.nullable && values[f.key] === "") {
          updates[f.key] = null;
        } else {
          updates[f.key] = Number(values[f.key]);
        }
      }
      await updateRoutingPolicyAction(updates);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleResetAll() {
    for (const f of FIELDS) {
      resetToDefault(f.key);
    }
  }

  const hasChanges = FIELDS.some((f) => isModified(f.key));

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-medium text-gray-900">Pharmacy Routing Policy</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          These values control how Rx-Bridge scores and selects pharmacies for auto-routing.
          Lower scores are preferred. Changes take effect immediately.
        </p>
      </div>

      {error && <div className="px-6 py-2 bg-red-50 text-red-700 text-xs border-b border-red-200">{error}</div>}

      <div className="divide-y divide-gray-100">
        {FIELDS.map((f) => {
          const modified = isModified(f.key);
          return (
            <div key={f.key} className={`px-6 py-4 flex items-start gap-4 ${modified ? "bg-indigo-50/30" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{f.label}</p>
                  {modified && (
                    <button onClick={() => resetToDefault(f.key)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">
                      reset
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
              </div>
              <div className="shrink-0 w-32">
                {f.type === "boolean" ? (
                  <button
                    onClick={() => setValues((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      values[f.key] ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      values[f.key] ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                ) : (
                  <div className="relative">
                    {f.unit === "$" && (
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    )}
                    <input
                      type="number"
                      step={f.unit === "$" ? "0.50" : "1"}
                      value={values[f.key] as string}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.nullable ? "none" : "0"}
                      className={`w-full border border-gray-300 rounded-md py-1.5 text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        f.unit === "$" ? "pl-6 pr-3" : "px-3"
                      }`}
                    />
                    {f.unit === "days" && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">days</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : saved ? "Saved" : "Save Policy"}
        </button>
        {hasChanges && (
          <button onClick={handleResetAll}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium">
            Reset all to defaults
          </button>
        )}
        {saved && <span className="text-xs text-green-600 font-medium">Changes applied</span>}
      </div>
    </div>
  );
}
