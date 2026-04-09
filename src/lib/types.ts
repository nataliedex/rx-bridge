// GPO platform types

export const PROGRAM_STATUSES = ["active", "inactive", "expired"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  expired: "Expired",
};

export const PROGRAM_STATUS_COLORS: Record<ProgramStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  expired: "bg-red-100 text-red-600",
};

export const FILL_STATUSES = ["match", "mismatch", "missing"] as const;
export type FillStatus = (typeof FILL_STATUSES)[number];

export const FILL_STATUS_LABELS: Record<FillStatus, string> = {
  match: "Match",
  mismatch: "Mismatch",
  missing: "Missing",
};

export const FILL_STATUS_COLORS: Record<FillStatus, string> = {
  match: "bg-green-100 text-green-700",
  mismatch: "bg-red-100 text-red-600",
  missing: "bg-amber-100 text-amber-700",
};

// Med Spa pipeline
export const PIPELINE_STAGES = ["lead", "contacted", "pricing_requested", "pricing_sent", "negotiating", "won", "lost"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  pricing_requested: "Pricing Requested",
  pricing_sent: "Pricing Sent",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export const PIPELINE_COLORS: Record<PipelineStage, string> = {
  lead: "bg-gray-100 text-gray-600",
  contacted: "bg-blue-100 text-blue-700",
  pricing_requested: "bg-amber-100 text-amber-700",
  pricing_sent: "bg-indigo-100 text-indigo-700",
  negotiating: "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-600",
};

export function generateReferenceCode(brandName: string, pharmacyName: string, medName: string): string {
  const b = brandName.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase();
  const p = pharmacyName.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase();
  const m = medName.replace(/[^A-Z]/gi, "").slice(0, 3).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${b}-${p}-${m}-${rand}`;
}
