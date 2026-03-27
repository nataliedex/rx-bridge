"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markPriceVerified, removeMedicationFromPharmacy } from "@/lib/actions";
import { formatCurrency, getPricingUnit, VERIFICATION_SOURCE_LABELS } from "@/lib/pricing";
import { UpdatePriceDrawer } from "./update-price-drawer";
import { ConfirmAction } from "./confirm-action";
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
  effectiveDate: string | null;
  verifiedAt: string | null;
  verificationSource: string | null;
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
}

const STATUS_STYLES: Record<AuditStatus, { label: string; bg: string; text: string }> = {
  fresh: { label: "Fresh", bg: "bg-green-100", text: "text-green-700" },
  aging: { label: "Aging", bg: "bg-amber-100", text: "text-amber-700" },
  stale: { label: "Stale", bg: "bg-red-100", text: "text-red-700" },
  missing: { label: "Missing", bg: "bg-amber-100", text: "text-amber-700" },
  missing_sell_price: { label: "No Sell Price", bg: "bg-purple-100", text: "text-purple-700" },
};

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return `/medications/audit${qs ? `?${qs}` : ""}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

function marginColor(pct: number): string {
  if (pct > 0.25) return "text-green-700";
  if (pct >= 0.10) return "text-amber-600";
  return "text-red-600";
}

export function PricingAuditTable({
  rows, currentFilter, currentSearch, currentPharmacy, currentMedication, pharmacies, medications,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ medicationId: string; medicationName: string; pharmacyId: string; pharmacyName: string } | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [editing, setEditing] = useState<{
    medicationId: string;
    medicationName: string;
    medicationForm: string;
    pharmacyId: string;
    pharmacyName: string;
    currentPrice: number;
  } | null>(null);

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

  function openDrawer(row: AuditRow) {
    setEditing({
      medicationId: row.medicationId,
      medicationName: row.medicationName,
      medicationForm: row.medicationForm,
      pharmacyId: row.pharmacyId,
      pharmacyName: row.pharmacyName,
      currentPrice: row.price ?? 0,
    });
  }

  async function handleVerify(e: React.MouseEvent | null, priceEntryId: string) {
    e?.stopPropagation();
    setVerifying(priceEntryId);
    try {
      await markPriceVerified(priceEntryId);
      setJustVerified(priceEntryId);
      setTimeout(() => { setJustVerified(null); router.refresh(); }, 1500);
    } catch { /* stay */ } finally { setVerifying(null); }
  }

  async function handleRemove() {
    if (!confirmRemove) return;
    setRemovingKey(`${confirmRemove.medicationId}:${confirmRemove.pharmacyId}`);
    try {
      await removeMedicationFromPharmacy(confirmRemove.medicationId, confirmRemove.pharmacyId);
      setConfirmRemove(null);
      router.refresh();
    } catch { /* stay */ } finally { setRemovingKey(null); }
  }

  function handleRemoveFromDrawer() {
    if (!editing) return;
    setEditing(null);
    setConfirmRemove({ medicationId: editing.medicationId, medicationName: editing.medicationName, pharmacyId: editing.pharmacyId, pharmacyName: editing.pharmacyName });
  }

  // Client-side filter for negative_margin (server doesn't handle this filter)
  const displayRows = currentFilter === "negative_margin"
    ? rows.filter((r) => r.price != null && r.sellPrice != null && r.sellPrice - r.price < 0)
    : rows;

  const staleCount = rows.filter((r) => r.status === "stale" || r.status === "aging").length;
  const missingCount = rows.filter((r) => r.status === "missing").length;
  const missingSellCount = rows.filter((r) => r.status === "missing_sell_price").length;
  const negativeMarginCount = rows.filter((r) => r.price != null && r.sellPrice != null && r.sellPrice - r.price < 0).length;
  const hasFilters = currentSearch || currentPharmacy || currentMedication;

  return (
    <>
      {/* Fixed controls */}
      <div className="shrink-0">
        {/* Summary cards — clickable filters */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {([
            { filter: "all", label: "Total", value: rows.length, color: "text-gray-900", extra: null as string | null },
            { filter: "stale", label: "Stale / Aging", value: staleCount, color: staleCount > 0 ? "text-red-600" : "text-gray-900", extra: null },
            { filter: "missing", label: "Missing", value: missingCount, color: missingCount + missingSellCount > 0 ? "text-amber-600" : "text-gray-900", extra: missingSellCount > 0 ? `+${missingSellCount} no sell` : null },
            { filter: "negative_margin", label: "Negative Margin", value: negativeMarginCount, color: negativeMarginCount > 0 ? "text-red-600" : "text-gray-900", extra: null },
          ]).map((tile) => {
            const active = currentFilter === tile.filter;
            return (
              <button key={tile.filter} onClick={() => navigate({ filter: tile.filter })}
                className={`text-left rounded-lg p-4 transition-colors cursor-pointer ${
                  active
                    ? "bg-indigo-50 border-2 border-indigo-300"
                    : "bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{tile.label}</p>
                <p className={`text-2xl font-bold mt-1 ${tile.color}`}>
                  {tile.value}
                  {tile.extra && <span className="text-sm font-normal text-purple-500 ml-1">{tile.extra}</span>}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search + Dropdowns + Filter tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <NetworkSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search medication or pharmacy..."
          />
          <select value={currentPharmacy} onChange={(e) => navigate({ pharmacy: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">All pharmacies</option>
            {pharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={currentMedication} onChange={(e) => navigate({ medication: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm max-w-[220px]">
            <option value="">All medications</option>
            {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(""); router.push(buildUrl({ filter: currentFilter })); }}
              className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
          )}
        </div>

        {confirmRemove && (
          <div className="mb-3">
            <ConfirmAction
              message={`Remove ${confirmRemove.medicationName} from ${confirmRemove.pharmacyName}?`}
              detail="Active pricing will be deactivated. Historical records are preserved."
              confirmLabel="Remove"
              onConfirm={handleRemove}
              onCancel={() => setConfirmRemove(null)}
              loading={removingKey === `${confirmRemove.medicationId}:${confirmRemove.pharmacyId}`}
            />
          </div>
        )}
      </div>

      {/* Data grid */}
      {displayRows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No entries match {hasFilters || currentFilter !== "all" ? "these filters" : "this filter"}.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Medication</div>
            <div className="px-4 py-2.5 flex-[1.5]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Cost</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Sell Price</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Margin</div>
            <div className="px-4 py-2.5 flex-[0.6] text-center">Status</div>
            <div className="px-4 py-2.5 flex-[0.5] text-right">Verify</div>
            <div className="px-4 py-2.5 flex-[0.4] text-right">Edit</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {displayRows.map((row, idx) => {
              const style = STATUS_STYLES[row.status];
              const isMissing = row.status === "missing";
              const hasPrice = row.priceEntryId !== null;
              const isJustVerified = hasPrice && justVerified === row.priceEntryId;

              // Margin computation
              const hasMargin = row.price != null && row.sellPrice != null;
              const margin = hasMargin ? row.sellPrice! - row.price! : null;
              const marginPct = hasMargin && row.sellPrice! > 0 ? margin! / row.sellPrice! : null;

              return (
                <div
                  key={`${row.medicationId}:${row.pharmacyId}`}
                  onClick={() => openDrawer(row)}
                  className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                >
                  <div className="px-4 py-2 flex-[2] text-[13px] text-gray-900 truncate">{row.medicationName}</div>
                  <div className="px-4 py-2 flex-[1.5] text-[13px] text-gray-600 truncate">{row.pharmacyName}</div>

                  {/* Cost */}
                  <div className="px-4 py-2 flex-[0.7] text-right text-[13px] font-medium text-gray-900">
                    {hasPrice ? <>{formatCurrency(row.price!)} <span className="text-[10px] font-normal text-gray-400">/ {getPricingUnit(row.medicationForm)}</span></> : <span className="text-gray-300">—</span>}
                  </div>

                  {/* Sell Price */}
                  <div className="px-4 py-2 flex-[0.7] text-right text-[13px] text-gray-700">
                    {row.sellPrice != null ? <>{formatCurrency(row.sellPrice)} <span className="text-[10px] text-gray-400">/ {getPricingUnit(row.medicationForm)}</span></> : <span className="text-gray-300">—</span>}
                  </div>

                  {/* Margin */}
                  <div className={`px-4 py-2 flex-[0.7] text-right text-[12px] font-medium ${
                    marginPct != null ? marginColor(marginPct) : ""
                  }`}>
                    {hasMargin && margin != null && marginPct != null ? (
                      <>{formatCurrency(margin)} <span className="text-[10px] font-normal opacity-70">({(marginPct * 100).toFixed(0)}%)</span></>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="px-4 py-2 flex-[0.6] text-center">
                    {isJustVerified ? (
                      <>
                        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">Fresh &#10003;</span>
                        <p className="text-[10px] text-gray-300 mt-0.5 leading-none">Just now</p>
                      </>
                    ) : (
                      <>
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${style.bg} ${style.text}`}>{style.label}</span>
                        <p className="text-[10px] text-gray-300 mt-0.5 leading-none">
                          {isMissing ? "No price set" : row.verifiedAt ? shortDate(row.verifiedAt) : "Never verified"}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Verify */}
                  <div className="px-4 py-2 flex-[0.5] text-right" onClick={(e) => e.stopPropagation()}>
                    {isMissing ? (
                      <button onClick={() => openDrawer(row)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800">Add Price</button>
                    ) : (row.status === "aging" || row.status === "stale") && !isJustVerified ? (
                      <button onClick={(e) => { e.stopPropagation(); handleVerify(e, row.priceEntryId!); }}
                        disabled={verifying === row.priceEntryId}
                        className="text-[11px] text-green-600 hover:text-green-800 disabled:opacity-50">
                        {verifying === row.priceEntryId ? "..." : "Verify"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-200">—</span>
                    )}
                  </div>
                  {/* Edit */}
                  <div className="px-4 py-2 flex-[0.4] text-right" onClick={(e) => e.stopPropagation()}>
                    {!isMissing ? (
                      <button onClick={() => openDrawer(row)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800">Update</button>
                    ) : (
                      <span className="text-[11px] text-gray-200">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <UpdatePriceDrawer
          open={true}
          onClose={() => setEditing(null)}
          medicationId={editing.medicationId}
          medicationName={editing.medicationName}
          medicationForm={editing.medicationForm}
          pharmacyId={editing.pharmacyId}
          pharmacyName={editing.pharmacyName}
          currentPrice={editing.currentPrice}
          onRemove={handleRemoveFromDrawer}
        />
      )}
    </>
  );
}
