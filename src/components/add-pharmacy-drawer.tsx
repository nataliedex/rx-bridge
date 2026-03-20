"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createNetworkPharmacy } from "@/lib/actions";
import { Drawer } from "./drawer";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function AddPharmacyDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [serviceStates, setServiceStates] = useState<string[]>([]);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setStreet(""); setCity(""); setState(""); setZip("");
      setServiceStates([]); setEmail(""); setPhone(""); setNotes("");
      setError(""); setSuccess(false); setStatePickerOpen(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  function toggleServiceState(s: string) {
    setServiceStates((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort());
  }

  function selectAllStates() {
    setServiceStates([...US_STATES]);
  }

  function clearAllStates() {
    setServiceStates([]);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Pharmacy name is required"); return; }
    if (!street.trim()) { setError("Street address is required"); return; }
    if (!city.trim()) { setError("City is required"); return; }
    if (!state) { setError("State is required"); return; }
    if (!zip.trim()) { setError("ZIP code is required"); return; }
    if (serviceStates.length === 0) { setError("Select at least one service state"); return; }
    setSaving(true); setError("");
    try {
      await createNetworkPharmacy({ name, street, city, state, zip, serviceStates, email, phone, notes });
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
    if (e.key === "Enter" && !saving && e.target instanceof HTMLInputElement) { e.preventDefault(); handleSave(); }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Pharmacy">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Pharmacy added
        </div>
      ) : (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pharmacy Name <span className="text-red-500">*</span></label>
            <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CompoundRx Pharmacy" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Street Address <span className="text-red-500">*</span></label>
            <input type="text" value={street} onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Main St" className={inputClass} />
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">City <span className="text-red-500">*</span></label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Austin" className={inputClass} />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">State <span className="text-red-500">*</span></label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">ZIP <span className="text-red-500">*</span></label>
              <input type="text" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                maxLength={5} placeholder="78701" className={inputClass} />
            </div>
          </div>

          {/* Service states multi-select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Licensed / Service States <span className="text-red-500">*</span></label>

            {/* Selected chips */}
            {serviceStates.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {serviceStates.map((s) => (
                  <button key={s} type="button" onClick={() => toggleServiceState(s)}
                    className="inline-flex items-center gap-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded px-1.5 py-0.5 text-[11px] hover:bg-indigo-100 transition-colors">
                    {s} <span className="text-indigo-400">&times;</span>
                  </button>
                ))}
              </div>
            )}

            <button type="button" onClick={() => setStatePickerOpen(!statePickerOpen)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              {statePickerOpen ? "Hide states" : serviceStates.length > 0 ? "Edit states" : "Select states..."}
            </button>

            {statePickerOpen && (
              <div className="mt-2 border border-gray-200 rounded-md p-2 bg-gray-50">
                <div className="flex items-center gap-3 mb-2">
                  <button type="button" onClick={selectAllStates} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">Select all</button>
                  <button type="button" onClick={clearAllStates} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">Clear all</button>
                  <span className="text-[10px] text-gray-400 ml-auto">{serviceStates.length} selected</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {US_STATES.map((s) => {
                    const selected = serviceStates.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleServiceState(s)}
                        className={`text-[11px] py-1 rounded text-center transition-colors ${
                          selected ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="orders@rx.com" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input type="tel" value={formatPhone(phone)} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="(555) 123-4567" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Internal notes..." className={inputClass} />
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Pharmacy"}
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
