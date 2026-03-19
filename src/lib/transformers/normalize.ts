// Normalizer: the middle layer of the transformation pipeline.
// Takes raw data (from any intake source or from a DB record) and produces
// a clean NormalizedOrder with standardized formatting and compliance checks.

import type { Order, Patient, Prescriber, Pharmacy } from "@prisma/client";
import type { RawIntake } from "../intake/types";
import type { NormalizedOrder, ComplianceResult, MissingFieldInfo } from "./types";
import type { PharmacyRequirements, SendReadiness } from "../types";
import { DEFAULT_PHARMACY_REQUIREMENTS } from "../types";

// --- String normalization utilities ---

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.trim();
}

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
};

export function normalizeState(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_ABBREVIATIONS[trimmed.toLowerCase()] || trimmed;
}

function buildAddress(parts: {
  address1?: string; address2?: string;
  city?: string; state?: string; zip?: string;
}): string {
  const lines = [
    parts.address1?.trim(),
    parts.address2?.trim(),
    [parts.city?.trim(), normalizeState(parts.state), parts.zip?.trim()]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);
  return lines.join(", ");
}

const s = (v: string | null | undefined) => v?.trim() || "";

// --- Parse pharmacy requirements from JSON ---

export function parsePharmacyRequirements(json: string | null | undefined): PharmacyRequirements {
  if (!json) return DEFAULT_PHARMACY_REQUIREMENTS;
  try {
    const parsed = JSON.parse(json);
    return {
      requiredFields: Array.isArray(parsed.requiredFields) ? parsed.requiredFields : DEFAULT_PHARMACY_REQUIREMENTS.requiredFields,
      recommendedFields: Array.isArray(parsed.recommendedFields) ? parsed.recommendedFields : DEFAULT_PHARMACY_REQUIREMENTS.recommendedFields,
    };
  } catch {
    return DEFAULT_PHARMACY_REQUIREMENTS;
  }
}

// --- Field value resolver ---
// Maps dot-path field identifiers to actual values for compliance checking.

interface FieldData {
  patient: { dob: string; phone: string; email: string };
  prescriber: { npi: string; phone: string; fax: string };
  medication: {
    name: string; directions: string; quantity: number | null;
    strength: string; dosageForm: string; daysSupply: number | null;
    refills: number;
  };
}

export const FIELD_LABELS: Record<string, string> = {
  "patient.dob": "Patient date of birth",
  "patient.phone": "Patient phone",
  "patient.email": "Patient email",
  "prescriber.npi": "Prescriber NPI",
  "prescriber.phone": "Prescriber phone",
  "prescriber.fax": "Prescriber fax",
  "medication.name": "Medication name",
  "medication.directions": "Prescription directions/sig",
  "medication.quantity": "Quantity",
  "medication.strength": "Medication strength",
  "medication.dosageForm": "Dosage form",
  "medication.daysSupply": "Days supply",
};

function isFieldPresent(field: string, data: FieldData): boolean {
  const [section, key] = field.split(".") as [keyof FieldData, string];
  const val = (data[section] as Record<string, unknown>)?.[key];
  if (val === null || val === undefined || val === "" || val === 0) return false;
  return true;
}

// --- Compliance checking against pharmacy requirements ---

function checkCompliance(data: FieldData, requirements: PharmacyRequirements): ComplianceResult {
  const missingRequired: string[] = [];
  const missingRequiredFields: MissingFieldInfo[] = [];
  const missingRecommended: string[] = [];
  const missingRecommendedFields: MissingFieldInfo[] = [];
  const warnings: string[] = [];

  for (const field of requirements.requiredFields) {
    if (!isFieldPresent(field, data)) {
      const label = FIELD_LABELS[field] || field;
      missingRequired.push(label);
      missingRequiredFields.push({ field, label });
    }
  }

  for (const field of requirements.recommendedFields) {
    if (!isFieldPresent(field, data)) {
      const label = FIELD_LABELS[field] || field;
      missingRecommended.push(label);
      missingRecommendedFields.push({ field, label });
    }
  }

  if (!data.patient.phone && !data.patient.email) {
    warnings.push("Patient has no phone or email on file");
  }
  if (!data.prescriber.phone && !data.prescriber.fax) {
    warnings.push("Prescriber has no phone or fax on file");
  }
  if (data.medication.refills > 0 && !data.medication.daysSupply) {
    warnings.push("Refills specified without days supply");
  }

  return {
    missingRequired,
    missingRequiredFields,
    missingRecommended,
    missingRecommendedFields,
    warnings,
    allRequiredPresent: missingRequired.length === 0,
  };
}

// --- Compute send readiness from compliance (before issues are factored in) ---

export function computeSendReadiness(compliance: ComplianceResult): SendReadiness {
  if (compliance.missingRequired.length > 0) return "missing_data";
  return "ready";
}

// --- Normalize from RawIntake (pre-persistence, from any adapter) ---

