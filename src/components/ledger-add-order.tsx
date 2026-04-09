"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFulfilledOrder } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface MedSpaOption {
  id: string;
  name: string;
}

interface MedInfo {
  name: string;
  unit: string;
  medSpaPrice: number;
  previousClientUnitPrice: number | null;
  pharmacies: { name: string; cost: number }[];
}

interface PricingLookup {
  [medSpaId: string]: { medications: MedInfo[] };
}

interface Props {
  medSpas: MedSpaOption[];
  lookup: PricingLookup;
  autoOpen?: boolean;
  prefillMedSpaId?: string;
  prefillMedSpaName?: string;
  buttonLabel?: string;
  buttonStyle?: string;
  pricingStrategy?: { mode: string; defaultMarkupPct: number };
}

const BISK_FEE = 5.00;
const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function LedgerAddOrder({ medSpas, lookup, autoOpen, prefillMedSpaId, prefillMedSpaName, buttonLabel, buttonStyle }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen ?? false);
  const isPrefilled = !!prefillMedSpaId;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [spaId, setSpaId] = useState(prefillMedSpaId ?? "");
  const [med, setMed] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const spaMeds = spaId ? (lookup[spaId]?.medications ?? []) : [];
  const medInfo = spaMeds.find((m) => m.name === med);
  const pharmOptions = medInfo?.pharmacies ?? [];
  const selectedPharmacy = pharmOptions.find((p) => p.name === pharmacy);

  // Contract price from selected pharmacy (per unit)
  const contractUnitPrice = selectedPharmacy?.cost ?? null;
  const q = parseInt(qty) || 0;
  const pharmacyCostTotal = contractUnitPrice != null && q > 0 ? Math.round(contractUnitPrice * q * 100) / 100 : null;
  const totalCost = pharmacyCostTotal != null ? Math.round((pharmacyCostTotal + BISK_FEE) * 100) / 100 : null;
  const noContract = med && pharmacy && contractUnitPrice == null;

  const canSubmit = spaId && med && pharmacy && q > 0;

  function handleSpaChange(id: string) {
    setSpaId(id);
    setMed(""); setPharmacy(""); setQty("");
  }

  function handleMedChange(name: string) {
    setMed(name);
    const info = (lookup[spaId]?.medications ?? []).find((m) => m.name === name);
    if (info && info.pharmacies.length > 0) {
      setPharmacy(info.pharmacies[0].name);
    } else {
      setPharmacy("");
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await createFulfilledOrder({
        medSpaId: spaId,
        orderDate: date,
        medicationName: med,
        quantity: q,
        pharmacyName: pharmacy,
        // pharmacyCost = what the pharmacy billed (contract price × qty)
        pharmacyCost: pharmacyCostTotal ?? 0,
        // medSpaPaid = pharmacy cost + Bisk fee (program price is inclusive)
        medSpaPaid: totalCost ?? 0,
        notes: notes.trim() || undefined,
      });
      handleClose();
      router.refresh();
    } catch { /* stay */ }
    finally { setSaving(false); }
  }

  function handleClose() {
    setOpen(false);
    setDate(new Date().toISOString().slice(0, 10));
    setSpaId(prefillMedSpaId ?? ""); setMed(""); setPharmacy(""); setQty(""); setNotes("");
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={buttonStyle ?? "bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"}>
        {buttonLabel ?? "+ Record Transaction"}
      </button>

      <Drawer open={open} onClose={handleClose} title="Record Transaction">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Med Spa</label>
            {isPrefilled ? (
              <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-medium text-gray-900">
                {prefillMedSpaName}
              </div>
            ) : (
              <select value={spaId} onChange={(e) => handleSpaChange(e.target.value)} className={inputClass}>
                <option value="">Select med spa...</option>
                {medSpas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medication</label>
            <select value={med} onChange={(e) => handleMedChange(e.target.value)} disabled={!spaId} className={inputClass + " disabled:bg-gray-100 disabled:text-gray-400"}>
              <option value="">{spaId ? "Select medication..." : "Select med spa first"}</option>
              {spaMeds.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pharmacy</label>
            <select value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} disabled={!med} className={inputClass + " disabled:bg-gray-100 disabled:text-gray-400"}>
              <option value="">{med ? "Select pharmacy..." : "Select medication first"}</option>
              {pharmOptions.map((p) => <option key={p.name} value={p.name}>{p.name} ({formatCurrency(p.cost)}/unit)</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
            <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" type="number" min="1" className={inputClass} />
          </div>

          {/* Cost breakdown — read-only, auto-calculated */}
          {med && pharmacy && q > 0 && (
            <div className={`rounded-md px-4 py-3 space-y-2 ${noContract ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
              {noContract ? (
                <p className="text-xs text-amber-700">No contract price found for this pharmacy + medication. This transaction will require review.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Pharmacy Cost</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">
                      {formatCurrency(pharmacyCostTotal!)}
                      <span className="text-[10px] font-normal text-gray-400 ml-1">({formatCurrency(contractUnitPrice!)} {"\u00D7"} {q})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Bisk Fee</span>
                    <span className="text-sm text-gray-400 tabular-nums">{formatCurrency(BISK_FEE)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200/60">
                    <span className="text-xs font-semibold text-gray-700">Total Cost</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(totalCost!)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" rows={2} className={inputClass} />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button onClick={handleSubmit} disabled={saving || !canSubmit}
              className="w-full bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Record Transaction"}
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
