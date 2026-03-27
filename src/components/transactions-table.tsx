"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatPercent } from "@/lib/pricing";
import type { GroupedRevenue, DataQuality, DataQualitySummary, ConfidenceLevel } from "@/lib/revenue-analytics";

interface SerializedTransaction {
  type: "order" | "refill";
  id: string;
  medicationId: string | null;
  medicationName: string;
  quantity: number;
  patientName: string;
  pharmacyId: string;
  pharmacyName: string;
  brandId: string | null;
  brandName: string | null;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
  completedAt: string;
  quality: DataQuality;
}

interface Props {
  transactions: SerializedTransaction[];
  byBrand: GroupedRevenue[];
  byPharmacy: GroupedRevenue[];
  qualitySummary: DataQualitySummary;
}

type TypeFilter = "all" | "order" | "refill";
type MarginFilter = "all" | "low" | "mid" | "high";
type DqFilter = "all" | "issues" | "missingCost" | "missingRevenue" | "estimated" | "approxDate" | "low" | "medium" | "high";
type SortKey = "date" | "type" | "patient" | "medication" | "brand" | "pharmacy" | "revenue" | "cost" | "profit" | "margin";
type SortDir = "asc" | "desc";

function centsToDisplay(cents: number): string {
  return formatCurrency(cents / 100);
}

function extractLastName(fullName: string): string {
  const comma = fullName.indexOf(",");
  return (comma > 0 ? fullName.slice(0, comma) : fullName).trim().toLowerCase();
}

function getSortValue(t: SerializedTransaction, key: SortKey): number | string {
  switch (key) {
    case "date": return new Date(t.completedAt).getTime();
    case "type": return t.type;
    case "patient": return extractLastName(t.patientName);
    case "medication": return t.medicationName.toLowerCase();
    case "brand": return (t.brandName ?? "").toLowerCase();
    case "pharmacy": return t.pharmacyName.toLowerCase();
    case "revenue": return t.revenueCents;
    case "cost": return t.costCents;
    case "profit": return t.profitCents;
    case "margin": return t.marginPct ?? -999;
  }
}

const COLUMN_HEADERS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "date", label: "Date", align: "left" },
  { key: "type", label: "Type", align: "left" },
  { key: "patient", label: "Patient", align: "left" },
  { key: "medication", label: "Medication", align: "left" },
  { key: "brand", label: "Brand", align: "left" },
  { key: "pharmacy", label: "Pharmacy", align: "left" },
  { key: "revenue", label: "Revenue", align: "right" },
  { key: "cost", label: "Cost", align: "right" },
  { key: "profit", label: "Profit", align: "right" },
  { key: "margin", label: "Margin", align: "right" },
];

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { dot: string; text: string }> = {
  high: { dot: "bg-green-500", text: "text-green-600" },
  medium: { dot: "bg-amber-500", text: "text-amber-600" },
  low: { dot: "bg-red-500", text: "text-red-600" },
};

