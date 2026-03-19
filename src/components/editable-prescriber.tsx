"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updatePrescriber, resolveIssue } from "@/lib/actions";
import { EditField, ViewRow, SectionHeader, SaveBar, SavedBanner, PostSaveIssuePrompt, sectionBorderClass, type IssueRef } from "./section-edit-primitives";

interface Props {
  orderId: string;
  data: {
    name: string; npi: string; clinicName: string | null;
    phone: string | null; fax: string | null; email: string | null; address: string | null;
  };
  issues: IssueRef[];
}

export function EditablePrescriber({ orderId, data, issues }: Props) {
  const router = useRouter();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const [name, setName] = useState(data.name);
  const [npi, setNpi] = useState(data.npi);
  const [clinicName, setClinicName] = useState(data.clinicName || "");
  const [phone, setPhone] = useState(data.phone || "");
  const [fax, setFax] = useState(data.fax || "");
  const [email, setEmail] = useState(data.email || "");
  const [address, setAddress] = useState(data.address || "");

  const sectionIssues = issues.filter((i) => i.status === "open" && i.fieldPath?.startsWith("prescriber."));
  const issueCount = sectionIssues.length;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handler = () => { setEditing(true); setSaved(false); };
    el.addEventListener("open-edit", handler);
    return () => el.removeEventListener("open-edit", handler);
  }, []);

  function handleCancel() {
    setEditing(false); setError(""); setSaved(false);
    setName(data.name); setNpi(data.npi); setClinicName(data.clinicName || "");
    setPhone(data.phone || ""); setFax(data.fax || "");
    setEmail(data.email || ""); setAddress(data.address || "");
  }

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false);
    try {
      await updatePrescriber(orderId, { name, npi, clinicName, phone, fax, email, address });
      setSaved(true); setEditing(false); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleResolve(issueId: string) {
    try { await resolveIssue(issueId); setResolvedIds((p) => new Set(p).add(issueId)); router.refresh(); } catch { /* */ }
  }

  return (
    <div ref={sectionRef} id="section-prescriber" className={`bg-white border rounded-lg p-6 scroll-mt-20 ${sectionBorderClass(issueCount > 0)}`}>
      <SectionHeader title="Prescriber" editing={editing} issueCount={issueCount} onEdit={() => { setEditing(true); setSaved(false); }} />
      {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

      {saved && <PostSaveIssuePrompt sectionLabel="Prescriber" issues={sectionIssues} resolvedIds={resolvedIds} onResolve={handleResolve} />}
      {saved && sectionIssues.filter((i) => !resolvedIds.has(i.id)).length === 0 && <SavedBanner message="Prescriber saved." />}

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="Prescriber Name" value={name} onChange={setName} fieldPath="prescriber.name" />
            <EditField label="NPI" value={npi} onChange={setNpi} hint="10-digit National Provider Identifier" fieldPath="prescriber.npi" />
          </div>
          <EditField label="Clinic Name" value={clinicName} onChange={setClinicName} fieldPath="prescriber.clinicName" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EditField label="Phone" value={phone} onChange={setPhone} type="tel" fieldPath="prescriber.phone" />
            <EditField label="Fax" value={fax} onChange={setFax} type="tel" fieldPath="prescriber.fax" />
            <EditField label="Email" value={email} onChange={setEmail} type="email" fieldPath="prescriber.email" />
          </div>
          <EditField label="Address" value={address} onChange={setAddress} fieldPath="prescriber.address" />
          <SaveBar saving={saving} onSave={handleSave} onCancel={handleCancel} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ViewRow label="Name" value={data.name} fieldPath="prescriber.name" />
          <ViewRow label="NPI" value={data.npi} fieldPath="prescriber.npi" />
          <ViewRow label="Clinic" value={data.clinicName} fieldPath="prescriber.clinicName" />
          <ViewRow label="Phone" value={data.phone} fieldPath="prescriber.phone" />
          <ViewRow label="Fax" value={data.fax} fieldPath="prescriber.fax" />
          <ViewRow label="Email" value={data.email} fieldPath="prescriber.email" />
        </div>
      )}
    </div>
  );
}
