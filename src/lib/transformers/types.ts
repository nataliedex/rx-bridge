import type { SendReadiness } from "../types";

export interface NormalizedOrder {
  orderId: string | null;
  patient: {
    fullName: string;
    dob: string;
    phone: string;
    email: string;
    address: string;
  };
  prescriber: {
    name: string;
    npi: string;
    clinic: string;
    phone: string;
    fax: string;
    email: string;
    address: string;
  };
  prescription: {
    medication: string;
    strength: string;
    dosageForm: string;
    route: string;
    directions: string;
    quantity: number | null;
    refills: number;
    daysSupply: number | null;
    diagnosis: string;
    notes: string;
  };
  pharmacy: {
    id: string;
    name: string;
    fax: string;
    email: string;
    formatPreference: string;
  };
  compliance: ComplianceResult;
  sendReadiness: SendReadiness;
  meta: {
    source: string;
    priority: string;
    internalNotes: string;
    sourceRef: string;
    brandId: string;
  };
}

export interface MissingFieldInfo {
  field: string;
  label: string;
}

export interface ComplianceResult {
  missingRequired: string[];
  missingRequiredFields: MissingFieldInfo[];
  missingRecommended: string[];
  missingRecommendedFields: MissingFieldInfo[];
  warnings: string[];
  allRequiredPresent: boolean;
}

export interface PharmacyPacket {
  format: string;
  generatedAt: string;
  orderId: string | null;
  patient: NormalizedOrder["patient"];
  prescriber: NormalizedOrder["prescriber"];
  prescription: NormalizedOrder["prescription"];
  pharmacy: NormalizedOrder["pharmacy"];
  compliance: ComplianceResult;
  sendReadiness: SendReadiness;
}
