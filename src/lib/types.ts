// --- Workflow status (human-driven, where the order is in the process) ---

export const ORDER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "needs_clarification",
  "approved",
  "queued",
  "sent_to_pharmacy",
  "completed",
  "rejected",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  needs_clarification: "Needs Clarification",
  approved: "Approved",
  queued: "Queued",
  sent_to_pharmacy: "Sent",
  completed: "Completed",
  rejected: "Rejected",
};

// Neutral palette — status badges should not compete with Action Needed
export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-gray-100 text-gray-700",
  under_review: "bg-gray-100 text-gray-700",
  needs_clarification: "bg-gray-100 text-gray-700",
  approved: "bg-gray-100 text-gray-700",
  queued: "bg-gray-100 text-gray-700",
  sent_to_pharmacy: "bg-gray-100 text-gray-700",
  completed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

// --- Action Needed (system-computed, derived from open issues) ---

export const SEND_READINESS_VALUES = [
  "ready",
  "missing_data",
  "needs_review",
] as const;

export type SendReadiness = (typeof SEND_READINESS_VALUES)[number];

// Action-oriented labels
export const SEND_READINESS_LABELS: Record<SendReadiness, string> = {
  ready: "Ready",
  missing_data: "Fix required",
  needs_review: "Review required",
};

// Strong contrast for action items, neutral for ready
export const SEND_READINESS_COLORS: Record<SendReadiness, string> = {
  ready: "bg-green-50 text-green-700",
  missing_data: "bg-red-100 text-red-800 font-semibold",
  needs_review: "bg-amber-100 text-amber-800 font-semibold",
};

export const SEND_READINESS_TOOLTIPS: Record<SendReadiness, string> = {
  ready: "All checks passed — ready to proceed",
  missing_data: "Required fields are missing",
  needs_review: "There are open issues that must be resolved",
};

// --- Issue types ---

export const ISSUE_TYPES = ["missing_required_field", "validation_warning", "clarification_request", "manual_review"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_SEVERITIES = ["blocking", "warning", "info"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_SOURCES = ["system", "rx_bridge_user", "brand", "pharmacy"] as const;
export type IssueSource = (typeof ISSUE_SOURCES)[number];

export const ISSUE_SOURCE_LABELS: Record<IssueSource, string> = {
  system: "System",
  rx_bridge_user: "Rx-Bridge",
  brand: "Brand",
  pharmacy: "Pharmacy",
};

// --- Other enums ---

export const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITY_OPTIONS)[number];

export const ORDER_SOURCE_OPTIONS = ["manual", "ehr", "api"] as const;
export type OrderSource = (typeof ORDER_SOURCE_OPTIONS)[number];

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  manual: "Manual Entry",
  ehr: "EHR Import",
  api: "API",
};

// Send readiness is only meaningful before an order has been transmitted.
const POST_SEND_STATUSES: Set<string> = new Set(["sent_to_pharmacy", "completed", "rejected"]);
export function isSendReadinessRelevant(status: string): boolean {
  return !POST_SEND_STATUSES.has(status);
}

// --- Pharmacy requirements config ---

export interface PharmacyRequirements {
  requiredFields: string[];
  recommendedFields: string[];
}

export const DEFAULT_PHARMACY_REQUIREMENTS: PharmacyRequirements = {
  requiredFields: [
    "patient.dob",
    "prescriber.npi",
    "medication.name",
    "medication.directions",
    "medication.quantity",
  ],
  recommendedFields: [
    "patient.phone",
    "medication.strength",
    "medication.dosageForm",
    "medication.daysSupply",
  ],
};
