"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, getPricingUnit } from "@/lib/pricing";
import { UpdateProgramPriceDrawer } from "./update-program-price-drawer";
import { NetworkSearchInput } from "./network-search-input";

import type { MedicationPricingRow, MedPricingStatus } from "@/lib/actions";

interface Guardrails {
  pricingMode: string;
  enableMarkupGuidance: boolean;
  defaultMarkupPct: number;
  preventNegativeMargin: boolean;
  highlightLowMargin: boolean;
  minimumTargetFeePerScript: number | null;
}

interface Props {
  rows: MedicationPricingRow[];
  currentSearch: string;
  currentStatus: string;
  defaultContractTermMonths: number;
  guardrails?: Guardrails;
}

const STATUS_STYLES: Record<MedPricingStatus, { label: string; bg: string; text: string }> = {
  healthy: { label: "Healthy", bg: "bg-green-100", text: "text-green-700" },
  needs_renewal: { label: "Needs Renewal", bg: "bg-amber-100", text: "text-amber-700" },
  low_margin: { label: "Low Margin", bg: "bg-red-100", text: "text-red-700" },
  missing_price: { label: "Missing Price", bg: "bg-gray-100", text: "text-gray-500" },
};

// Same market range logic as the pricing drawer
function marketRange(cost: number, form: string): { low: number; high: number } {
  const unit = getPricingUnit(form);
  const isMultiUnit = unit === "capsule" || unit === "tablet" || unit === "troche";
  if (isMultiUnit) return { low: Math.round(cost * 1.15 * 100) / 100, high: Math.round(cost * 1.60 * 100) / 100 };
  if (cost < 50) return { low: Math.round(cost * 1.20), high: Math.round(cost * 1.80) };
  if (cost < 150) return { low: Math.round(cost * 1.15), high: Math.round(cost * 1.55) };
  return { low: Math.round(cost * 1.10), high: Math.round(cost * 1.45) };
}

type MarketPosition = "strongly_competitive" | "competitive" | "fair_market" | "high_market" | "above_market" | "no_data";

function computeMarketPosition(programPrice: number | null, bestCost: number | null, form: string): MarketPosition {
  if (programPrice == null || bestCost == null) return "no_data";
  const market = marketRange(bestCost, form);
  if (programPrice < market.low) {
    const pctBelow = (market.low - programPrice) / market.low;
    return pctBelow > 0.15 ? "strongly_competitive" : "competitive";
  }
  if (programPrice > market.high) return "above_market";
  // Position within the range: 0 = at low end, 1 = at high end
  const rangeSize = market.high - market.low;
  if (rangeSize <= 0) return "fair_market";
  const position = (programPrice - market.low) / rangeSize;
  if (position <= 0.33) return "competitive";
  if (position <= 0.66) return "fair_market";
  return "high_market";
}

