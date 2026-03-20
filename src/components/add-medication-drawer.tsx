"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMedication } from "@/lib/actions";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddMedicationDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [strength, setStrength] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setForm(""); setStrength("");
      setError(""); setSuccess(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleSave() {
    if (!name.trim()) { setError("Medication name is required"); return; }
    setSaving(true); setError("");
    try {
      await createMedication({ name, form, strength });
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

  return (
    <Drawer open={open} onClose={onClose} title="Add Medication">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Medication added
        </div>
      ) : (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medication Name <span className="text-red-500">*</span></label>
            <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Testosterone Cypionate"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Form</label>
            <select value={form} onChange={(e) => setForm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Select form...</option>
              <option value="Capsule">Capsule</option>
              <option value="Injectable Solution">Injectable Solution</option>
              <option value="Topical Cream">Topical Cream</option>
              <option value="Troche">Troche</option>
              <option value="Nasal Spray">Nasal Spray</option>
              <option value="Sublingual Tablet">Sublingual Tablet</option>
              <option value="Suppository">Suppository</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Strength</label>
            <input type="text" value={strength} onChange={(e) => setStrength(e.target.value)}
              placeholder="e.g. 200mg/mL"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Medication"}
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
