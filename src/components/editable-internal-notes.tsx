"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateInternalNotes } from "@/lib/actions";

interface Props {
  orderId: string;
  notes: string | null;
  brand: string | null;
  source: string;
  priority: string;
}

export function EditableInternalNotes({ orderId, notes, brand, source, priority }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await updateInternalNotes(orderId, value);
      setSaved(true); setEditing(false); router.refresh();
    } finally { setSaving(false); }
  }

  function handleCancel() {
    setEditing(false); setValue(notes || ""); setSaved(false);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-900">Internal</h3>
        {!editing && (
          <button onClick={() => { setEditing(true); setSaved(false); }}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50">
            Edit notes
          </button>
        )}
      </div>

      {brand && <div className="mb-2"><p className="text-xs text-gray-500">Brand</p><p className="text-sm">{brand}</p></div>}
      <div className="mb-2"><p className="text-xs text-gray-500">Source</p><p className="text-sm">{source}</p></div>
      <div className="mb-2"><p className="text-xs text-gray-500">Priority</p><p className="text-sm">{priority}</p></div>

      {editing ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3}
            className="w-full border border-indigo-300 rounded px-2.5 py-1.5 text-sm bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-2" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded px-3 py-1 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500">Notes</p>
          <p className="text-sm">{notes || <span className="text-gray-300">—</span>}</p>
          {saved && <p className="text-xs text-green-600 mt-1">Notes saved.</p>}
        </div>
      )}
    </div>
  );
}
