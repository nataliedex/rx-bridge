"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMedSpa } from "@/lib/actions";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/types";
import { Drawer } from "./drawer";

interface Props {
  open: boolean;
  onClose: () => void;
  spa: {
    id: string; pipelineStage: string; currentVendor: string | null;
    contactName: string | null; email: string | null; phone: string | null;
    lastContactedAt: Date | null; estMonthlyVolume: string | null; nextStep: string | null;
  };
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function MedSpaDealDrawer({ open, onClose, spa }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState(spa.pipelineStage);
  const [vendor, setVendor] = useState(spa.currentVendor ?? "");
  const [contact, setContact] = useState(spa.contactName ?? "");
  const [email, setEmail] = useState(spa.email ?? "");
  const [phone, setPhone] = useState(spa.phone ?? "");
  const [lastContact, setLastContact] = useState(spa.lastContactedAt ? new Date(spa.lastContactedAt).toISOString().slice(0, 10) : "");
  const [volume, setVolume] = useState(spa.estMonthlyVolume ?? "");
  const [nextStep, setNextStep] = useState(spa.nextStep ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStage(spa.pipelineStage);
      setVendor(spa.currentVendor ?? "");
      setContact(spa.contactName ?? "");
      setEmail(spa.email ?? "");
      setPhone(spa.phone ? formatPhone(spa.phone) : "");
      setLastContact(spa.lastContactedAt ? new Date(spa.lastContactedAt).toISOString().slice(0, 10) : "");
      setVolume(spa.estMonthlyVolume ?? "");
      setNextStep(spa.nextStep ?? "");
    }
  }, [open, spa]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateMedSpa(spa.id, {
        pipelineStage: stage,
        currentVendor: vendor.trim() || null,
        contactName: contact.trim() || null,
        email: email.trim() || null,
        phone: phone.replace(/\D/g, "").trim() || null,
        lastContactedAt: lastContact ? new Date(lastContact) : null,
        estMonthlyVolume: volume.trim() || null,
        nextStep: nextStep.trim() || null,
      });
      router.refresh();
      onClose();
    } catch { /* stay */ }
    finally { setSaving(false); }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Edit Deal Details">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pipeline Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputClass}>
            {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{PIPELINE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
          <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input value={phone} onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              if (digits.length <= 3) setPhone(digits);
              else if (digits.length <= 6) setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
              else setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
            }} className={inputClass} placeholder="(512) 555-1234" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Current Vendor</label>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Est. Monthly Volume</label>
          <input value={volume} onChange={(e) => setVolume(e.target.value)} className={inputClass} placeholder="$5,000 - $10,000" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Last Contacted</label>
          <input type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Next Step</label>
          <textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} rows={2} className={inputClass} placeholder="Schedule pricing call..." />
        </div>
        <div className="pt-4 border-t border-gray-100">
          <button onClick={handleSave} disabled={saving}
            className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}