const MARKET_STYLES: Record<MarketPosition, { label: string; dot: string; text: string }> = {
  strongly_competitive: { label: "Strongly competitive", dot: "bg-green-500", text: "text-green-700" },
  competitive: { label: "Competitive", dot: "bg-green-500", text: "text-green-700" },
  fair_market: { label: "Fair market", dot: "bg-gray-300", text: "text-gray-500" },
  high_market: { label: "High market", dot: "bg-amber-400", text: "text-amber-600" },
  above_market: { label: "Above market", dot: "bg-amber-400", text: "text-amber-600" },
  no_data: { label: "No data", dot: "bg-gray-200", text: "text-gray-400" },
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

function marginColor(pct: number | null): string {
  if (pct == null) return "";
  if (pct >= 40) return "text-green-700";
  if (pct >= 20) return "text-amber-600";
  return "text-red-600";
}

type SortKey = "medication" | "bestCost" | "programPrice" | "margin" | "status";
type SortDir = "asc" | "desc";

export function ProgramPricingTable({ rows, currentSearch, currentStatus, defaultContractTermMonths, guardrails }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [expandedMed, setExpandedMed] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("medication");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<MedicationPricingRow | null>(null);

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl({ search, status: currentStatus, ...overrides }));
  }

  function handleSearchChange(val: string) {
    setSearch(val);
    setTimeout(() => {
      if (val !== currentSearch) router.push(buildUrl({ search: val, status: currentStatus }));
    }, 300);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return <span className="text-gray-300 ml-1 text-[9px]">{"\u2195"}</span>;
    return <span className="text-indigo-500 ml-1 text-[9px]">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  }

  // Attention counts
  const missingCount = rows.filter((r) => r.status === "missing_price").length;
  const lowMarginCount = rows.filter((r) => r.status === "low_margin").length;
  const renewalCount = rows.filter((r) => r.status === "needs_renewal").length;
  const issueCount = missingCount + lowMarginCount + renewalCount;

  // Sort
  const statusOrder: Record<MedPricingStatus, number> = { missing_price: 0, needs_renewal: 1, low_margin: 2, healthy: 3 };
  const sortedRows = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "medication": return dir * a.medicationName.localeCompare(b.medicationName);
      case "bestCost": return dir * ((a.bestCost ?? 0) - (b.bestCost ?? 0));
      case "programPrice": return dir * ((a.programPrice ?? 0) - (b.programPrice ?? 0));
      case "margin": return dir * ((a.marginPct ?? 0) - (b.marginPct ?? 0));
      case "status": return dir * (statusOrder[a.status] - statusOrder[b.status]);
      default: return 0;
    }
  });

  return (
    <>
      <div className="shrink-0">
        {/* Attention banner */}
        {issueCount > 0 && (
          <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <span className="text-sm font-medium text-amber-900">Needs attention</span>
            <div className="flex items-center gap-3 text-[12px]">
              {missingCount > 0 && (
                <button onClick={() => navigate({ status: "missing_price" })}
                  className={`font-medium underline underline-offset-2 ${currentStatus === "missing_price" ? "text-indigo-600" : "text-gray-600 hover:text-gray-900"}`}>
                  {missingCount} missing price{missingCount !== 1 ? "s" : ""}
                </button>
              )}
              {lowMarginCount > 0 && (
                <button onClick={() => navigate({ status: "low_margin" })}
                  className={`font-medium underline underline-offset-2 ${currentStatus === "low_margin" ? "text-indigo-600" : "text-red-600 hover:text-red-800"}`}>
                  {lowMarginCount} low margin
                </button>
              )}
              {renewalCount > 0 && (
                <button onClick={() => navigate({ status: "needs_renewal" })}
                  className={`font-medium underline underline-offset-2 ${currentStatus === "needs_renewal" ? "text-indigo-600" : "text-amber-700 hover:text-amber-900"}`}>
                  {renewalCount} need{renewalCount !== 1 ? "" : "s"} renewal
                </button>
              )}
            </div>
          </div>
        )}
        {currentStatus && currentStatus !== "all" && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs text-gray-500">Showing:</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 pl-2 pr-1 py-0.5 rounded">
              {STATUS_STYLES[currentStatus as MedPricingStatus]?.label ?? currentStatus}
              <button onClick={() => navigate({ status: "all" })} className="text-indigo-400 hover:text-indigo-700 ml-0.5 leading-none text-sm">&times;</button>
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <NetworkSearchInput value={search} onChange={handleSearchChange} placeholder="Search medication..." />
          <select value={currentStatus} onChange={(e) => navigate({ status: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="all">All statuses</option>
            <option value="healthy">Competitive</option>
            <option value="needs_renewal">Needs Renewal</option>
            <option value="low_margin">Above Market</option>
            <option value="missing_price">Missing Price</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {sortedRows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No medications match these filters.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <button onClick={() => handleSort("medication")} className="px-4 py-2.5 flex-[2] text-left hover:text-gray-600 flex items-center">
              Medication {sortIndicator("medication")}
            </button>
            <button onClick={() => handleSort("bestCost")} className="px-4 py-2.5 flex-[1.2] text-right hover:text-gray-600 flex items-center justify-end">
              Best Cost {sortIndicator("bestCost")}
            </button>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Cost Range</div>
            <button onClick={() => handleSort("programPrice")} className="px-4 py-2.5 flex-[0.8] text-right hover:text-gray-600 flex items-center justify-end">
              Program Price {sortIndicator("programPrice")}
            </button>
            <button onClick={() => handleSort("margin")} className="px-4 py-2.5 flex-[0.8] text-right hover:text-gray-600 flex items-center justify-end">
              Margin {sortIndicator("margin")}
            </button>
            <button onClick={() => handleSort("status")} className="px-4 py-2.5 flex-[0.7] text-center hover:text-gray-600 flex items-center justify-center">
              Status {sortIndicator("status")}
            </button>
            <div className="px-4 py-2.5 flex-[0.4] text-center">Detail</div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {sortedRows.map((row, idx) => {
              const style = STATUS_STYLES[row.status];
              const isExpanded = expandedMed === row.medicationId;
              const unit = getPricingUnit(row.medicationForm);

              return (
                <div key={row.medicationId}>
                  {/* Main row */}
                  <div className={`flex items-center border-b border-gray-100 transition-colors duration-100 ${isExpanded ? "bg-indigo-50/30" : idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                    {/* Medication */}
                    <div className="px-4 py-2.5 flex-[2] text-[13px] text-gray-900 truncate">{row.medicationName}</div>

                    {/* Best Cost */}
                    <div className="px-4 py-2.5 flex-[1.2] text-right text-[13px]">
                      {row.bestCost != null ? (
                        <>
                          <span className="font-medium text-gray-900">{formatCurrency(row.bestCost)}</span>
                          <span className="text-[10px] text-gray-400 ml-1">/ {unit}</span>
                          {row.bestCostPharmacy && <p className="text-[10px] text-gray-400 mt-0.5">{row.bestCostPharmacy}</p>}
                        </>
                      ) : <span className="text-gray-300">{"\u2014"}</span>}
                    </div>

                    {/* Cost Range */}
                    <div className="px-4 py-2.5 flex-[0.8] text-right text-[11px] text-gray-500">
                      {row.costMin != null && row.costMax != null ? (
                        row.costMin === row.costMax ? formatCurrency(row.costMin) : `${formatCurrency(row.costMin)} \u2013 ${formatCurrency(row.costMax)}`
                      ) : <span className="text-gray-300">{"\u2014"}</span>}
                    </div>

                    {/* Program Price — clickable to edit */}
                    <div className="px-4 py-2.5 flex-[0.8] text-right">
                      <button onClick={() => setEditing(row)} className="text-[13px] font-medium text-indigo-600 hover:text-indigo-800">
                        {row.programPrice != null ? formatCurrency(row.programPrice) : <span className="text-gray-400">Set price</span>}
                      </button>
                    </div>

                    {/* Margin — de-emphasized */}
                    <div className="px-4 py-2.5 flex-[0.8] text-right text-[12px] text-gray-400 tabular-nums">
                      {row.margin != null && row.marginPct != null ? (
                        <>{formatCurrency(row.margin)} <span className="text-[10px]">({row.marginPct}%)</span></>
                      ) : <span className="text-gray-300">{"\u2014"}</span>}
                    </div>

                    {/* Status — market positioning */}
                    <div className="px-4 py-2.5 flex-[0.7]">
                      {(() => {
                        const pos = computeMarketPosition(row.programPrice, row.bestCost, row.medicationForm);
                        const ms = MARKET_STYLES[pos];
                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${ms.dot}`} />
                            <span className={`text-[10px] font-medium ${ms.text}`}>{ms.label}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Expand */}
                    <div className="px-4 py-2.5 flex-[0.4] text-center">
                      {row.pharmacyCosts.length > 0 && (
                        <button onClick={() => setExpandedMed(isExpanded ? null : row.medicationId)}
                          className="text-[11px] text-gray-400 hover:text-gray-600">
                          {isExpanded ? "\u25B4" : "\u25BE"} {row.pharmacyCosts.length}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded pharmacy breakdown */}
                  {isExpanded && row.pharmacyCosts.length > 0 && (
                    <div className="bg-gray-50/80 border-b border-gray-200">
                      <div className="px-8 py-2">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-[10px] text-gray-400 uppercase tracking-wider">
                              <th className="text-left py-1.5 pr-4">Pharmacy</th>
                              <th className="text-right py-1.5 px-2">Contract Cost</th>
                              <th className="text-center py-1.5 px-2">Term</th>
                              <th className="text-center py-1.5 pl-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.pharmacyCosts.map((pc) => {
                              const isExpired = pc.effectiveThrough && new Date(pc.effectiveThrough).getTime() < Date.now();
                              return (
                                <tr key={pc.pharmacyId} className="border-t border-gray-100">
                                  <td className="py-1.5 pr-4">
                                    <a href={`/partnerships/pharmacies/${pc.pharmacyId}?highlight=${row.medicationId}`}
                                      className="text-gray-700 hover:text-indigo-600">{pc.pharmacyName}</a>
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-medium text-gray-900">
                                    {formatCurrency(pc.cost)} <span className="text-[10px] font-normal text-gray-400">/ {unit}</span>
                                  </td>
                                  <td className="py-1.5 px-2 text-center text-[11px] text-gray-500">
                                    {pc.effectiveFrom && pc.effectiveThrough
                                      ? `${shortDate(pc.effectiveFrom)} \u2013 ${shortDate(pc.effectiveThrough)}`
                                      : pc.effectiveFrom ? shortDate(pc.effectiveFrom) : "\u2014"}
                                  </td>
                                  <td className="py-1.5 pl-2 text-center">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isExpired ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                      {isExpired ? "Expired" : "Active"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editing && (
        <UpdateProgramPriceDrawer
          open={true}
          onClose={() => setEditing(null)}
          medicationId={editing.medicationId}
          medicationName={editing.medicationName}
          medicationForm={editing.medicationForm}
          currentPrice={editing.programPrice}
          bestCost={editing.bestCost}
          bestCostPharmacy={editing.bestCostPharmacy}
          defaultTermMonths={defaultContractTermMonths}
          guardrails={guardrails}
        />
      )}
    </>
  );
}
