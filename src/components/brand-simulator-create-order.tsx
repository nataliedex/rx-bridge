"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  patients: { id: string; firstName: string; lastName: string }[];
  pharmacies: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  medications: { id: string; name: string; strength: string; form: string }[];
}

const inputClass = "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function BrandSimulatorCreateOrder({ patients, pharmacies, brands, medications }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [quantity, setQuantity] = useState("30");
  const [refills, setRefills] = useState("3");

  const selectedMed = medications.find((m) => m.id === medicationId);

  async function handleSubmit() {
    if (!patientId || !medicationId || !pharmacyId) {
      setError("Patient, medication, and pharmacy are required");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/brand-simulator/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          medicationName: selectedMed?.name ?? "",
          strength: selectedMed?.strength ?? "",
          dosageForm: selectedMed?.form ?? "",
          quantity: parseInt(quantity) || 30,
          refills: parseInt(refills) || 0,
          pharmacyId,
          brandId: brandId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to create order");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-medium text-gray-900 mb-3">Create Prescription</h2>

      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      {success && <p className="text-green-600 text-xs mb-2">Order created</p>}

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Patient *</label>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputClass}>
            <option value="">Select patient...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.lastName}, {p.firstName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Medication *</label>
          <select value={medicationId} onChange={(e) => setMedicationId(e.target.value)} className={inputClass}>
            <option value="">Select medication...</option>
            {medications.map((m) => (
              <option key={m.id} value={m.id}>{m.name} — {m.strength}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Refills</label>
            <input type="number" value={refills} onChange={(e) => setRefills(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Pharmacy *</label>
          <select value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)} className={inputClass}>
            {pharmacies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Brand</label>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass}>
            <option value="">None</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <button onClick={handleSubmit} disabled={saving}
          className="w-full bg-indigo-600 text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? "Creating..." : "Create Prescription"}
        </button>
      </div>
    </div>
  );
}
