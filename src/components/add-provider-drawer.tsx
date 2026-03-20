"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProvider } from "@/lib/actions";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function AddProviderDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setNotes(""); setError(""); setSuccess(false);
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleSave() {
    if (!name.trim()) { setError("Provider name is required"); return; }
    setSaving(true); setError("");
    try {
      await createProvider({ name, notes });
      setSuccess(true);
      router.refresh();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Add Provider">
      {success ? (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <span>&#10003;</span> Provider added
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provider Name <span className="text-red-500">*</span></label>
            <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vitality Wellness Co." className={inputClass}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Internal notes..." className={inputClass} />
          </div>
          <div className="pt-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Provider"}
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
