"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/pricing";
import { removeMedicationFromPharmacy } from "@/lib/actions";
import { UpdatePriceDrawer } from "./update-price-drawer";
import { ConfirmAction } from "./confirm-action";

interface PriceEntry {
  id: string;
  price: number;
  effectiveDate: string;
  notes: string | null;
  pharmacy: { id: string; name: string };
}

interface HistoryEntry {
  id: string;
  price: number;
  effectiveDate: string;
  endDate: string | null;
  notes: string | null;
}

interface Props {
  medicationId: string;
  medicationName: string;
  activePrices: PriceEntry[];
  historyByPharmacy: Record<string, HistoryEntry[]>;
  providerPrice?: number | null;
}

export function MedicationPricingTable({ medicationId, medicationName, activePrices, historyByPharmacy, providerPrice }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ pharmacyId: string; pharmacyName: string; currentPrice: number } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ pharmacyId: string; pharmacyName: string } | null>(null);
  const lowestPrice = activePrices.length > 0 ? activePrices[0].price : null;

  async function handleRemove() {
    if (!confirmRemove) return;
    setRemoving(confirmRemove.pharmacyId);
    try {
      await removeMedicationFromPharmacy(medicationId, confirmRemove.pharmacyId);
      setConfirmRemove(null);
      router.refresh();
    } catch {
      // stay on page
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-900">Current Pricing</h2>
          <p className="text-xs text-gray-500 mt-0.5">{activePrices.length} pharmac{activePrices.length !== 1 ? "ies" : "y"} with active pricing</p>
        </div>

        {confirmRemove && (
          <div className="px-4 py-3 border-b border-red-200">
            <ConfirmAction
              message={`Remove ${medicationName} from ${confirmRemove.pharmacyName}?`}
              detail="Active pricing will be deactivated. Historical records are preserved."
              confirmLabel="Remove"
              onConfirm={handleRemove}
              onCancel={() => setConfirmRemove(null)}
              loading={removing === confirmRemove.pharmacyId}
            />
          </div>
        )}

        {activePrices.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No active pricing.</div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pharmacy</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                {providerPrice != null && (
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Margin</th>
                )}
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">vs Lowest</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Effective</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Update</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider">Remove</th>
              </tr>
            </thead>
            <tbody>
              {activePrices.map((p, idx) => {
                const isLowest = idx === 0;
                const diff = lowestPrice !== null ? p.price - lowestPrice : 0;
                const pharmacyHistory = historyByPharmacy[p.pharmacy.id] || [];
                return (
                  <tr key={p.id} className={`border-b border-gray-50 ${isLowest ? "bg-green-50/50" : ""}`}>
                    <td className="px-4 py-2.5">
                      <span className="text-[13px] text-gray-900">{p.pharmacy.name}</span>
                      {isLowest && <span className="ml-2 text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-medium">Lowest</span>}
                      {p.notes && <p className="text-[10px] text-gray-400 mt-0.5">{p.notes}</p>}
                      {pharmacyHistory.length > 0 && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-700">
                            {pharmacyHistory.length} previous price{pharmacyHistory.length !== 1 ? "s" : ""}
                          </summary>
                          <div className="mt-1 space-y-0.5">
                            {pharmacyHistory.map((h) => (
                              <div key={h.id} className="text-[10px] text-gray-400 flex items-center gap-2">
                                <span className="line-through">{formatCurrency(h.price)}</span>
                                <span>{new Date(h.effectiveDate).toLocaleDateString()} — {h.endDate ? new Date(h.endDate).toLocaleDateString() : "now"}</span>
                                {h.notes && <span className="text-gray-300">({h.notes})</span>}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold text-gray-900 align-top">
                      {formatCurrency(p.price)}
                    </td>
                    {providerPrice != null && (() => {
                      const margin = providerPrice - p.price;
                      const marginPct = providerPrice > 0 ? margin / providerPrice : 0;
                      return (
                        <td className={`px-4 py-2.5 text-right text-[13px] align-top font-medium ${margin >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {formatCurrency(margin)} <span className="text-[10px] font-normal text-gray-400">({(marginPct * 100).toFixed(0)}%)</span>
                        </td>
                      );
                    })()}
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-400 align-top">
                      {isLowest ? "—" : `+${formatCurrency(diff)}`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-gray-400 align-top">
                      {new Date(p.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right align-top">
                      <button
                        onClick={() => setEditing({ pharmacyId: p.pharmacy.id, pharmacyName: p.pharmacy.name, currentPrice: p.price })}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Update Price
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right align-top">
                      <button
                        onClick={() => setConfirmRemove({ pharmacyId: p.pharmacy.id, pharmacyName: p.pharmacy.name })}
                        className="text-[11px] text-gray-400 hover:text-red-600 font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <UpdatePriceDrawer
          open={true}
          onClose={() => setEditing(null)}
          medicationId={medicationId}
          medicationName={medicationName}
          pharmacyId={editing.pharmacyId}
          pharmacyName={editing.pharmacyName}
          currentPrice={editing.currentPrice}
        />
      )}
    </>
  );
}
