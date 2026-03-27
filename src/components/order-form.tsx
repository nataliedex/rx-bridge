"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createOrder, getBrandPharmacyConfigs, getPharmacyRouting } from "@/lib/actions";
import { createOrderSchema } from "@/lib/validators/order";
import type { Pharmacy, Brand } from "@prisma/client";
import type { RoutingResult } from "@/lib/routing";
import { formatPhone } from "@/lib/format";

interface PharmacyConfigItem {
  pharmacyId: string;
  isDefault: boolean;
  pharmacy: { id: string; name: string };
}

interface Props {
  pharmacies: Pharmacy[];
  brands: Brand[];
}

function Field({
  label, name, type = "text", required, value, onChange, error, placeholder, hint,
}: {
  label: string; name: string; type?: string; required?: boolean;
  value: string; onChange: (v: string) => void; error?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={name} name={name} type={type} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {hint && !error && <p className="text-gray-400 text-xs mt-1">{hint}</p>}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Section({ title, children, defaultOpen = true, count }: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  if (!defaultOpen) {
    return (
      <details className="bg-white border border-gray-200 rounded-lg mb-6 group" open={false}>
        <summary className="px-6 py-4 cursor-pointer select-none flex justify-between items-center hover:bg-gray-50">
          <span className="text-lg font-medium text-gray-900">{title}</span>
          {count !== undefined && <span className="text-xs text-gray-400">{count} fields</span>}
        </summary>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children}
          </div>
        </div>
      </details>
    );
  }
  return (
    <fieldset className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <legend className="text-lg font-medium text-gray-900 px-1">{title}</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {children}
      </div>
    </fieldset>
  );
}

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: "Verified recently",
  aging: "Price aging",
  stale: "Price stale",
  unverified: "Never verified",
};
const FRESHNESS_COLORS: Record<string, string> = {
  fresh: "text-green-600",
  aging: "text-amber-600",
  stale: "text-red-500",
  unverified: "text-red-600",
};

