"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { NetworkSearchInput } from "./network-search-input";

import type { AuditStatus } from "@/lib/actions";

interface AuditRow {
  medicationId: string;
  medicationName: string;
  medicationForm: string;
  pharmacyId: string;
  pharmacyName: string;
  priceEntryId: string | null;
  price: number | null;
  sellPrice: number | null;
  effectiveFrom: string | null;
  effectiveThrough: string | null;
  verifiedAt: string | null;
  status: AuditStatus;
}

interface Props {
  rows: AuditRow[];
  currentFilter: string;
  currentSearch: string;
  currentPharmacy: string;
  currentMedication: string;
  pharmacies: { id: string; name: string }[];
  medications: { id: string; name: string }[];
  pricingStrategy: { mode: string; defaultMarkupPct: number };
}

const STATUS_STYLES: Record<AuditStatus, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "bg-green-100", text: "text-green-700" },
  expiring_soon: { label: "Expiring Soon", bg: "bg-amber-100", text: "text-amber-700" },
  expired: { label: "Expired", bg: "bg-red-100", text: "text-red-700" },
  unverified: { label: "Unverified", bg: "bg-purple-100", text: "text-purple-700" },
  missing: { label: "Missing", bg: "bg-gray-100", text: "text-gray-500" },
};

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return `/treatments${qs ? `?${qs}` : ""}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

type SortKey = "treatment" | "pharmacy" | "cost" | "term" | "status" | "clientPrice" | "profit";
type SortDir = "asc" | "desc";

export function PricingAuditTable({
  rows, currentFilter, currentSearch, currentPharmacy, currentMedication, pharmacies, medications,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>("treatment");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== currentSearch) {
        router.push(buildUrl({ filter: currentFilter, search, pharmacy: currentPharmacy, medication: currentMedication }));
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl({ filter: currentFilter, search, pharmacy: currentPharmacy, medication: currentMedication, ...overrides }));
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="text-gray-300 ml-1 text-[9px]">{"\u2195"}</span>;
    return <span className="text-indigo-500 ml-1 text-[9px]">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  }

  // Counts for attention banner
  const missingCount = rows.filter((r) => r.status === "missing").length;
  const issueCount = rows.filter((r) => r.status !== "active").length;
  const expiredCount = rows.filter((r) => r.status === "expired").length;
  const expiringCount = rows.filter((r) => r.status === "expiring_soon").length;
  const unverifiedCount = rows.filter((r) => r.status === "unverified").length;
  const hasFilters = currentSearch || currentPharmacy || currentMedication;

  const statusOrder: Record<AuditStatus, number> = { missing: 0, expired: 1, expiring_soon: 2, unverified: 3, active: 4 };
  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "treatment": return dir * a.medicationName.localeCompare(b.medicationName);
      case "pharmacy": return dir * a.pharmacyName.localeCompare(b.pharmacyName);
      case "cost": return dir * ((a.price ?? 0) - (b.price ?? 0));
      case "term": return dir * ((a.effectiveThrough ?? "").localeCompare(b.effectiveThrough ?? ""));
      case "clientPrice": return dir * ((a.sellPrice ?? 0) - (b.sellPrice ?? 0));
      case "profit": return dir * (((a.sellPrice ?? 0) - (a.price ?? 0)) - ((b.sellPrice ?? 0) - (b.price ?? 0)));
      case "status": return dir * (statusOrder[a.status] - statusOrder[b.status]);
      default: return 0;
    }
  });

  function handleRowClick(row: AuditRow) {
    router.push(`/partnerships/pharmacies/${row.pharmacyId}?highlight=${row.medicationId}`);
  }

  return (
    <>
      <div className="shrink-0">
        {/* Attention banner */}
        {issueCount > 0 && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <span className="text-sm font-medium text-amber-900">Needs attention</span>
            <div className="flex items-center gap-3 text-[12px]">
              {expiredCount > 0 && (
                <button onClick={() => navigate({ filter: currentFilter === "stale" ? "all" : "stale" })}
                  className={`font-medium underline underline-offset-2 ${currentFilter === "stale" ? "text-indigo-600" : "text-red-600 hover:text-red-800"}`}>
                  {expiredCount} expired
                </button>
              )}
              {expiringCount > 0 && (
                <span className="text-amber-700 font-medium">{expiringCount} expiring soon</span>
              )}
              {unverifiedCount > 0 && (
                <span className="text-purple-600 font-medium">{unverifiedCount} unverified</span>
              )}
              {missingCount > 0 && (
                <button onClick={() => navigate({ filter: currentFilter === "missing" ? "all" : "missing" })}
                  className={`font-medium underline underline-offset-2 ${currentFilter === "missing" ? "text-indigo-600" : "text-amber-700 hover:text-amber-900"}`}>
                  {missingCount} missing
                </button>
              )}
            </div>
          </div>
        )}
        {currentFilter !== "all" && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs text-gray-500">Showing:</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 pl-2 pr-1 py-0.5 rounded">
              {currentFilter === "missing" ? "Missing" : "Needs Attention"}
              <button onClick={() => navigate({ filter: "all" })} className="text-indigo-400 hover:text-indigo-700 ml-0.5 leading-none text-sm">&times;</button>
            </span>
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <NetworkSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search treatment or pharmacy..."
          />
          <select value={currentPharmacy} onChange={(e) => navigate({ pharmacy: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">All pharmacies</option>
            {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={currentMedication} onChange={(e) => navigate({ medication: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm max-w-[220px]">
            <option value="">All treatments</option>
            {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(""); router.push(buildUrl({ filter: currentFilter })); }}
              className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
          )}
        </div>
      </div>

      {/* Data grid */}
      {sortedRows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No pricing entries match {hasFilters || currentFilter !== "all" ? "these filters" : "this filter"}.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <button onClick={() => handleSort("treatment")} className="px-4 py-2.5 flex-[2] text-left hover:text-gray-600 flex items-center">
              Treatment {sortIndicator("treatment")}
            </button>
            <button onClick={() => handleSort("pharmacy")} className="px-4 py-2.5 flex-[1.3] text-left hover:text-gray-600 flex items-center">
              Pharmacy {sortIndicator("pharmacy")}
            </button>
            <button onClick={() => handleSort("cost")} className="px-4 py-2.5 flex-[0.8] text-right hover:text-gray-600 flex items-center justify-end">
              Your Cost {sortIndicator("cost")}
            </button>
            <button onClick={() => handleSort("term")} className="px-4 py-2.5 flex-[1] text-center hover:text-gray-600 flex items-center justify-center">
              Term {sortIndicator("term")}
            </button>
            <button onClick={() => handleSort("status")} className="px-4 py-2.5 flex-[0.7] text-center hover:text-gray-600 flex items-center justify-center">
              Status {sortIndicator("status")}
            </button>
            <button onClick={() => handleSort("clientPrice")} className="px-4 py-2.5 flex-[0.8] text-right hover:text-gray-600 flex items-center justify-end">
              Client Price {sortIndicator("clientPrice")}
            </button>
            <button onClick={() => handleSort("profit")} className="px-4 py-2.5 flex-[0.8] text-right hover:text-gray-600 flex items-center justify-end">
              Your Profit {sortIndicator("profit")}
            </button>
          </div>

          {/* Rows — clickable, navigate to pharmacy */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {sortedRows.map((row, idx) => {
              const style = STATUS_STYLES[row.status];
              const hasPrice = row.priceEntryId !== null;
              const clientPrice = row.sellPrice;
              const profit = (row.price != null && clientPrice != null) ? clientPrice - row.price : null;

              return (
                <div
                  key={`${row.medicationId}:${row.pharmacyId}`}
                  onClick={() => handleRowClick(row)}
                  className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                >
                  <div className="px-4 py-2.5 flex-[2] text-[13px] text-gray-900 truncate">{row.medicationName}</div>
                  <div className="px-4 py-2.5 flex-[1.3] text-[13px] text-gray-600 truncate">{row.pharmacyName}</div>

                  {/* Your Cost */}
                  <div className="px-4 py-2.5 flex-[0.8] text-right text-[13px] font-medium text-gray-900">
                    {hasPrice ? <>{formatCurrency(row.price!)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(row.medicationForm)}</span></> : <span className="text-gray-300">{"\u2014"}</span>}
                  </div>

                  {/* Term */}
                  <div className="px-4 py-2.5 flex-[1] text-center text-[11px] text-gray-500">
                    {row.effectiveFrom && row.effectiveThrough ? (
                      <>{shortDate(row.effectiveFrom)} {"\u2013"} {shortDate(row.effectiveThrough)}</>
                    ) : row.effectiveFrom ? (
                      <>{shortDate(row.effectiveFrom)} {"\u2013"} <span className="text-gray-300">open</span></>
                    ) : (
                      <span className="text-gray-300">{"\u2014"}</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="px-4 py-2.5 flex-[0.7] text-center">
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${style.bg} ${style.text}`}>{style.label}</span>
                  </div>

                  {/* Client Price */}
                  <div className="px-4 py-2.5 flex-[0.8] text-right text-[13px] text-gray-700">
                    {clientPrice != null ? formatCurrency(clientPrice) : <span className="text-gray-300">{"\u2014"}</span>}
                  </div>

                  {/* Your Profit */}
                  <div className={`px-4 py-2.5 flex-[0.8] text-right text-[13px] font-medium ${
                    profit != null && profit > 0 ? "text-green-700" : profit != null && profit < 0 ? "text-red-600" : ""
                  }`}>
                    {profit != null ? formatCurrency(profit) : <span className="text-gray-300">{"\u2014"}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
