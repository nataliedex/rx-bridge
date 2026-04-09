"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateMedSpaField } from "@/lib/actions";
import { PIPELINE_LABELS, PIPELINE_COLORS, PIPELINE_STAGES, type PipelineStage } from "@/lib/types";
import { AddMedSpaDrawer } from "./add-med-spa-drawer";

interface MedSpaRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  contactName: string | null;
  pipelineStage: string;
  currentVendor: string | null;
  estMonthlyVolume: string | null;
  nextStep: string | null;
}

interface Props {
  spas: MedSpaRow[];
  autoOpen?: boolean;
}

function InlineText({ spaId, field, value, placeholder }: { spaId: string; field: string; value: string | null; placeholder: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (text.trim() === (value ?? "")) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateMedSpaField(spaId, field, text.trim() || null);
      router.refresh();
    } catch { /* ignore */ }
    finally { setSaving(false); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        disabled={saving}
        className="border border-indigo-300 rounded px-1.5 py-0.5 text-[12px] w-full focus:ring-1 focus:ring-indigo-500"
        placeholder={placeholder}
        onClick={(e) => e.preventDefault()}
      />
    );
  }

  return (
    <span
      onClick={(e) => { e.preventDefault(); setEditing(true); }}
      className="cursor-text hover:bg-indigo-50 rounded px-1 -mx-1 transition-colors"
      title="Click to edit"
    >
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </span>
  );
}

function StageDropdown({ spaId, current }: { spaId: string; current: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMedSpaField(spaId, "pipelineStage", e.target.value);
      router.refresh();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  const stage = current as PipelineStage;
  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={saving}
      onClick={(e) => e.preventDefault()}
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border-0 cursor-pointer appearance-none ${PIPELINE_COLORS[stage]} disabled:opacity-50`}
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s} value={s}>{PIPELINE_LABELS[s]}</option>
      ))}
    </select>
  );
}

export function MedSpaList({ spas, autoOpen }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(autoOpen ?? false);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Med Spas</h1>
          <p className="text-sm text-gray-500 mt-1">{spas.length} account{spas.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setDrawerOpen(true)}
          className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">
          Add Med Spa
        </button>
      </div>

      {spas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400">No med spas yet.</p>
          <button onClick={() => setDrawerOpen(true)} className="text-sm text-indigo-600 hover:underline mt-2">Add your first med spa</button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2.5 flex-[1.8]">Name</div>
            <div className="px-4 py-2.5 flex-[0.7]">Location</div>
            <div className="px-4 py-2.5 flex-[0.7] text-center">Stage</div>
            <div className="px-4 py-2.5 flex-[1]">Current Vendor</div>
            <div className="px-4 py-2.5 flex-[0.8]">Est. Monthly</div>
            <div className="px-4 py-2.5 flex-[1.2]">Next Step</div>
          </div>
          {spas.map((spa, idx) => (
            <Link key={spa.id} href={`/med-spas/${spa.id}`}
              className={`flex items-center border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
              <div className="px-4 py-3 flex-[1.8]">
                <p className="text-[13px] font-medium text-gray-900">{spa.name}</p>
                {spa.contactName && <p className="text-[11px] text-gray-400 mt-0.5">{spa.contactName}</p>}
              </div>
              <div className="px-4 py-3 flex-[0.7] text-[13px] text-gray-500">
                {[spa.city, spa.state].filter(Boolean).join(", ") || "—"}
              </div>
              <div className="px-4 py-3 flex-[0.7] text-center">
                <StageDropdown spaId={spa.id} current={spa.pipelineStage} />
              </div>
              <div className="px-4 py-3 flex-[1] text-[12px] text-gray-500">
                <InlineText spaId={spa.id} field="currentVendor" value={spa.currentVendor} placeholder="Add vendor..." />
              </div>
              <div className="px-4 py-3 flex-[0.8] text-[12px] text-gray-700">
                <InlineText spaId={spa.id} field="estMonthlyVolume" value={spa.estMonthlyVolume} placeholder="Add volume..." />
              </div>
              <div className="px-4 py-3 flex-[1.2] text-[12px] text-gray-500">
                <InlineText spaId={spa.id} field="nextStep" value={spa.nextStep} placeholder="Add next step..." />
              </div>
            </Link>
          ))}
        </div>
      )}

      <AddMedSpaDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
