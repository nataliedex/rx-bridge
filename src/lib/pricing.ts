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

// Pricing strategy calculation helpers (shared between server and client)

// Markup: sell price = cost × (1 + markup%)
export function calcSellPriceFromMarkup(pharmacyCost: number, markupPct: number): number {
  return Math.round(pharmacyCost * (1 + markupPct / 100) * 100) / 100;
}

// Markup derived from sell price and cost
export function calcMarkupFromSellPrice(sellPrice: number, pharmacyCost: number): number {
  if (pharmacyCost <= 0) return 0;
  return Math.round(((sellPrice - pharmacyCost) / pharmacyCost) * 100);
}

// Margin derived (informational only): (sell - cost) / sell
export function calcMarginPct(sellPrice: number, pharmacyCost: number): number {
  if (sellPrice <= 0) return 0;
  return Math.round(((sellPrice - pharmacyCost) / sellPrice) * 100);
}

// Legacy alias — keep for any remaining refs during transition
export function calcSellPriceFromMargin(pharmacyCost: number, marginPct: number): number {
  return calcSellPriceFromMarkup(pharmacyCost, marginPct);
}