export function normalizeIntake(
  intake: RawIntake,
  pharmacy: { id: string; name: string; fax?: string | null; email?: string | null; formatPreference: string; requirementsJson?: string | null },
): NormalizedOrder {
  const requirements = parsePharmacyRequirements(pharmacy.requirementsJson);

  const fieldData: FieldData = {
    patient: {
      dob: intake.patient.dob || "",
      phone: intake.patient.phone || "",
      email: intake.patient.email || "",
    },
    prescriber: {
      npi: intake.prescriber.npi || "",
      phone: intake.prescriber.phone || "",
      fax: intake.prescriber.fax || "",
    },
    medication: {
      name: intake.medication.name || "",
      directions: intake.medication.directions || "",
      quantity: intake.medication.quantity ?? null,
      strength: intake.medication.strength || "",
      dosageForm: intake.medication.dosageForm || "",
      daysSupply: intake.medication.daysSupply ?? null,
      refills: intake.medication.refills ?? 0,
    },
  };

  const compliance = checkCompliance(fieldData, requirements);
  const sendReadiness = computeSendReadiness(compliance);

  return {
    orderId: null,
    patient: {
      fullName: `${intake.patient.firstName.trim()} ${intake.patient.lastName.trim()}`,
      dob: intake.patient.dob,
      phone: normalizePhone(intake.patient.phone),
      email: s(intake.patient.email),
      address: buildAddress(intake.patient),
    },
    prescriber: {
      name: intake.prescriber.name.trim(),
      npi: intake.prescriber.npi.trim(),
      clinic: s(intake.prescriber.clinicName),
      phone: normalizePhone(intake.prescriber.phone),
      fax: normalizePhone(intake.prescriber.fax),
      email: s(intake.prescriber.email),
      address: s(intake.prescriber.address),
    },
    prescription: {
      medication: intake.medication.name.trim(),
      strength: s(intake.medication.strength),
      dosageForm: s(intake.medication.dosageForm),
      route: s(intake.medication.route),
      directions: s(intake.medication.directions),
      quantity: intake.medication.quantity ?? null,
      refills: intake.medication.refills ?? 0,
      daysSupply: intake.medication.daysSupply ?? null,
      diagnosis: s(intake.medication.icd10),
      notes: s(intake.medication.notes),
    },
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name.trim(),
      fax: normalizePhone(pharmacy.fax),
      email: s(pharmacy.email),
      formatPreference: pharmacy.formatPreference,
    },
    compliance,
    sendReadiness,
    meta: {
      source: intake.source,
      priority: intake.meta.priority || "normal",
      internalNotes: s(intake.meta.internalNotes),
      sourceRef: s(intake.meta.sourceRef),
      brandId: intake.brandId || "",
    },
  };
}

// --- Normalize from a persisted DB order (for detail/export pages) ---

type OrderWithRelations = Order & {
  patient: Patient;
  prescriber: Prescriber;
  pharmacy: Pharmacy;
};

export function normalizeOrder(order: OrderWithRelations): NormalizedOrder {
  const requirements = parsePharmacyRequirements((order.pharmacy as any).requirementsJson);

  const fieldData: FieldData = {
    patient: {
      dob: order.patient.dob || "",
      phone: order.patient.phone || "",
      email: order.patient.email || "",
    },
    prescriber: {
      npi: order.prescriber.npi || "",
      phone: order.prescriber.phone || "",
      fax: order.prescriber.fax || "",
    },
    medication: {
      name: order.medicationName || "",
      directions: order.directions || "",
      quantity: order.quantity,
      strength: order.strength || "",
      dosageForm: order.dosageForm || "",
      daysSupply: order.daysSupply,
      refills: order.refills,
    },
  };

  const compliance = checkCompliance(fieldData, requirements);
  const sendReadiness = computeSendReadiness(compliance);

  return {
    orderId: order.id,
    patient: {
      fullName: `${order.patient.firstName.trim()} ${order.patient.lastName.trim()}`,
      dob: order.patient.dob,
      phone: normalizePhone(order.patient.phone),
      email: s(order.patient.email),
      address: buildAddress({
        address1: order.patient.address1 ?? undefined,
        address2: order.patient.address2 ?? undefined,
        city: order.patient.city ?? undefined,
        state: order.patient.state ?? undefined,
        zip: order.patient.zip ?? undefined,
      }),
    },
    prescriber: {
      name: order.prescriber.name.trim(),
      npi: order.prescriber.npi.trim(),
      clinic: s(order.prescriber.clinicName),
      phone: normalizePhone(order.prescriber.phone),
      fax: normalizePhone(order.prescriber.fax),
      email: s(order.prescriber.email),
      address: s(order.prescriber.address),
    },
    prescription: {
      medication: order.medicationName.trim(),
      strength: s(order.strength),
      dosageForm: s(order.dosageForm),
      route: s(order.route),
      directions: s(order.directions),
      quantity: order.quantity,
      refills: order.refills,
      daysSupply: order.daysSupply,
      diagnosis: s(order.icd10),
      notes: s(order.rxNotes),
    },
    pharmacy: {
      id: order.pharmacy.id,
      name: order.pharmacy.name.trim(),
      fax: normalizePhone(order.pharmacy.fax),
      email: s(order.pharmacy.email),
      formatPreference: order.pharmacy.formatPreference,
    },
    compliance,
    sendReadiness,
    meta: {
      source: order.orderSource,
      priority: order.priority,
      internalNotes: s(order.internalNotes),
      sourceRef: s(order.sourceRef),
      brandId: order.brandId || "",
    },
  };
}