export function TransactionsTable({ transactions, byBrand, byPharmacy, qualitySummary }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");
  const [dqFilter, setDqFilter] = useState<DqFilter>("all");
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [pharmacyFilter, setPharmacyFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [fixingTx, setFixingTx] = useState<SerializedTransaction | null>(null);
  const [fixCost, setFixCost] = useState("");
  const [fixSell, setFixSell] = useState("");
  const [fixSaving, setFixSaving] = useState(false);
  const [fixError, setFixError] = useState("");
  const [fixSuccess, setFixSuccess] = useState(false);

  const costInputRef = useRef<HTMLInputElement>(null);
  const sellInputRef = useRef<HTMLInputElement>(null);

  function openFix(t: SerializedTransaction) {
    setFixingTx(t);
    setFixCost("");
    setFixSell("");
    setFixError("");
    setFixSuccess(false);
  }

  // Autofocus first visible input when fix panel opens
  useEffect(() => {
    if (fixingTx && !fixSuccess) {
      requestAnimationFrame(() => {
        if (fixingTx.quality.missingCost && costInputRef.current) costInputRef.current.focus();
        else if (fixingTx.quality.missingRevenue && sellInputRef.current) sellInputRef.current.focus();
      });
    }
  }, [fixingTx, fixSuccess]);

  const handleFixSave = useCallback(async () => {
    if (!fixingTx?.medicationId) { setFixError("Medication not found in catalog"); return; }
    if (!fixCost && !fixSell) { setFixError("Enter at least one price"); return; }
    setFixSaving(true); setFixError("");
    try {
      const res = await fetch("/api/pricing/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: fixingTx.medicationId,
          pharmacyId: fixingTx.quality.missingCost ? fixingTx.pharmacyId : undefined,
          pharmacyCost: fixCost || undefined,
          sellPrice: fixSell || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFixError(data.message || "Failed to save"); setFixSaving(false); return; }
      setFixSuccess(true);
      setFixSaving(false);
      setTimeout(() => { setFixingTx(null); setFixSuccess(false); router.refresh(); }, 800);
    } catch { setFixError("Network error"); setFixSaving(false); }
  }, [fixingTx, fixCost, fixSell, router]);

  function handleFixKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !fixSaving && !fixSuccess) handleFixSave();
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
  }

  const filtered = useMemo(() => {
    let result = transactions;
    if (typeFilter !== "all") result = result.filter((t) => t.type === typeFilter);
    if (marginFilter === "low") result = result.filter((t) => t.marginPct != null && t.marginPct < 0.20);
    if (marginFilter === "mid") result = result.filter((t) => t.marginPct != null && t.marginPct >= 0.20 && t.marginPct <= 0.40);
    if (marginFilter === "high") result = result.filter((t) => t.marginPct != null && t.marginPct > 0.40);
    if (dqFilter === "issues") result = result.filter((t) => t.quality.flags.length > 0);
    else if (dqFilter === "missingCost") result = result.filter((t) => t.quality.missingCost);
    else if (dqFilter === "missingRevenue") result = result.filter((t) => t.quality.missingRevenue);
    else if (dqFilter === "estimated") result = result.filter((t) => t.quality.estimatedPricing);
    else if (dqFilter === "approxDate") result = result.filter((t) => t.quality.approximateDate);
    else if (dqFilter === "low") result = result.filter((t) => t.quality.confidence === "low");
    else if (dqFilter === "medium") result = result.filter((t) => t.quality.confidence === "medium");
    else if (dqFilter === "high") result = result.filter((t) => t.quality.confidence === "high");
    if (brandFilter) result = result.filter((t) => t.brandId === brandFilter || (brandFilter === "none" && !t.brandId));
    if (pharmacyFilter) result = result.filter((t) => t.pharmacyId === pharmacyFilter);
    if (search.trim()) {
      const words = search.toLowerCase().trim().split(/\s+/);
      result = result.filter((t) => {
        const haystack = `${t.patientName} ${t.medicationName} ${t.brandName ?? ""} ${t.pharmacyName}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }
    result = [...result].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [transactions, typeFilter, marginFilter, dqFilter, brandFilter, pharmacyFilter, search, sortKey, sortDir]);

  const hasActiveFilter = typeFilter !== "all" || marginFilter !== "all" || dqFilter !== "all" || brandFilter || pharmacyFilter || search.trim();

  function clearFilters() {
    setTypeFilter("all"); setMarginFilter("all"); setDqFilter("all");
    setBrandFilter(null); setPharmacyFilter(null); setSearch("");
  }

  const DQ_LABELS: Record<DqFilter, string> = {
    all: "", issues: "Any Issues", missingCost: "No pharmacy cost set", missingRevenue: "No sell price set",
    estimated: "Using fallback pricing", approxDate: "Using estimated date", low: "Low Confidence", medium: "Medium Confidence", high: "High Confidence",
  };

  function toggleDq(filter: DqFilter) {
    setDqFilter(dqFilter === filter ? "all" : filter);
  }

  return (
    <div className="space-y-6">
      {/* Data Quality — interactive */}
      {transactions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-900">Data Quality</h2>
            <div className="flex items-center gap-2">
              {(["high", "medium", "low"] as const).map((level) => {
                const count = level === "high" ? qualitySummary.highConfidenceCount : level === "medium" ? qualitySummary.mediumConfidenceCount : qualitySummary.lowConfidenceCount;
                if (count === 0 && level !== "high") return null;
                const colors = { high: "text-green-600", medium: "text-amber-600", low: "text-red-600" };
                const active = dqFilter === level;
                return (
                  <button key={level} onClick={() => toggleDq(level)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${active ? "bg-indigo-600 text-white" : `${colors[level]} hover:bg-gray-100`}`}>
                    {count} {level}
                  </button>
                );
              })}
            </div>
          </div>
          {qualitySummary.cleanTransactions === qualitySummary.totalTransactions ? (
            <p className="text-xs text-green-600">All transactions have complete, verified data.</p>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              {qualitySummary.missingCostCount > 0 && (
                <button onClick={() => toggleDq("missingCost")}
                  className={`px-2 py-1 rounded-md transition-colors ${dqFilter === "missingCost" ? "bg-red-600 text-white" : "text-red-600 bg-red-50 hover:bg-red-100"}`}>
                  {qualitySummary.missingCostCount} no pharmacy cost
                </button>
              )}
              {qualitySummary.missingRevenueCount > 0 && (
                <button onClick={() => toggleDq("missingRevenue")}
                  className={`px-2 py-1 rounded-md transition-colors ${dqFilter === "missingRevenue" ? "bg-red-600 text-white" : "text-red-600 bg-red-50 hover:bg-red-100"}`}>
                  {qualitySummary.missingRevenueCount} no sell price
                </button>
              )}
              {qualitySummary.estimatedPricingCount > 0 && (
                <button onClick={() => toggleDq("estimated")}
                  className={`px-2 py-1 rounded-md transition-colors ${dqFilter === "estimated" ? "bg-amber-600 text-white" : "text-amber-600 bg-amber-50 hover:bg-amber-100"}`}>
                  {qualitySummary.estimatedPricingCount} fallback pricing
                </button>
              )}
              {qualitySummary.approximateDateCount > 0 && (
                <button onClick={() => toggleDq("approxDate")}
                  className={`px-2 py-1 rounded-md transition-colors ${dqFilter === "approxDate" ? "bg-amber-600 text-white" : "text-amber-600 bg-amber-50 hover:bg-amber-100"}`}>
                  {qualitySummary.approximateDateCount} estimated date
                </button>
              )}
            </div>
          )}
          {qualitySummary.estimatedPricingCount > 0 && dqFilter === "all" && (
            <p className="text-[10px] text-gray-400 mt-2">Fallback pricing uses catalog rates instead of actual fill data. Click any item to filter transactions.</p>
          )}
        </div>
      )}

      {/* Revenue breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {byBrand.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-medium text-gray-900">Revenue by Brand</h2>
              <p className="text-xs text-gray-500 mt-0.5">Click to filter transactions</p>
            </div>
            <table className="min-w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Brand</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Fills</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Profit</th>
              </tr></thead>
              <tbody>
                {byBrand.map((row, idx) => (
                  <tr key={row.key} onClick={() => setBrandFilter(brandFilter === row.key ? null : row.key)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${brandFilter === row.key ? "bg-indigo-50" : idx % 2 === 1 ? "bg-gray-50/40" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-2.5 text-[13px] text-gray-900">{row.label}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-700 tabular-nums">{row.count}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900">{centsToDisplay(row.revenueCents)}</td>
                    <td className={`px-4 py-2.5 text-right text-[13px] font-medium ${row.profitCents >= 0 ? "text-green-700" : "text-red-600"}`}>{centsToDisplay(row.profitCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {byPharmacy.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-medium text-gray-900">Revenue by Pharmacy</h2>
              <p className="text-xs text-gray-500 mt-0.5">Click to filter transactions</p>
            </div>
            <table className="min-w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Fills</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Profit</th>
              </tr></thead>
              <tbody>
                {byPharmacy.map((row, idx) => (
                  <tr key={row.key} onClick={() => setPharmacyFilter(pharmacyFilter === row.key ? null : row.key)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${pharmacyFilter === row.key ? "bg-indigo-50" : idx % 2 === 1 ? "bg-gray-50/40" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-2.5 text-[13px] text-gray-900">{row.label}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-700 tabular-nums">{row.count}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900">{centsToDisplay(row.revenueCents)}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-500">{centsToDisplay(row.costCents)}</td>
                    <td className={`px-4 py-2.5 text-right text-[13px] font-medium ${row.profitCents >= 0 ? "text-green-700" : "text-red-600"}`}>{centsToDisplay(row.profitCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions table */}
      {transactions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-gray-900">Transactions</h2>
                <p className="text-xs text-gray-500 mt-0.5">{filtered.length} of {transactions.length} — completed orders and filled refills</p>
              </div>
              {hasActiveFilter && (
                <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Clear all filters</button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient, medication, brand, pharmacy..."
                  className="border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm w-72 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                {search && (
                  <button type="button" onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">&#10005;</button>
                )}
              </div>
              <div className="flex gap-1">
                {(["all", "order", "refill"] as TypeFilter[]).map((v) => (
                  <button key={v} onClick={() => setTypeFilter(v)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${typeFilter === v ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {v === "all" ? "All Types" : v === "order" ? "Orders" : "Refills"}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {([["all", "All Margins"], ["low", "<20%"], ["mid", "20–40%"], ["high", ">40%"]] as [MarginFilter, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => setMarginFilter(v)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${marginFilter === v ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {dqFilter !== "all" && (
                <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 text-[11px] text-amber-700">
                  DQ: {DQ_LABELS[dqFilter]}
                  <button onClick={() => setDqFilter("all")} className="text-amber-400 hover:text-amber-600">&#10005;</button>
                </span>
              )}
              {brandFilter && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 text-[11px] text-indigo-700">
                  Brand: {byBrand.find((b) => b.key === brandFilter)?.label ?? brandFilter}
                  <button onClick={() => setBrandFilter(null)} className="text-indigo-400 hover:text-indigo-600">&#10005;</button>
                </span>
              )}
              {pharmacyFilter && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 text-[11px] text-indigo-700">
                  Pharmacy: {byPharmacy.find((p) => p.key === pharmacyFilter)?.label ?? pharmacyFilter}
                  <button onClick={() => setPharmacyFilter(null)} className="text-indigo-400 hover:text-indigo-600">&#10005;</button>
                </span>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No transactions match these filters.</div>
          ) : (
            <div className="flex flex-col" style={{ maxHeight: "calc(100vh - 20rem)" }}>
              {/* Sticky column headers */}
              <div className="shrink-0 overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {COLUMN_HEADERS.map((col) => (
                        <th key={col.key} onClick={() => handleSort(col.key)}
                          className={`px-4 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none ${col.align === "right" ? "text-right" : "text-left"}`}>
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {sortKey === col.key && <span className="text-indigo-600">{sortDir === "asc" ? "↑" : "↓"}</span>}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider w-20" title="Data quality">DQ</th>
                    </tr>
                  </thead>
                </table>
              </div>
              {/* Scrollable rows */}
              <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
                <table className="min-w-full">
                  <tbody>
                  {filtered.map((t, idx) => {
                    const isLowMargin = t.marginPct != null && t.marginPct < 0.20;
                    const hasIssues = t.quality.flags.length > 0;
                    const conf = CONFIDENCE_STYLES[t.quality.confidence];
                    const isEditing = fixingTx?.id === t.id && fixingTx?.type === t.type;
                    const canFix = (t.quality.missingCost || t.quality.missingRevenue) && t.medicationId;
                    return (
                      <tr key={`${t.type}-${t.id}`} className={`border-b border-gray-50 transition-colors ${
                        isEditing
                          ? "bg-indigo-50/60 border-l-4 border-l-indigo-500"
                          : hasIssues ? "bg-amber-50/20" : isLowMargin ? "bg-red-50/30" : idx % 2 === 1 ? "bg-gray-50/40" : ""
                      }`}>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-[12px] text-gray-500 tabular-nums whitespace-nowrap`}>{new Date(t.completedAt).toLocaleDateString()}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"}`}>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${t.type === "refill" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                            {t.type === "refill" ? "Refill" : "Order"}
                          </span>
                        </td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-[13px] text-gray-900 truncate max-w-[120px]`}>{t.patientName}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-[13px] text-gray-600 truncate max-w-[140px]`}>{t.medicationName}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-[13px] text-gray-500 truncate max-w-[100px]`}>{t.brandName || <span className="text-gray-300">—</span>}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-[13px] text-gray-500 truncate max-w-[120px]`}>{t.pharmacyName}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-right text-[13px] font-medium text-gray-900 tabular-nums`}>{centsToDisplay(t.revenueCents)}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-right text-[13px] text-gray-500 tabular-nums`}>{centsToDisplay(t.costCents)}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-right text-[13px] font-medium tabular-nums ${t.profitCents >= 0 ? "text-green-700" : "text-red-600"}`}>{centsToDisplay(t.profitCents)}</td>
                        <td className={`px-4 ${isEditing ? "py-2.5" : "py-2"} text-right text-[12px] font-medium ${isLowMargin ? "text-red-600" : t.marginPct != null && t.marginPct > 0.25 ? "text-green-700" : t.marginPct != null ? "text-amber-600" : ""}`}>
                          {t.marginPct != null ? formatPercent(t.marginPct) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`px-3 ${isEditing ? "py-2.5" : "py-2"} text-right`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {hasIssues ? (
                              <span title={t.quality.flags.join(" · ")}
                                className={`inline-block w-2 h-2 rounded-full shrink-0 ${conf.dot}`} />
                            ) : (
                              <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-green-500 opacity-40" />
                            )}
                            {canFix && (
                              <button onClick={() => isEditing ? setFixingTx(null) : openFix(t)}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline whitespace-nowrap">
                                {isEditing ? "Close" : "Fix Pricing"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fix Pricing inline panel */}
          {fixingTx && (
            <div className="border-t border-indigo-200 bg-indigo-50/40 px-4 py-3">
              {/* Context line */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2">
                <span><span className="text-gray-400">Medication:</span> <span className="font-medium text-gray-900">{fixingTx.medicationName}</span></span>
                <span className="text-gray-300">|</span>
                <span><span className="text-gray-400">Pharmacy:</span> <span className="text-gray-900">{fixingTx.pharmacyName}</span></span>
                {fixingTx.brandName && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span><span className="text-gray-400">Brand:</span> <span className="text-gray-900">{fixingTx.brandName}</span></span>
                  </>
                )}
                <span className="text-gray-300">|</span>
                <span className="text-red-500 font-medium">{fixingTx.quality.flags.join(" · ")}</span>
              </div>

              {/* Input row */}
              <div className="flex flex-wrap items-center gap-2" onKeyDown={handleFixKeyDown}>
                {fixingTx.quality.missingCost && (
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input ref={costInputRef} type="number" step="0.01" value={fixCost} onChange={(e) => setFixCost(e.target.value)}
                      placeholder="0.00"
                      className="w-[120px] border border-gray-300 rounded-md pl-6 pr-2 py-1.5 text-sm text-right tabular-nums focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <span className="text-[10px] text-gray-400 ml-1">pharmacy cost</span>
                  </div>
                )}
                {fixingTx.quality.missingRevenue && (
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input ref={sellInputRef} type="number" step="0.01" value={fixSell} onChange={(e) => setFixSell(e.target.value)}
                      placeholder="0.00"
                      className="w-[120px] border border-gray-300 rounded-md pl-6 pr-2 py-1.5 text-sm text-right tabular-nums focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <span className="text-[10px] text-gray-400 ml-1">sell price</span>
                  </div>
                )}
                <button onClick={handleFixSave} disabled={fixSaving || fixSuccess}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                    fixSuccess
                      ? "bg-green-600 text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  }`}>
                  {fixSaving && (
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {fixSuccess ? "Saved \u2713" : fixSaving ? "Saving..." : "Update Pricing"}
                </button>
                <button onClick={() => setFixingTx(null)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Cancel</button>
              </div>

              {fixError && <p className="text-red-600 text-xs mt-1.5">{fixError}</p>}
              <p className="text-[10px] text-gray-400 mt-1.5">Updates the medication catalog — all future transactions will use the new pricing.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
