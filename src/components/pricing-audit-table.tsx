"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markPriceVerified, removeMedicationFromPharmacy } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { UpdatePriceDrawer } from "./update-price-drawer";
import { ConfirmAction } from "./confirm-action";

import type { AuditStatus } from "@/lib/actions";

interface AuditRow {
  medicationId: string;
  medicationName: string;
  pharmacyId: string;
  pharmacyName: string;
  priceEntryId: string | null;
  price: number | null;
  effectiveDate: string | null;
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
}

const STATUS_STYLES: Record<AuditStatus, { label: string; bg: string; text: string }> = {
  fresh: { label: "Fresh", bg: "bg-green-100", text: "text-green-700" },
  aging: { label: "Aging", bg: "bg-amber-100", text: "text-amber-700" },
  stale: { label: "Stale", bg: "bg-red-100", text: "text-red-700" },
  missing: { label: "Missing", bg: "bg-amber-100", text: "text-amber-700" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "stale", label: "Stale & Aging" },
  { value: "missing", label: "Missing" },
] as const;

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const qs = sp.toString();
  return `/network/audit${qs ? `?${qs}` : ""}`;
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
      setTimeout(() => {
        setJustVerified(null);
        router.refresh();
      }, 1500);
    } catch {
      // row stays unverified
    } finally {
      setVerifying(null);
    }
  }

  async function handleRemove() {
    if (!confirmRemove) return;
    const key = `${confirmRemove.medicationId}:${confirmRemove.pharmacyId}`;
    setRemovingKey(key);
    try {
      await removeMedicationFromPharmacy(confirmRemove.medicationId, confirmRemove.pharmacyId);
      setConfirmRemove(null);
      router.refresh();
    } catch {
      // stay
    } finally {
      setRemovingKey(null);
    }
  }

  const staleCount = rows.filter((r) => r.status === "stale" || r.status === "aging").length;
  const missingCount = rows.filter((r) => r.status === "missing").length;
  const hasFilters = currentSearch || currentPharmacy || currentMedication;

  return (
    <>
      {/* Fixed controls */}
      <div className="shrink-0">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{rows.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Stale / Aging</p>
            <p className={`text-2xl font-bold mt-1 ${staleCount > 0 ? "text-red-600" : "text-gray-900"}`}>{staleCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Missing Prices</p>
            <p className={`text-2xl font-bold mt-1 ${missingCount > 0 ? "text-amber-600" : "text-gray-900"}`}>{missingCount}</p>
          </div>
        </div>

        {/* Search + Dropdowns + Filter tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medication or pharmacy..."
              className="border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm w-72 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
                &#10005;
              </button>
            )}
          </div>
          <select
            value={currentPharmacy}
            onChange={(e) => navigate({ pharmacy: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All pharmacies</option>
            {pharmacies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={currentMedication}
            onChange={(e) => navigate({ medication: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm max-w-[220px]"
          >
            <option value="">All medications</option>
            {medications.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(""); router.push(buildUrl({ filter: currentFilter })); }}
              className="text-xs text-gray-500 hover:text-gray-700">
              Clear
            </button>
          )}

          <div className="flex gap-1 ml-auto">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => navigate({ filter: f.value })}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentFilter === f.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Confirmation panel */}
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
      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-400 text-sm">No entries match {hasFilters ? "these filters" : "this filter"}.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Medication</div>
            <div className="px-4 py-2.5 flex-[1.5]">Pharmacy</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Price</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Effective</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Last Verified</div>
            <div className="px-4 py-2.5 flex-[0.6] text-center">Status</div>
            <div className="px-4 py-2.5 flex-[0.7] text-right">Action</div>
            <div className="px-4 py-2.5 flex-[0.6] text-right">Remove</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {rows.map((row, idx) => {
              const style = STATUS_STYLES[row.status];
              const isMissing = row.status === "missing";
              const hasPrice = row.priceEntryId !== null;
              const isJustVerified = hasPrice && justVerified === row.priceEntryId;
              return (
                <div
                  key={`${row.medicationId}:${row.pharmacyId}`}
                  onClick={() => openDrawer(row)}
                  className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                >
                  <div className="px-4 py-2.5 flex-[2] text-[13px] text-gray-900 truncate">{row.medicationName}</div>
                  <div className="px-4 py-2.5 flex-[1.5] text-[13px] text-gray-600 truncate">{row.pharmacyName}</div>
                  <div className="px-4 py-2.5 flex-[0.8] text-right text-[13px] font-medium text-gray-900">
                    {hasPrice ? formatCurrency(row.price!) : <span className="text-gray-300">—</span>}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.8] text-right text-[11px] text-gray-400">
                    {row.effectiveDate ? new Date(row.effectiveDate).toLocaleDateString() : <span className="text-gray-300">—</span>}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.8] text-right text-[11px] text-gray-400">
                    {isMissing ? (
                      <span className="text-gray-300">—</span>
                    ) : isJustVerified ? (
                      <span className="text-green-600 font-medium">Verified just now</span>
                    ) : row.verifiedAt ? (
                      new Date(row.verifiedAt).toLocaleDateString()
                    ) : (
                      <span className="text-gray-300">Never</span>
                    )}
                  </div>
                  <div className="px-4 py-2.5 flex-[0.6] text-center">
                    {isJustVerified ? (
                      <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">Fresh</span>
                    ) : (
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    )}
                  </div>

                  {/* Action column — varies by status */}
                  <div className="px-4 py-2.5 flex-[0.7] text-right" onClick={(e) => e.stopPropagation()}>
                    {isMissing ? (
                      <button onClick={() => openDrawer(row)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                        Add Price
                      </button>
                    ) : isJustVerified ? (
                      <span className="text-[11px] text-green-600 font-medium">&#10003;</span>
                    ) : row.status === "fresh" ? (
                      <button onClick={(e) => handleVerify(e, row.priceEntryId!)}
                        disabled={verifying === row.priceEntryId}
                        className="text-[11px] text-gray-400 hover:text-green-600 font-medium disabled:opacity-50 whitespace-nowrap transition-colors">
                        {verifying === row.priceEntryId ? "..." : "Re-verify"}
                      </button>
                    ) : (
                      <button onClick={(e) => handleVerify(e, row.priceEntryId!)}
                        disabled={verifying === row.priceEntryId}
                        className="text-[11px] text-green-600 hover:text-green-800 font-medium disabled:opacity-50 whitespace-nowrap">
                        {verifying === row.priceEntryId ? "..." : "Verify Price"}
                      </button>
                    )}
                  </div>

                  {/* Remove column */}
                  <div className="px-4 py-2.5 flex-[0.6] text-right" onClick={(e) => e.stopPropagation()}>
                    {!isMissing && (
                      <button
                        onClick={() => setConfirmRemove({
                          medicationId: row.medicationId,
                          medicationName: row.medicationName,
                          pharmacyId: row.pharmacyId,
                          pharmacyName: row.pharmacyName,
                        })}
                        className="text-[11px] text-gray-400 hover:text-red-600 font-medium transition-colors">
                        Remove
                      </button>
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
          pharmacyId={editing.pharmacyId}
          pharmacyName={editing.pharmacyName}
          currentPrice={editing.currentPrice}
        />
      )}
    </>
  );
}
