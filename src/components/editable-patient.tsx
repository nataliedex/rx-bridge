"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updatePatient, resolveIssue } from "@/lib/actions";
import { EditField, ViewRow, SectionHeader, SaveBar, SavedBanner, PostSaveIssuePrompt, sectionBorderClass, type IssueRef } from "./section-edit-primitives";

interface Props {
  orderId: string;
  data: {
    firstName: string; lastName: string; dob: string;
    phone: string | null; email: string | null;
    address1: string | null; address2: string | null; city: string | null; state: string | null; zip: string | null;
  };
  issues: IssueRef[];
}

export function EditablePatient({ orderId, data, issues }: Props) {
  const router = useRouter();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [autoResolved, setAutoResolved] = useState<string[]>([]);
  const [remainingHumanIssues, setRemainingHumanIssues] = useState(0);

  const [firstName, setFirstName] = useState(data.firstName);
  const [lastName, setLastName] = useState(data.lastName);
  const [dob, setDob] = useState(data.dob);
  const [phone, setPhone] = useState(data.phone || "");
  const [email, setEmail] = useState(data.email || "");
  const [address1, setAddress1] = useState(data.address1 || "");
  const [address2, setAddress2] = useState(data.address2 || "");
  const [city, setCity] = useState(data.city || "");
  const [state, setState] = useState(data.state || "");
  const [zip, setZip] = useState(data.zip || "");

  const sectionIssues = issues.filter((i) => i.status === "open" && i.fieldPath?.startsWith("patient."));
  const issueCount = sectionIssues.length;
  const issueFields = new Set(sectionIssues.map((i) => i.fieldPath).filter(Boolean));

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handler = () => { setEditing(true); setSaved(false); };
    el.addEventListener("open-edit", handler);
    return () => el.removeEventListener("open-edit", handler);
  }, []);

  function handleCancel() {
    setEditing(false); setError(""); setSaved(false);
    setFirstName(data.firstName); setLastName(data.lastName); setDob(data.dob);
    setPhone(data.phone || ""); setEmail(data.email || "");
    setAddress1(data.address1 || ""); setAddress2(data.address2 || "");
    setCity(data.city || ""); setState(data.state || ""); setZip(data.zip || "");
  }

  async function handleSave() {
    setSaving(true); setError(""); setSaved(false); setAutoResolved([]);
    try {
      const result = await updatePatient(orderId, { firstName, lastName, dob, phone, email, address1, address2, city, state, zip });
      setAutoResolved(result.autoResolved);
      setRemainingHumanIssues(result.remainingHumanIssues);
      setSaved(true); setEditing(false); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleResolve(issueId: string) {
    try { await resolveIssue(issueId); setResolvedIds((p) => new Set(p).add(issueId)); router.refresh(); } catch { /* */ }
  }

  const addressDisplay = [data.address1, data.address2, data.city, data.state, data.zip].filter(Boolean).join(", ");

  return (
    <div ref={sectionRef} id="section-patient" className={`bg-white border rounded-lg p-6 scroll-mt-20 ${sectionBorderClass(issueCount > 0)}`}>
      <SectionHeader title="Patient" editing={editing} issueCount={issueCount} onEdit={() => { setEditing(true); setSaved(false); }} />
      {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

      {saved && <PostSaveIssuePrompt sectionLabel="Patient" issues={sectionIssues} resolvedIds={resolvedIds} autoResolved={autoResolved} remainingHumanIssues={remainingHumanIssues} onResolve={handleResolve} />}
      {saved && autoResolved.length === 0 && sectionIssues.filter((i) => !resolvedIds.has(i.id)).length === 0 && <SavedBanner message="Patient saved." />}

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EditField label="First Name" value={firstName} onChange={setFirstName} fieldPath="patient.firstName" hasIssue={issueFields.has("patient.firstName")} />
            <EditField label="Last Name" value={lastName} onChange={setLastName} fieldPath="patient.lastName" hasIssue={issueFields.has("patient.lastName")} />
            <EditField label="Date of Birth" value={dob} onChange={setDob} type="date" fieldPath="patient.dob" hasIssue={issueFields.has("patient.dob")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="Phone" value={phone} onChange={setPhone} type="tel" fieldPath="patient.phone" hasIssue={issueFields.has("patient.phone")} />
            <EditField label="Email" value={email} onChange={setEmail} type="email" fieldPath="patient.email" hasIssue={issueFields.has("patient.email")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditField label="Address Line 1" value={address1} onChange={setAddress1} fieldPath="patient.address1" />
            <EditField label="Address Line 2" value={address2} onChange={setAddress2} fieldPath="patient.address2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EditField label="City" value={city} onChange={setCity} fieldPath="patient.city" />
            <EditField label="State" value={state} onChange={setState} placeholder="e.g. CA" fieldPath="patient.state" />
            <EditField label="ZIP" value={zip} onChange={setZip} fieldPath="patient.zip" />
          </div>
          <SaveBar saving={saving} onSave={handleSave} onCancel={handleCancel} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ViewRow label="Name" value={`${data.firstName} ${data.lastName}`} fieldPath="patient.firstName" />
          <ViewRow label="DOB" value={data.dob} fieldPath="patient.dob" />
          <ViewRow label="Phone" value={data.phone} fieldPath="patient.phone" />
          <ViewRow label="Email" value={data.email} fieldPath="patient.email" />
          <ViewRow label="Address" value={addressDisplay} fieldPath="patient.address1" />
        </div>
      )}
    </div>
  );
}
