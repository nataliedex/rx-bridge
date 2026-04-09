"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMedSpa } from "@/lib/actions";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function AddMedSpaDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentVendor, setCurrentVendor] = useState("");
  const [estVolume, setEstVolume] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(""); setCity(""); setState(""); setContactName("");
      setEmail(""); setPhone(""); setCurrentVendor(""); setEstVolume("");
      setError("");
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      await createMedSpa({
        name: name.trim(), city: city.trim() || undefined, state: state.trim() || undefined,
        contactName: contactName.trim() || undefined, email: email.trim() || undefined,
        phone: phone.trim() || undefined, currentVendor: currentVendor.trim() || undefined,
        estMonthlyVolume: estVolume.trim() || undefined,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Med Spa">
      <div className="space-y-4">
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Glow Aesthetics" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
            <input value={state} onChange={(e) => setState(e.target.value)} className={inputClass} placeholder="TX" maxLength={2} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Current Vendor</label>
          <input value={currentVendor} onChange={(e) => setCurrentVendor(e.target.value)} className={inputClass} placeholder="Direct from pharmacy, Another GPO..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Est. Monthly Volume</label>
          <input value={estVolume} onChange={(e) => setEstVolume(e.target.value)} className={inputClass} placeholder="$5,000 - $10,000" />
        </div>
        <div className="pt-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Add Med Spa"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
