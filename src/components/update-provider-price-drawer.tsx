"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateProviderPrice } from "@/lib/actions";
import { formatCurrency } from "@/lib/pricing";
import { Drawer } from "./drawer";

interface EditProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  providerName: string;
  medicationId: string;
  medicationName: string;
  currentPrice: number;
  providers?: never;
  medications?: never;
}

interface AddProps {
  open: boolean;
  onClose: () => void;
  providerId?: never;
  providerName?: never;
  medicationId?: never;
  medicationName?: never;
  currentPrice?: never;
  providers: { id: string; name: string }[];
  medications: { id: string; name: string }[];
}

type Props = EditProps | AddProps;

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function UpdateProviderPriceDrawer(props: Props) {
  const { open, onClose } = props;
  const isAddMode = !!props.providers;

  const router = useRouter();
  const priceRef = useRef<HTMLInputElement>(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedMedication, setSelectedMedication] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setNewPrice("");
      setNotes("");
      setError("");
      setSuccess(false);
      if (isAddMode) {
        setSelectedProvider("");
        setSelectedMedication("");
      }
      setTimeout(() => priceRef.current?.focus(), 100);
    }
  }, [open, isAddMode]);

  const providerId = isAddMode ? selectedProvider : props.providerId;
  const medicationId = isAddMode ? selectedMedication : props.medicationId;

  async function handleSave() {
    if (!providerId) { setError("Select a provider"); return; }
    if (!medicationId) { setError("Select a medication"); return; }
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) { setError("Enter a valid price"); return; }
    setSaving(true); setError("");
    try {
      await updateProviderPrice(providerId, medicationId, price, notes);
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !saving) { e.preventDefault(); handleSave(); }
  }

  const title = isAddMode ? "Add Provider Price" : "Update Provider Price";

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Price {isAddMode ? "added" : "updated"}
        </div>
      ) : (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {error && <p className="text-red-600 text-xs">{error}</p>}

          {isAddMode ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider <span className="text-red-500">*</span></label>
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className={inputClass}>
                  <option value="">Select provider...</option>
                  {props.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Medication <span className="text-red-500">*</span></label>
                <select value={selectedMedication} onChange={(e) => setSelectedMedication(e.target.value)} className={inputClass}>
                  <option value="">Select medication...</option>
                  {props.medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-md p-3 space-y-1.5">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Provider</p>
                <p className="text-sm text-gray-700">{props.providerName}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Medication</p>
                <p className="text-sm font-medium text-gray-900">{props.medicationName}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Price</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(props.currentPrice)}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isAddMode ? "Price" : "New Price"} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                ref={priceRef}
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={!isAddMode ? props.currentPrice.toFixed(2) : "0.00"}
                className={`${inputClass} pl-7`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="e.g. contract renewal, rate negotiation..." className={inputClass} />
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : isAddMode ? "Add Price" : "Update Price"}
            </button>
            <button onClick={onClose} className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
