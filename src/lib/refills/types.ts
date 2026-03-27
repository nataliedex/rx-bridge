// Refill request types and statuses.

export const REFILL_STATUSES = [
  "pending_validation",
  "rejected",
  "validated",
  "queued_for_pharmacy",
  "sent_to_pharmacy",
  "pharmacy_acknowledged",
  "filled",
  "cancelled",
  "expired",
] as const;

export type RefillStatus = (typeof REFILL_STATUSES)[number];

// Status groups — single source of truth for status classification.
// Terminal: no further transitions allowed (except idempotent repeats).
export const TERMINAL_REFILL_STATUSES: ReadonlySet<RefillStatus> = new Set([
  "filled", "rejected", "cancelled", "expired",
]);

// In-flight: blocks new refill requests for the same prescription.
export const IN_FLIGHT_REFILL_STATUSES: readonly RefillStatus[] = [
  "pending_validation", "validated", "queued_for_pharmacy", "sent_to_pharmacy", "pharmacy_acknowledged",
];

// Consumes a refill slot: counts against order.refills for remaining calculation.
export const REFILL_CONSUMES_SLOT_STATUSES: readonly RefillStatus[] = [
  "validated", "queued_for_pharmacy", "sent_to_pharmacy", "pharmacy_acknowledged", "filled",
];

// Cancellable: statuses from which a refill can be cancelled by brand/ops.
export const CANCELLABLE_REFILL_STATUSES: ReadonlySet<RefillStatus> = new Set([
  "pending_validation", "validated", "queued_for_pharmacy", "sent_to_pharmacy",
]);

export const REFILL_SOURCES = ["brand_portal", "api", "internal_ops", "brand_simulator"] as const;
export type RefillSource = (typeof REFILL_SOURCES)[number];

// Error codes returned on rejection
export const REFILL_ERROR_CODES = {
  PRESCRIPTION_NOT_FOUND: "PRESCRIPTION_NOT_FOUND",
  PRESCRIPTION_EXPIRED: "PRESCRIPTION_EXPIRED",
  PRESCRIPTION_NOT_ACTIVE: "PRESCRIPTION_NOT_ACTIVE",
  NO_REFILLS_REMAINING: "NO_REFILLS_REMAINING",
  REFILL_ALREADY_IN_PROGRESS: "REFILL_ALREADY_IN_PROGRESS",
  UNAUTHORIZED_REFILL_ACCESS: "UNAUTHORIZED_REFILL_ACCESS",
  PATIENT_MISMATCH: "PATIENT_MISMATCH",
  MEDICATION_MISMATCH: "MEDICATION_MISMATCH",
  BRAND_NOT_FOUND: "BRAND_NOT_FOUND",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
} as const;

export type RefillErrorCode = (typeof REFILL_ERROR_CODES)[keyof typeof REFILL_ERROR_CODES];

// Normalized pharmacy handoff payload
export interface RefillPharmacyPayload {
  refillRequestId: string;
  prescriptionId: string; // = orderId in our system
  rxBridgeOrderId: string;
  patientId: string;
  medicationName: string;
  brandId: string | null;
  quantity: number | null;
  notes: string | null;
  type: "refill";
  patient: {
    firstName: string;
    lastName: string;
    dob: string;
  };
  prescriber: {
    name: string;
    npi: string;
  };
  pharmacy: {
    id: string;
    name: string;
  };
}

// Pharmacy callback payload
export interface PharmacyFillStatusPayload {
  pharmacyId: string;
  refillRequestId: string;
  prescriptionId: string;
  rxBridgeOrderId: string;
  pharmacyOrderId?: string;
  status: "acknowledged" | "filled" | "rejected" | "cancelled";
  fillType?: "full" | "partial";
  quantityDispensed?: number;
  filledAt?: string;
  pharmacyCostCents?: number;
  sellPriceCents?: number;
}