export function OrderForm({ pharmacies, brands }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  const [prescriberName, setPrescriberName] = useState("");
  const [npi, setNpi] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [prescriberPhone, setPrescriberPhone] = useState("");
  const [fax, setFax] = useState("");
  const [prescriberEmail, setPrescriberEmail] = useState("");
  const [prescriberAddress, setPrescriberAddress] = useState("");

  const [medicationName, setMedicationName] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [route, setRoute] = useState("");
  const [directions, setDirections] = useState("");
  const [quantity, setQuantity] = useState("");
  const [refills, setRefills] = useState("0");
  const [daysSupply, setDaysSupply] = useState("");
  const [icd10, setIcd10] = useState("");
  const [rxNotes, setRxNotes] = useState("");

  const [pharmacyId, setPharmacyId] = useState("");

  const [brandId, setBrandId] = useState("");
  const [orderSource, setOrderSource] = useState("manual");
  const [priority, setPriority] = useState("normal");
  const [internalNotes, setInternalNotes] = useState("");

  const [brandPharmacies, setBrandPharmacies] = useState<PharmacyConfigItem[]>([]);

  // Routing state
  const [routing, setRouting] = useState<RoutingResult | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingMethod, setRoutingMethod] = useState<"auto" | "manual" | null>(null);
  const routingDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch brand pharmacy configs
  useEffect(() => {
    if (!brandId) {
      setBrandPharmacies([]);
      return;
    }
    let cancelled = false;
    getBrandPharmacyConfigs(brandId).then((configs) => {
      if (cancelled) return;
      setBrandPharmacies(configs as PharmacyConfigItem[]);
    });
    return () => { cancelled = true; };
  }, [brandId]);

  // Auto-routing: trigger when medication name, patient state, or brand changes
  useEffect(() => {
    if (routingDebounce.current) clearTimeout(routingDebounce.current);

    if (!medicationName.trim() || medicationName.trim().length < 3) {
      setRouting(null);
      return;
    }

    routingDebounce.current = setTimeout(async () => {
      setRoutingLoading(true);
      try {
        const result = await getPharmacyRouting(
          medicationName.trim(),
          state.trim() || null,
          brandId || null,
        );
        setRouting(result);

        // Auto-select if we have a recommendation and user hasn't manually chosen
        if (result.status !== "no_eligible_pharmacy" && result.recommended && routingMethod !== "manual") {
          setPharmacyId(result.recommended.pharmacyId);
          setRoutingMethod("auto");
        }
      } catch {
        setRouting(null);
      } finally {
        setRoutingLoading(false);
      }
    }, 500);

    return () => { if (routingDebounce.current) clearTimeout(routingDebounce.current); };
  }, [medicationName, state, brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePharmacyChange(newId: string) {
    setPharmacyId(newId);
    setRoutingMethod(newId ? "manual" : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGlobalError("");

    const input = {
      patient: { firstName, lastName, dob, phone: patientPhone, email: patientEmail, address1, address2, city, state, zip },
      prescriber: { name: prescriberName, npi, clinicName, phone: prescriberPhone, fax, email: prescriberEmail, address: prescriberAddress },
      medication: {
        medicationName, strength, dosageForm, route, directions,
        quantity: quantity ? Number(quantity) : undefined,
        refills: refills ? Number(refills) : 0,
        daysSupply: daysSupply ? Number(daysSupply) : undefined,
        icd10, rxNotes,
      },
      pharmacy: { pharmacyId },
      internal: { brandId, orderSource: orderSource as "manual" | "ehr" | "api", priority: priority as "low" | "normal" | "high" | "urgent", internalNotes },
    };

    const result = createOrderSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path.join(".")] = issue.message;
      }
      setErrors(fieldErrors);
      setSubmitting(false);
      const firstKey = Object.keys(fieldErrors)[0];
      const el = document.querySelector(`[name="${firstKey?.split(".").pop()}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      const routingData = routing ? {
        method: routingMethod || "manual",
        json: JSON.stringify({
          recommendedPharmacyId: routing.recommended?.pharmacyId ?? null,
          recommendedPharmacyName: routing.recommended?.pharmacyName ?? null,
          price: routing.recommended?.price ?? null,
          freshness: routing.recommended?.freshness ?? null,
          reason: routing.reason,
          status: routing.status,
          alternatives: routing.alternatives.map((a) => ({
            pharmacyId: a.pharmacyId,
            pharmacyName: a.pharmacyName,
            price: a.price,
            freshness: a.freshness,
            flags: a.flags,
          })),
          ineligible: routing.ineligible.map((i) => ({
            pharmacyId: i.pharmacyId,
            pharmacyName: i.pharmacyName,
            price: i.price,
            reason: i.reason,
          })),
          computedAt: routing.computedAt,
        }),
      } : undefined;

      const order = await createOrder(result.data, routingData);
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Failed to create order");
      setSubmitting(false);
    }
  }

  const brandPharmacyIds = new Set(brandPharmacies.map((c) => c.pharmacyId));
  const otherPharmacies = pharmacies.filter((p) => !brandPharmacyIds.has(p.id));

  // Find current pharmacy in routing results for display
  const routedPharmacy = routing?.recommended?.pharmacyId === pharmacyId
    ? routing.recommended
    : routing?.alternatives.find((a) => a.pharmacyId === pharmacyId) ?? null;

  return (
    <form onSubmit={handleSubmit}>
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 mb-6 text-sm">{globalError}</div>
      )}

      {/* Routing — always open, most important */}
      <Section title="Brand & Fulfillment Routing">
        <div>
          <label htmlFor="brandId" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
          <select
            id="brandId" value={brandId}
            onChange={(e) => { setBrandId(e.target.value); setRoutingMethod(null); }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">No brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <p className="text-gray-400 text-xs mt-1">Rx-Bridge routes to the optimal pharmacy based on brand agreements</p>
        </div>
        <div>
          <label htmlFor="pharmacyId" className="block text-sm font-medium text-gray-700 mb-1">
            Fulfillment Pharmacy<span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="pharmacyId" value={pharmacyId} onChange={(e) => handlePharmacyChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Select a pharmacy...</option>
            {brandPharmacies.length > 0 && (
              <optgroup label={`${brands.find(b => b.id === brandId)?.name} pharmacies`}>
                {brandPharmacies.map((cp) => (
                  <option key={cp.pharmacyId} value={cp.pharmacyId}>
                    {cp.pharmacy.name}{cp.isDefault ? " (brand default)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {otherPharmacies.length > 0 && (
              <optgroup label={brandPharmacies.length > 0 ? "Other pharmacies" : "All pharmacies"}>
                {otherPharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
          </select>

          {/* Routing recommendation display */}
          {routingLoading && (
            <p className="text-xs text-gray-400 mt-1">Finding best pharmacy...</p>
          )}
          {!routingLoading && routing && routing.status === "recommended" && routingMethod === "auto" && routing.recommended && (
            <div className="mt-1.5 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-green-700">Auto-selected: lowest valid price</span>
                <span className={`text-[10px] ${FRESHNESS_COLORS[routing.recommended.freshness]}`}>
                  {FRESHNESS_LABELS[routing.recommended.freshness]}
                </span>
              </div>
              <p className="text-[11px] text-green-600 mt-0.5">
                ${routing.recommended.price.toFixed(2)} at {routing.recommended.pharmacyName}
                {routing.recommended.isBrandDefault && " · brand preferred"}
              </p>
              {routing.alternatives.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {routing.alternatives.length} other eligible pharmac{routing.alternatives.length !== 1 ? "ies" : "y"}
                </p>
              )}
            </div>
          )}
          {!routingLoading && routing && routing.status === "needs_review" && routingMethod === "auto" && routing.recommended && (
            <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <p className="text-xs font-medium text-amber-700">Best available — price needs verification</p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                ${routing.recommended.price.toFixed(2)} at {routing.recommended.pharmacyName}
                {routing.recommended.freshness === "unverified" && " — never verified"}
                {routing.recommended.freshness === "stale" && " — last verified over 60 days ago"}
              </p>
              <p className="text-[10px] text-amber-500 mt-1">Verify pricing in the Network tab before sending this order</p>
            </div>
          )}
          {!routingLoading && routing && routing.status === "no_eligible_pharmacy" && (
            <div className="mt-1.5 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <p className="text-xs font-medium text-red-700">No eligible pharmacy found</p>
              <p className="text-[11px] text-red-600 mt-0.5">{routing.reason}</p>
              <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-red-100">
                <span className="text-[10px] text-red-500">Next steps:</span>
                <a href="/medications" className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">Add pricing</a>
                <a href="/partnerships/pharmacies" className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium">Check service states</a>
                <span className="text-[10px] text-gray-400">or select a pharmacy manually above</span>
              </div>
            </div>
          )}
          {!routingLoading && routingMethod === "manual" && pharmacyId && routing?.recommended && routing.recommended.pharmacyId !== pharmacyId && (
            <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <p className="text-xs font-medium text-amber-700">Manual override</p>
              {routedPharmacy ? (
                <p className="text-[11px] text-amber-600 mt-0.5">
                  Selected {routedPharmacy.pharmacyName} at ${routedPharmacy.price.toFixed(2)}
                  {routedPharmacy.price > routing.recommended.price
                    ? ` — $${(routedPharmacy.price - routing.recommended.price).toFixed(2)} higher than ${routing.recommended.pharmacyName} ($${routing.recommended.price.toFixed(2)})`
                    : routedPharmacy.price < routing.recommended.price
                    ? ` — $${(routing.recommended.price - routedPharmacy.price).toFixed(2)} lower than recommended, but lower routing score`
                    : ` — same price as recommended`
                  }
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 mt-0.5">
                  Routing recommended {routing.recommended.pharmacyName} at ${routing.recommended.price.toFixed(2)}
                </p>
              )}
              <button type="button" onClick={() => { setPharmacyId(routing.recommended!.pharmacyId); setRoutingMethod("auto"); }}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium mt-1">
                Use recommended pharmacy instead
              </button>
            </div>
          )}
          {!routingLoading && !routing && !pharmacyId && (
            <p className="text-gray-400 text-xs mt-1">Enter a medication name to get a pharmacy recommendation</p>
          )}
          {errors["pharmacy.pharmacyId"] && <p className="text-red-600 text-xs mt-1">{errors["pharmacy.pharmacyId"]}</p>}
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </Section>

      {/* Core data — always open */}
      <Section title="Patient">
        <Field label="First Name" name="firstName" required value={firstName} onChange={setFirstName} error={errors["patient.firstName"]} />
        <Field label="Last Name" name="lastName" required value={lastName} onChange={setLastName} error={errors["patient.lastName"]} />
        <Field label="Date of Birth" name="dob" type="date" required value={dob} onChange={setDob} error={errors["patient.dob"]} />
        <Field label="Phone" name="patientPhone" type="tel" value={formatPhone(patientPhone)} onChange={(v) => setPatientPhone(v.replace(/\D/g, "").slice(0, 10))} hint="Required by most pharmacies" />
        <Field label="Email" name="patientEmail" type="email" value={patientEmail} onChange={setPatientEmail} error={errors["patient.email"]} />
        <Field label="Address Line 1" name="address1" value={address1} onChange={setAddress1} />
        <Field label="Address Line 2" name="address2" value={address2} onChange={setAddress2} />
        <Field label="City" name="city" value={city} onChange={setCity} />
        <Field label="State" name="state" value={state} onChange={(v) => { setState(v); setRoutingMethod(null); }} placeholder="e.g. CA" />
        <Field label="ZIP" name="zip" value={zip} onChange={setZip} />
      </Section>

      <Section title="Prescriber">
        <Field label="Prescriber Name" name="prescriberName" required value={prescriberName} onChange={setPrescriberName} error={errors["prescriber.name"]} />
        <Field label="NPI" name="npi" required value={npi} onChange={setNpi} error={errors["prescriber.npi"]} placeholder="10-digit NPI" hint="National Provider Identifier — required for all Rx" />
        <Field label="Clinic Name" name="clinicName" value={clinicName} onChange={setClinicName} />
        <Field label="Phone" name="prescriberPhone" type="tel" value={formatPhone(prescriberPhone)} onChange={(v) => setPrescriberPhone(v.replace(/\D/g, "").slice(0, 10))} />
        <Field label="Fax" name="fax" type="tel" value={formatPhone(fax)} onChange={(v) => setFax(v.replace(/\D/g, "").slice(0, 10))} hint="Preferred contact method for most pharmacies" />
        <Field label="Email" name="prescriberEmail" type="email" value={prescriberEmail} onChange={setPrescriberEmail} error={errors["prescriber.email"]} />
        <Field label="Address" name="prescriberAddress" value={prescriberAddress} onChange={setPrescriberAddress} />
      </Section>

      <Section title="Prescription">
        <Field label="Medication Name" name="medicationName" required value={medicationName} onChange={setMedicationName} error={errors["medication.medicationName"]} />
        <Field label="Strength" name="strength" value={strength} onChange={setStrength} placeholder="e.g. 200mg/mL" hint="Concentration or strength per unit" />
        <Field label="Dosage Form" name="dosageForm" value={dosageForm} onChange={setDosageForm} placeholder="e.g. Capsule, Injectable, Cream" />
        <Field label="Route" name="route" value={route} onChange={setRoute} placeholder="e.g. Oral, IM, Topical" />
        <div className="md:col-span-2 lg:col-span-3">
          <label htmlFor="directions" className="block text-sm font-medium text-gray-700 mb-1">
            Directions / Sig<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="directions" name="directions" value={directions} onChange={(e) => setDirections(e.target.value)}
            placeholder="e.g. Take 1 capsule by mouth daily at bedtime"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-gray-400 text-xs mt-1">Full prescriber instructions as they should appear on the label</p>
        </div>
        <Field label="Quantity" name="quantity" type="number" value={quantity} onChange={setQuantity} error={errors["medication.quantity"]} hint="Number of units to dispense" />
        <Field label="Refills" name="refills" type="number" value={refills} onChange={setRefills} hint="0 = no refills" />
        <Field label="Days Supply" name="daysSupply" type="number" value={daysSupply} onChange={setDaysSupply} hint="Total days this Rx covers (required if refills > 0)" />
        <Field label="ICD-10 / Diagnosis" name="icd10" value={icd10} onChange={setIcd10} placeholder="e.g. E29.1" hint="Diagnosis code — may be required for insurance" />
        <div className="md:col-span-2 lg:col-span-3">
          <label htmlFor="rxNotes" className="block text-sm font-medium text-gray-700 mb-1">Rx Notes</label>
          <textarea id="rxNotes" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} rows={2}
            placeholder="Special compounding instructions, titration notes, etc."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
      </Section>

      {/* Secondary — collapsed by default */}
      <Section title="Internal Notes & Source" defaultOpen={false} count={3}>
        <div>
          <label htmlFor="orderSource" className="block text-sm font-medium text-gray-700 mb-1">Order Source</label>
          <select id="orderSource" value={orderSource} onChange={(e) => setOrderSource(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="manual">Manual Entry</option>
            <option value="ehr">EHR Import</option>
            <option value="api">API</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="internalNotes" className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
          <textarea id="internalNotes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2}
            placeholder="Notes visible only to Rx-Bridge staff"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="border border-gray-300 rounded-md px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={submitting} className="bg-indigo-600 text-white rounded-md px-6 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Creating..." : "Create Order"}
        </button>
      </div>
    </form>
  );
}
