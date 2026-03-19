// RawIntake is the source-agnostic shape that all input adapters must produce.
// It represents unvalidated, unnormalized data exactly as received from the source.
// Fields are intentionally loose (string | undefined) — normalization happens later.

export interface RawIntake {
  source: IntakeSource;
  receivedAt: string;

  brandId?: string;

  patient: {
    firstName: string;
    lastName: string;
    dob: string;
    phone?: string;
    email?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  prescriber: {
    name: string;
    npi: string;
    clinicName?: string;
    phone?: string;
    fax?: string;
    email?: string;
    address?: string;
  };

  medication: {
    name: string;
    strength?: string;
    dosageForm?: string;
    route?: string;
    directions?: string;
    quantity?: number;
    refills?: number;
    daysSupply?: number;
    icd10?: string;
    notes?: string;
  };

  pharmacyId: string;

  meta: {
    priority?: string;
    internalNotes?: string;
    sourceRef?: string;
    raw?: unknown; // original payload for audit/debugging
  };
}

export type IntakeSource = "manual" | "ehr" | "api";

export interface IntakeAdapter<TInput = unknown> {
  source: IntakeSource;
  parse(input: TInput): RawIntake;
}
