// --- Workflow status (human-driven, where the order is in the process) ---

export const ORDER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "needs_clarification",
  "correction_requested",
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
  correction_requested: "Correction Requested",
  approved: "Approved",
  queued: "Queued",
  sent_to_pharmacy: "At Pharmacy",
  completed: "Completed",
  rejected: "Rejected",
};

// Status colors: plain text for neutral states, badge only for important states
export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "text-gray-500",
  submitted: "text-gray-500",
  under_review: "text-gray-500",
  needs_clarification: "bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded",
  correction_requested: "bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded",
  approved: "text-gray-500",
  queued: "text-gray-500",
  sent_to_pharmacy: "text-gray-500",
  completed: "text-gray-500",
  rejected: "text-gray-400",
};

// --- Action Needed (system-computed, derived from open issues) ---

export const SEND_READINESS_VALUES = [
  "ready",
  "missing_data",
  "needs_review",
] as const;

export type SendReadiness = (typeof SEND_READINESS_VALUES)[number];

export const SEND_READINESS_LABELS: Record<SendReadiness, string> = {
  ready: "Ready to Queue",
  missing_data: "Fix Issues",
  needs_review: "Review",
};

export const SEND_READINESS_COLORS: Record<SendReadiness, string> = {
  ready: "text-gray-500",
  missing_data: "bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-semibold",
  needs_review: "bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold",
};

// Computes the Next Step label and color based on both status and send readiness.
export function getNextStep(status: string, sendReadiness: string): { label: string; color: string } | null {
  // Post-send statuses have no next step
  if (status === "sent_to_pharmacy" || status === "completed" || status === "rejected") return null;

  // Blocking issues always take priority
  if (sendReadiness === "missing_data") return { label: "Fix Issues", color: "bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-semibold" };

  // Status-specific next steps when data is ready
  if (status === "draft" || status === "submitted" || status === "under_review") {
    if (sendReadiness === "needs_review") return { label: "Review", color: "bg-amber-100 text-amber-800 font-semibold" };
    return { label: "Ready to Approve", color: "text-gray-500" };
  }

  if (status === "needs_clarification") {
    return { label: "Review", color: "bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold" };
  }

  if (status === "correction_requested") {
    return { label: "Awaiting Correction", color: "bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold" };
  }

  if (status === "approved") {
    return { label: "Ready to Queue", color: "text-gray-500" };
  }

  if (status === "queued") {
    return { label: "Ready to Send", color: "bg-green-50 text-green-700 px-1.5 py-0.5 rounded" };
  }

  return null;
}

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

// Inbound orders (EHR/API) cannot have their clinical data edited by Rx-Bridge.
export function isInboundOrder(orderSource: string): boolean {
  return orderSource === "ehr" || orderSource === "api";
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
