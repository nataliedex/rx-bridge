"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBrand } from "@/lib/actions";
import { formatPhone } from "@/lib/format";

interface Props {
  brandId: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function BrandContactCard({ brandId, contactName, email, phone, website, notes }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editContact, setEditContact] = useState(contactName ?? "");
  const [editEmail, setEditEmail] = useState(email ?? "");
  const [editPhone, setEditPhone] = useState(phone ?? "");
  const [editWebsite, setEditWebsite] = useState(website ?? "");
  const [editNotes, setEditNotes] = useState(notes ?? "");

  function handleEdit() {
    setEditContact(contactName ?? "");
    setEditEmail(email ?? "");
    setEditPhone(phone ?? "");
    setEditWebsite(website ?? "");
    setEditNotes(notes ?? "");
    setError("");
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setError("");
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await updateBrand(brandId, {
        contactName: editContact,
        email: editEmail,
        phone: editPhone,
        website: editWebsite,
        notes: editNotes,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-900">Contact</h3>
        {!editing && (
          <button onClick={handleEdit}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            Edit Contact
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contact Name</label>
            <input type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)}
              placeholder="e.g. John Smith" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
              placeholder="contact@brand.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phone</label>
            <input type="tel" value={formatPhone(editPhone)} onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="(555) 123-4567" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Website</label>
            <input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)}
              placeholder="https://brand.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2}
              placeholder="Internal notes..." className={inputClass} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={handleCancel}
              className="border border-gray-300 text-gray-700 rounded-md px-3 py-1.5 text-xs hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <ViewRow label="Contact" value={contactName} />
          <ViewRow label="Email" value={email} />
          <ViewRow label="Phone" value={formatPhone(phone)} />
          {website && (
            <div>
              <p className="text-xs text-gray-500">Website</p>
              <p className="text-sm text-indigo-600 truncate">{website}</p>
            </div>
          )}
          {notes && <ViewRow label="Notes" value={notes} />}
          {!contactName && !email && !phone && !website && (
            <p className="text-xs text-gray-400">No contact information</p>
          )}
        </div>
      )}
    </div>
  );
}

function ViewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}
