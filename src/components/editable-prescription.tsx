"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updatePrescription, resolveIssue } from "@/lib/actions";
import { EditField, ViewRow, SectionHeader, SaveBar, SavedBanner, PostSaveIssuePrompt, sectionBorderClass, type IssueRef } from "./section-edit-primitives";

interface Props {
  orderId: string;
  data: {
    medicationName: string; strength: string | null; dosageForm: string | null;
    route: string | null; directions: string | null; quantity: number | null;
    refills: number; daysSupply: number | null; icd10: string | null; rxNotes: string | null;
  };
  issues: IssueRef[];
}

export function EditablePrescription({ orderId, data, issues }: Props) {
  const router = useRouter();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const [medicationName, setMedicationName] = useState(data.medicationName);
  const [strength, setStrength] = useState(data.strength || "");
  const [dosageForm, setDosageForm] = useState(data.dosageForm || "");
  const [route, setRoute] = useState(data.route || "");
  const [directions, setDirections] = useState(data.directions || "");
  const [quantity, setQuantity] = useState(data.quantity?.toString() || "");
  const [refills, setRefills] = useState(data.refills.toString());
  const [daysSupply, setDaysSupply] = useState(data.daysSupply?.toString() || "");
  const [icd10, setIcd10] = useState(data.icd10 || "");
  const [rxNotes, setRxNotes] = useState(data.rxNotes || "");

  const sectionIssues = issues.filter((i) => i.status === "open" && i.fieldPath?.startsWith("medication."));
  const issueCount = sectionIssues.length;

  // Listen for open-edit events from issue links
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handler = () => { setEditing(true); setSaved(false); };
    el.addEventListener("open-edit", handler);
    return () => el.removeEventListener("open-edit", handler);
  }, []);

  function handleCancel() {
    setEditing(false); setError(""); setSaved(false);
    setMedicationName(data.medicationName); setStrength(data.strength || "");
    setDosageForm(data.dosageForm || ""); setRoute(data.route || "");
    setDirections(data.directions || ""); setQuantity(data.quantity?.toString() || "");
    setRefills(data.refills.toString()); setDaysSupply(data.daysSupply?.toString() || "");
    setIcd10(data.icd10 || ""); setRxNotes(data.rxNotes || "");
  }

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      await updatePrescription(orderId, {
        medicationName, strength, dosageForm, route, directions,
        quantity: quantity ? parseInt(quantity) : null,
        refills: refills ? parseInt(refills) : 0,
        daysSupply: daysSupply ? parseInt(daysSupply) : null,
        icd10, rxNotes,
      });
      setSaved(true); setEditing(false); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleResolve(issueId: string) {
    try { await resolveIssue(issueId); setResolvedIds((p) => new Set(p).add(issueId)); router.refresh(); } catch { /* */ }
  }

  return (
    <div ref={sectionRef} id="section-prescription" className={`bg-white border rounded-lg p-6 scroll-mt-20 ${sectionBorderClass(issueCount > 0)}`}>
      <SectionHeader title="Prescription" editing={editing} issueCount={issueCount} onEdit={() => { setEditing(true); setSaved(false); }} />
      {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

      {saved && <PostSaveIssuePrompt sectionLabel="Prescription" issues={sectionIssues} resolvedIds={resolvedIds} onResolve={handleResolve} />}
      {saved && sectionIssues.filter((i) => !resolvedIds.has(i.id)).length === 0 && <SavedBanner message="Prescription saved." />}

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="Medication Name" value={medicationName} onChange={setMedicationName} fieldPath="medication.name" />
            <EditField label="Strength" value={strength} onChange={setStrength} hint="e.g. 200mg/mL" fieldPath="medication.strength" />
            <EditField label="Dosage Form" value={dosageForm} onChange={setDosageForm} hint="e.g. Capsule, Injectable" fieldPath="medication.dosageForm" />
            <EditField label="Route" value={route} onChange={setRoute} hint="e.g. Oral, IM, Topical" fieldPath="medication.route" />
          </div>
          <EditField label="Directions / Sig" value={directions} onChange={setDirections} fieldPath="medication.directions" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EditField label="Quantity" value={quantity} onChange={setQuantity} type="number" fieldPath="medication.quantity" />
            <EditField label="Refills" value={refills} onChange={setRefills} type="number" fieldPath="medication.refills" />
            <EditField label="Days Supply" value={daysSupply} onChange={setDaysSupply} type="number" fieldPath="medication.daysSupply" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="ICD-10 / Diagnosis" value={icd10} onChange={setIcd10} hint="e.g. E29.1" fieldPath="medication.icd10" />
            <div id="field-medication.rxNotes" className="scroll-mt-24">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rx Notes</label>
              <textarea value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} rows={2}
                className="w-full border border-indigo-300 rounded px-2.5 py-1.5 text-sm bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
          </div>
          <SaveBar saving={saving} onSave={handleSave} onCancel={handleCancel} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ViewRow label="Medication" value={data.medicationName} fieldPath="medication.name" />
          <ViewRow label="Strength" value={data.strength} fieldPath="medication.strength" />
          <ViewRow label="Dosage Form" value={data.dosageForm} fieldPath="medication.dosageForm" />
          <ViewRow label="Route" value={data.route} fieldPath="medication.route" />
          <ViewRow label="Directions" value={data.directions} fieldPath="medication.directions" />
          <ViewRow label="Quantity" value={data.quantity?.toString()} fieldPath="medication.quantity" />
          <ViewRow label="Refills" value={data.refills.toString()} fieldPath="medication.refills" />
          <ViewRow label="Days Supply" value={data.daysSupply?.toString()} fieldPath="medication.daysSupply" />
          <ViewRow label="ICD-10" value={data.icd10} fieldPath="medication.icd10" />
          <ViewRow label="Notes" value={data.rxNotes} fieldPath="medication.rxNotes" />
        </div>
      )}
    </div>
  );
}
