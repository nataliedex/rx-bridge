// Lifefile integration formatter.
// Maps NormalizedOrder to the Lifefile prescription import format.
// Lifefile expects a specific CSV structure with these columns.

import type { PharmacyFormatter } from "./base";
import type { NormalizedOrder, PharmacyPacket } from "../types";

export const lifefileFormatter: PharmacyFormatter = {
  formatId: "lifefile",
  label: "Lifefile",

  format(order: NormalizedOrder): PharmacyPacket {
    return {
      format: "lifefile",
      generatedAt: new Date().toISOString(),
      orderId: order.orderId,
      patient: order.patient,
      prescriber: order.prescriber,
      prescription: order.prescription,
      pharmacy: order.pharmacy,
      compliance: order.compliance,
      sendReadiness: order.sendReadiness,
    };
  },
};

// --- Lifefile CSV column mapping ---

// Lifefile import expects these columns in this exact order.
export const LIFEFILE_COLUMNS = [
  "RxNumber",
  "PatientLastName",
  "PatientFirstName",
  "PatientDOB",
  "PatientPhone",
  "PatientEmail",
  "PatientAddress",
  "PrescriberName",
  "PrescriberNPI",
  "PrescriberClinic",
  "PrescriberPhone",
  "PrescriberFax",
  "MedicationName",
  "Strength",
  "DosageForm",
  "Route",
  "Directions",
  "Quantity",
  "Refills",
  "DaysSupply",
  "DiagnosisCode",
  "Notes",
] as const;

export type LifefileRow = Record<(typeof LIFEFILE_COLUMNS)[number], string>;

// Maps a NormalizedOrder to a Lifefile CSV row.
export function toLifefileRow(order: NormalizedOrder): LifefileRow {
  const [lastName, ...firstParts] = order.patient.fullName.split(" ").reverse();
  const firstName = firstParts.reverse().join(" ");

  return {
    RxNumber: order.orderId || "",
    PatientLastName: lastName || "",
    PatientFirstName: firstName || "",
    PatientDOB: order.patient.dob,
    PatientPhone: order.patient.phone,
    PatientEmail: order.patient.email,
    PatientAddress: order.patient.address,
    PrescriberName: order.prescriber.name,
    PrescriberNPI: order.prescriber.npi,
    PrescriberClinic: order.prescriber.clinic,
    PrescriberPhone: order.prescriber.phone,
    PrescriberFax: order.prescriber.fax,
    MedicationName: order.prescription.medication,
    Strength: order.prescription.strength,
    DosageForm: order.prescription.dosageForm,
    Route: order.prescription.route,
    Directions: order.prescription.directions,
    Quantity: order.prescription.quantity?.toString() || "",
    Refills: order.prescription.refills.toString(),
    DaysSupply: order.prescription.daysSupply?.toString() || "",
    DiagnosisCode: order.prescription.diagnosis,
    Notes: order.prescription.notes,
  };
}

// Escapes a CSV field value (wraps in quotes if it contains commas, quotes, or newlines).
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Generates a complete CSV string from multiple orders.
export function toLifefileCSV(orders: NormalizedOrder[]): string {
  const header = LIFEFILE_COLUMNS.join(",");
  const rows = orders.map((order) => {
    const row = toLifefileRow(order);
    return LIFEFILE_COLUMNS.map((col) => escapeCSV(row[col])).join(",");
  });
  return [header, ...rows].join("\n");
}

// --- Lifefile-specific validation ---

// Fields that Lifefile requires beyond standard pharmacy requirements.
export const LIFEFILE_REQUIRED_FIELDS = [
  "patient.dob",
  "prescriber.npi",
  "medication.name",
  "medication.directions",
  "medication.quantity",
  "medication.strength",
  "medication.dosageForm",
] as const;

export interface LifefileValidationResult {
  isReady: boolean;
  missingFields: string[];
}

// Checks whether an order has all fields Lifefile needs.
export function validateForLifefile(order: NormalizedOrder): LifefileValidationResult {
  const missingFields: string[] = [];

  if (!order.patient.dob) missingFields.push("Patient date of birth");
  if (!order.prescriber.npi) missingFields.push("Prescriber NPI");
  if (!order.prescription.medication) missingFields.push("Medication name");
  if (!order.prescription.directions) missingFields.push("Directions/sig");
  if (!order.prescription.quantity) missingFields.push("Quantity");
  if (!order.prescription.strength) missingFields.push("Strength");
  if (!order.prescription.dosageForm) missingFields.push("Dosage form");

  return {
    isReady: missingFields.length === 0,
    missingFields,
  };
}
