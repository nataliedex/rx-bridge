// Pricing utilities — currency, percent formatting, and verification constants.

// Standardized verification sources for MedicationPriceEntry.verificationSource
export const VERIFICATION_SOURCES = {
  MANUAL_UPDATE: "manual_update",
  PHARMACY_CONFIRMED: "pharmacy_confirmed",
  CONTRACT_IMPORT: "contract_import",
  SYSTEM_IMPORT: "system_import",
} as const;

export type VerificationSource = (typeof VERIFICATION_SOURCES)[keyof typeof VERIFICATION_SOURCES];

// Display labels for verification sources
export const VERIFICATION_SOURCE_LABELS: Record<string, string> = {
  manual_update: "Manual update",
  pharmacy_confirmed: "Pharmacy confirmed",
  contract_import: "Contract import",
  system_import: "System import",
};

// Maps dosageForm to a human-readable pricing unit
const FORM_UNIT_MAP: Record<string, string> = {
  "Capsule": "capsule",
  "Tablet": "tablet",
  "Troche": "troche",
  "Sublingual Tablet": "tablet",
  "Injectable Solution": "vial",
  "Topical Cream": "tube",
  "Nasal Spray": "bottle",
};

export function getPricingUnit(dosageForm: string): string {
  return FORM_UNIT_MAP[dosageForm] ?? "unit";
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPercent(pct: number): string {
  return `${Math.round(pct * 100)}%`;
}
