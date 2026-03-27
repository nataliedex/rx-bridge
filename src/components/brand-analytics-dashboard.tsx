"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatPercent } from "@/lib/pricing";
import type { BrandAnalytics, MedicationSummary, OpportunityPoint, Quadrant } from "@/lib/brand-analytics";

interface RecentActivity {
  type: "order" | "refill";
  id: string;
  medication: string;
  patient: string;
  pharmacy: string;
  status: string;
  date: string;
}

interface Props {
  analytics: BrandAnalytics;
  totalOrders: number;
  recentActivity: RecentActivity[];
}

function centsToDisplay(cents: number): string {
  return formatCurrency(cents / 100);
}

const QUADRANT_CONFIG: Record<Quadrant, { label: string; description: string; color: string; bg: string; border: string }> = {
  scale: { label: "Scale", description: "High volume, high margin — maximize", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  optimize: { label: "Optimize", description: "High volume, low margin — renegotiate costs", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  promote: { label: "Promote", description: "Low volume, high margin — grow volume", color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  deprioritize: { label: "Review", description: "Low volume, low margin — evaluate ROI", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
};

export function BrandAnalyticsDashboard({ analytics, totalOrders, recentActivity }: Props) {
  const [selectedMedication, setSelectedMedication] = useState<string | null>(null);
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | null>(null);

  const totalRevenueCents = analytics.medicationSummary.reduce((s, r) => s + r.revenueCents, 0);
  const totalCostCents = analytics.medicationSummary.reduce((s, r) => s + r.costCents, 0);
  const totalProfitCents = totalRevenueCents - totalCostCents;
  const validRows = analytics.medicationSummary.filter((r) => r.marginPct != null);
  const avgMarginPct = validRows.length > 0
    ? validRows.reduce((s, r) => s + r.marginPct!, 0) / validRows.length
    : null;

  // Filter medications by quadrant if selected
  const displayedMeds = quadrantFilter
    ? analytics.medicationSummary.filter((m) => {
        const opp = analytics.opportunityMatrix.find((o) => o.medication === m.medication);
        return opp?.quadrant === quadrantFilter;
      })
    : analytics.medicationSummary;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Revenue</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalRevenueCents > 0 ? centsToDisplay(totalRevenueCents) : <span className="text-gray-300">—</span>}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{totalOrders} order{totalOrders !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Cost</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalCostCents > 0 ? centsToDisplay(totalCostCents) : <span className="text-gray-300">—</span>}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Profit</p>
          <p className={`text-xl font-bold mt-1 ${totalProfitCents >= 0 ? "text-green-700" : "text-red-600"}`}>{centsToDisplay(totalProfitCents)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Avg Margin</p>
          <p className={`text-xl font-bold mt-1 ${avgMarginPct != null && avgMarginPct > 0 ? "text-green-700" : avgMarginPct != null ? "text-red-600" : "text-gray-300"}`}>
            {avgMarginPct != null ? formatPercent(avgMarginPct) : "—"}
          </p>
        </div>
      </div>

      {/* Actionable insights with recommendations */}
      {analytics.insights.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">Actionable Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analytics.insights.map((insight) => (
              <div key={insight.type} className={`border rounded-lg p-4 ${
                insight.type === "warning" ? "bg-red-50 border-red-200"
                  : insight.type === "optimization" ? "bg-amber-50 border-amber-200"
                  : "bg-indigo-50 border-indigo-200"
              }`}>
                <p className={`text-xs font-semibold ${
                  insight.type === "warning" ? "text-red-700" : insight.type === "optimization" ? "text-amber-700" : "text-indigo-700"
                }`}>{insight.title}</p>
                <p className={`text-[11px] mt-1 ${
                  insight.type === "warning" ? "text-red-600" : insight.type === "optimization" ? "text-amber-600" : "text-indigo-600"
                }`}>{insight.detail}</p>
                <p className="text-[11px] text-gray-600 mt-2 italic">{insight.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top medications table — interactive */}
      {displayedMeds.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900">Medications</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {quadrantFilter ? `Filtered: ${QUADRANT_CONFIG[quadrantFilter].label}` : "By profit"} — click a row to see pharmacy breakdown
              </p>
            </div>
            {quadrantFilter && (
              <button onClick={() => setQuadrantFilter(null)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Clear filter
              </button>
            )}
          </div>
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Profit</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Margin</th>
              </tr>
            </thead>
            <tbody>
              {displayedMeds.map((m, idx) => {
                const isSelected = selectedMedication === m.medication;
                return (
                  <tr key={m.medication}
                    onClick={() => setSelectedMedication(isSelected ? null : m.medication)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? "bg-indigo-50" : idx % 2 === 1 ? "bg-gray-50/40" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-2.5 text-[13px] text-gray-900 font-medium">{m.medication}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-700 tabular-nums">{m.orders}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-700">{centsToDisplay(m.revenueCents)}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-700">{m.costCents > 0 ? centsToDisplay(m.costCents) : <span className="text-gray-300">—</span>}</td>
                    <td className={`px-4 py-2.5 text-right text-[13px] font-medium ${m.profitCents >= 0 ? "text-green-700" : "text-red-600"}`}>{centsToDisplay(m.profitCents)}</td>
                    <td className={`px-4 py-2.5 text-right text-[12px] font-medium ${
                      m.marginPct != null && m.marginPct > 0.25 ? "text-green-700" : m.marginPct != null && m.marginPct >= 0.10 ? "text-amber-600" : m.marginPct != null ? "text-red-600" : ""
                    }`}>{m.marginPct != null ? formatPercent(m.marginPct) : <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pharmacy breakdown for selected medication */}
          {selectedMedication && (() => {
            const pharmData = analytics.pharmacyMedicationSummary.filter((p) => p.medication === selectedMedication);
            if (pharmData.length === 0) return null;
            return (
              <div className="border-t border-indigo-200 bg-indigo-50/30 px-4 py-3">
                <p className="text-xs font-medium text-indigo-700 mb-2">Pharmacy breakdown for {selectedMedication}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pharmData.sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0)).map((p) => (
                    <div key={p.pharmacyId} className="bg-white rounded-md px-3 py-2 border border-indigo-100 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{p.pharmacy}</span>
                        <span className={`font-medium ${p.marginPct != null && p.marginPct > 0.25 ? "text-green-600" : p.marginPct != null && p.marginPct >= 0.10 ? "text-amber-600" : "text-red-500"}`}>
                          {p.marginPct != null ? formatPercent(p.marginPct) : "—"}
                        </span>
                      </div>
                      <p className="text-gray-500 mt-0.5">{p.orders} orders · Cost {centsToDisplay(p.costCents)} · Profit {centsToDisplay(p.profitCents)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Pharmacy cost comparison */}
      {analytics.pharmacyCostComparisons.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-900">Routing Optimization</h2>
            <p className="text-xs text-gray-500 mt-0.5">Medications where a lower-cost pharmacy is available</p>
          </div>
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Medication</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Current</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Best Available</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Savings/Unit</th>
              </tr>
            </thead>
            <tbody>
              {analytics.pharmacyCostComparisons.map((c, idx) => (
                <tr key={c.medication} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <p className="text-[13px] text-gray-900">{c.medication}</p>
                    <p className="text-[10px] text-gray-400">{c.orders} orders at {c.currentPharmacy}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] text-gray-700">{centsToDisplay(c.currentCostCents)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <p className="text-[13px] text-green-700 font-medium">{centsToDisplay(c.bestCostCents)}</p>
                    <p className="text-[10px] text-gray-400">{c.bestPharmacy}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-medium text-green-700">{centsToDisplay(c.savingsCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Opportunity matrix — interactive quadrants */}
      {analytics.opportunityMatrix.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-900">Opportunity Matrix</h2>
            <p className="text-xs text-gray-500 mt-0.5">Click a quadrant to filter the medications table</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            {(["scale", "promote", "optimize", "deprioritize"] as const).map((q) => {
              const config = QUADRANT_CONFIG[q];
              const items = analytics.opportunityMatrix.filter((r) => r.quadrant === q);
              const isActive = quadrantFilter === q;
              return (
                <div key={q}
                  onClick={() => setQuadrantFilter(isActive ? null : q)}
                  className={`p-4 cursor-pointer transition-colors ${isActive ? `${config.bg} ring-2 ring-inset ring-indigo-300` : `${config.bg} hover:brightness-95`} ${q === "optimize" || q === "deprioritize" ? "border-t border-gray-200" : ""}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${config.color}`}>{config.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 mb-2">{config.description}</p>
                  {items.length === 0 ? (
                    <p className="text-[11px] text-gray-400">—</p>
                  ) : (
                    <div className="space-y-1">
                      {items.map((r) => (
                        <div key={r.medication} className="flex justify-between text-[11px]">
                          <span className="text-gray-700 truncate">{r.medication}</span>
                          <span className="text-gray-500 shrink-0 ml-2">{formatPercent(r.marginPct)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((a) => (
              <div key={`${a.type}-${a.id}`} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    a.type === "refill" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                  }`}>{a.type === "refill" ? "Refill" : "Order"}</span>
                  <div>
                    <p className="text-[13px] text-gray-900">{a.medication}</p>
                    <p className="text-[10px] text-gray-400">{a.patient} · {a.pharmacy}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-gray-500">{a.status}</p>
                  <p className="text-[10px] text-gray-400">{new Date(a.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
