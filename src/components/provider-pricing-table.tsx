"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/pricing";
import { UpdateProviderPriceDrawer } from "./update-provider-price-drawer";
import { AddProviderDrawer } from "./add-provider-drawer";

interface PriceRow {
  id: string;
  providerId: string;
  providerName: string;
  medicationId: string;
  medicationName: string;
  form: string;
  strength: string;
  price: number;
  effectiveDate: string;
  notes: string | null;
}

interface Props {
  prices: PriceRow[];
  providers: { id: string; name: string }[];
  medications: { id: string; name: string }[];
  currentProvider: string;
}

export function ProviderPricingTable({ prices, providers, medications, currentProvider }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<{
    providerId: string;
    providerName: string;
    medicationId: string;
    medicationName: string;
    currentPrice: number;
  } | null>(null);
  const [addingProvider, setAddingProvider] = useState(false);
  const [addingPrice, setAddingPrice] = useState(false);

  function navigate(providerId: string) {
    const params = new URLSearchParams();
    if (providerId) params.set("provider", providerId);
    router.push(`/network/providers${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <>
      {/* Fixed controls */}
      <div className="shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <select
            value={currentProvider}
            onChange={(e) => navigate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setAddingProvider(true)}
              className="border border-gray-300 text-gray-700 rounded-md px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">
              + Add Provider
            </button>
            <button onClick={() => setAddingPrice(true)}
              className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
              + Add Price
            </button>
          </div>
        </div>
      </div>

      {/* Data grid */}
      {prices.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-lg">
          <div className="text-center">
            <p className="text-gray-400 text-sm">No provider pricing yet.</p>
            <button onClick={() => setAddingPrice(true)}
              className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
              Add your first provider price
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[2]">Medication</div>
            <div className="px-4 py-2.5 flex-[1]">Form</div>
            <div className="px-4 py-2.5 flex-[1]">Strength</div>
            <div className="px-4 py-2.5 flex-[1.5]">Provider</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Price</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Effective</div>
            <div className="px-4 py-2.5 flex-[0.8] text-right">Actions</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {prices.map((row, idx) => (
              <div
                key={row.id}
                onClick={() => setEditing({
                  providerId: row.providerId,
                  providerName: row.providerName,
                  medicationId: row.medicationId,
                  medicationName: row.medicationName,
                  currentPrice: row.price,
                })}
                className={`flex items-center border-b border-gray-100 cursor-pointer transition-colors duration-100 hover:bg-indigo-50/50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
              >
                <div className="px-4 py-2.5 flex-[2] text-[13px] text-gray-900 truncate">{row.medicationName}</div>
                <div className="px-4 py-2.5 flex-[1] text-[13px] text-gray-500 truncate">{row.form}</div>
                <div className="px-4 py-2.5 flex-[1] text-[13px] text-gray-500 truncate">{row.strength}</div>
                <div className="px-4 py-2.5 flex-[1.5] text-[13px] text-gray-600 truncate">{row.providerName}</div>
                <div className="px-4 py-2.5 flex-[0.8] text-right text-[13px] font-medium text-gray-900">{formatCurrency(row.price)}</div>
                <div className="px-4 py-2.5 flex-[0.8] text-right text-[11px] text-gray-400">
                  {new Date(row.effectiveDate).toLocaleDateString()}
                </div>
                <div className="px-4 py-2.5 flex-[0.8] text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setEditing({
                      providerId: row.providerId,
                      providerName: row.providerName,
                      medicationId: row.medicationId,
                      medicationName: row.medicationName,
                      currentPrice: row.price,
                    })}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Update Price
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <UpdateProviderPriceDrawer
          open={true}
          onClose={() => setEditing(null)}
          providerId={editing.providerId}
          providerName={editing.providerName}
          medicationId={editing.medicationId}
          medicationName={editing.medicationName}
          currentPrice={editing.currentPrice}
        />
      )}

      {addingPrice && (
        <UpdateProviderPriceDrawer
          open={true}
          onClose={() => setAddingPrice(false)}
          providers={providers}
          medications={medications}
        />
      )}

      <AddProviderDrawer open={addingProvider} onClose={() => setAddingProvider(false)} />
    </>
  );
}
