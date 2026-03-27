// Refill request service — validation, creation, pharmacy handoff, and lifecycle management.

import { prisma } from "../db";
import {
  REFILL_ERROR_CODES,
  TERMINAL_REFILL_STATUSES,
  IN_FLIGHT_REFILL_STATUSES,
  REFILL_CONSUMES_SLOT_STATUSES,
  CANCELLABLE_REFILL_STATUSES,
  type RefillErrorCode,
  type RefillStatus,
  type RefillPharmacyPayload,
} from "./types";
import type { RefillRequestInput, PharmacyFillStatusInput } from "./validators";

interface ValidationResult {
  valid: boolean;
  errorCode?: RefillErrorCode;
  errorMessage?: string;
}

// --- Validate a refill request against the stored prescription ---

export async function validateRefillRequest(input: RefillRequestInput): Promise<ValidationResult> {
  if (input.brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
    if (!brand) {
      return { valid: false, errorCode: REFILL_ERROR_CODES.BRAND_NOT_FOUND, errorMessage: "Brand not found" };
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: input.prescriptionId },
    include: { patient: true },
  });

  if (!order) {
    return { valid: false, errorCode: REFILL_ERROR_CODES.PRESCRIPTION_NOT_FOUND, errorMessage: "Prescription not found" };
  }

  if (input.brandId && order.brandId !== input.brandId) {
    return { valid: false, errorCode: REFILL_ERROR_CODES.UNAUTHORIZED_REFILL_ACCESS, errorMessage: "Brand is not authorized for this prescription" };
  }

  if (order.patientId !== input.patientId) {
    return { valid: false, errorCode: REFILL_ERROR_CODES.PATIENT_MISMATCH, errorMessage: "Patient does not match prescription" };
  }

  if (input.medicationName && order.medicationName !== input.medicationName) {
    return { valid: false, errorCode: REFILL_ERROR_CODES.MEDICATION_MISMATCH, errorMessage: `Medication mismatch: expected ${order.medicationName}` };
  }

  if (order.status !== "completed" && order.status !== "sent_to_pharmacy") {
    return { valid: false, errorCode: REFILL_ERROR_CODES.PRESCRIPTION_NOT_ACTIVE, errorMessage: `Prescription status is ${order.status}, must be completed or sent` };
  }

  // Refill slot accounting: count requests that consume a slot
  const consumedSlots = await prisma.refillRequest.count({
    where: {
      orderId: input.prescriptionId,
      status: { in: [...REFILL_CONSUMES_SLOT_STATUSES] },
    },
  });

  if (consumedSlots >= order.refills) {
    return { valid: false, errorCode: REFILL_ERROR_CODES.NO_REFILLS_REMAINING, errorMessage: `No refills remaining (${order.refills} authorized, ${consumedSlots} used/in-flight)` };
  }

  // In-flight check: only one active refill per prescription
  const inFlight = await prisma.refillRequest.findFirst({
    where: {
      orderId: input.prescriptionId,
      status: { in: [...IN_FLIGHT_REFILL_STATUSES] },
    },
  });

  if (inFlight) {
    return { valid: false, errorCode: REFILL_ERROR_CODES.REFILL_ALREADY_IN_PROGRESS, errorMessage: `Refill ${inFlight.id} is already in progress` };
  }

  return { valid: true };
}

// --- Create a refill request ---

export async function createRefillRequest(input: RefillRequestInput) {
  // Idempotency: return existing record for duplicate key
  if (input.idempotencyKey) {
    const existing = await prisma.refillRequest.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { created: false, refillRequest: existing, duplicate: true };
    }
  }

  const validation = await validateRefillRequest(input);

  const order = await prisma.order.findUnique({
    where: { id: input.prescriptionId },
  });

  if (!validation.valid) {
    // No order = can't create FK reference, return inline error
    if (!order) {
      return {
        created: false,
        refillRequest: { id: "", orderId: input.prescriptionId, status: "rejected" as const, createdAt: new Date() } as any,
        rejected: true,
        errorCode: validation.errorCode,
        errorMessage: validation.errorMessage,
      };
    }
    // Create rejected record for audit trail
    const rejected = await prisma.refillRequest.create({
      data: {
        orderId: input.prescriptionId,
        brandId: input.brandId,
        patientId: input.patientId,
        pharmacyId: order.pharmacyId,
        medicationName: order.medicationName,
        quantity: input.quantity ?? order.quantity,
        notes: input.notes,
        source: input.source ?? "api",
        idempotencyKey: input.idempotencyKey,
        requestedByUserId: input.requestedBy?.userId,
        requestedByName: input.requestedBy?.name,
        requestedByEmail: input.requestedBy?.email,
        status: "rejected",
        rejectionCode: validation.errorCode,
        rejectionReason: validation.errorMessage,
      },
    });
    return { created: true, refillRequest: rejected, rejected: true, errorCode: validation.errorCode, errorMessage: validation.errorMessage };
  }

  // Create validated request
  const refillRequest = await prisma.refillRequest.create({
    data: {
      orderId: input.prescriptionId,
      brandId: input.brandId,
      patientId: input.patientId,
      pharmacyId: order!.pharmacyId,
      medicationName: order!.medicationName,
      quantity: input.quantity ?? order!.quantity,
      notes: input.notes,
      source: input.source ?? "api",
      idempotencyKey: input.idempotencyKey,
      requestedByUserId: input.requestedBy?.userId,
      requestedByName: input.requestedBy?.name,
      requestedByEmail: input.requestedBy?.email,
      status: "validated",
      validatedAt: new Date(),
    },
  });

  return { created: true, refillRequest, rejected: false };
}

// --- Build pharmacy handoff payload ---

export async function buildPharmacyPayload(refillRequestId: string): Promise<RefillPharmacyPayload> {
  const rr = await prisma.refillRequest.findUniqueOrThrow({
    where: { id: refillRequestId },
    include: {
      order: { include: { patient: true, prescriber: true } },
      pharmacy: true,
    },
  });

  return {
    refillRequestId: rr.id,
    prescriptionId: rr.orderId,
    rxBridgeOrderId: rr.orderId,
    patientId: rr.patientId,
    medicationName: rr.medicationName,
    brandId: rr.brandId,
    quantity: rr.quantity,
    notes: rr.notes,
    type: "refill",
    patient: {
      firstName: rr.order.patient.firstName,
      lastName: rr.order.patient.lastName,
      dob: rr.order.patient.dob,
    },
    prescriber: {
      name: rr.order.prescriber.name,
      npi: rr.order.prescriber.npi,
    },
    pharmacy: {
      id: rr.pharmacy.id,
      name: rr.pharmacy.name,
    },
  };
}

// --- Process pharmacy fill status callback (with terminal-state guards) ---

export async function processPharmacyFillStatus(input: PharmacyFillStatusInput) {
  const rr = await prisma.refillRequest.findUnique({
    where: { id: input.refillRequestId },
  });

  if (!rr) {
    return { success: false, error: "Refill request not found" };
  }

  if (rr.orderId !== input.prescriptionId) {
    return { success: false, error: "Prescription ID mismatch" };
  }

  const statusMap: Record<string, RefillStatus> = {
    acknowledged: "pharmacy_acknowledged",
    filled: "filled",
    rejected: "rejected",
    cancelled: "cancelled",
  };

  const newStatus = statusMap[input.status];
  if (!newStatus) {
    return { success: false, error: `Unknown status: ${input.status}` };
  }

  const currentStatus = rr.status as RefillStatus;

  // Terminal-state guard: once terminal, status cannot change
  if (TERMINAL_REFILL_STATUSES.has(currentStatus)) {
    // Idempotent repeat of the same terminal status = no-op success
    if (newStatus === currentStatus) {
      return { success: true, refillRequest: rr, idempotent: true };
    }
    // Different status on a terminal record = blocked
    return {
      success: false,
      error: `Cannot transition from terminal status '${currentStatus}' to '${newStatus}'`,
    };
  }

  const updateData: Record<string, unknown> = { status: newStatus };

  if (input.status === "filled") {
    updateData.filledAt = input.filledAt ? new Date(input.filledAt) : new Date();
    if (input.quantityDispensed != null) updateData.quantityDispensed = input.quantityDispensed;
    if (input.pharmacyCostCents != null) updateData.pharmacyCostCents = input.pharmacyCostCents;
    if (input.sellPriceCents != null) updateData.sellPriceCents = input.sellPriceCents;
  }

  if (input.status === "cancelled") {
    updateData.cancelledAt = new Date();
  }

  if (input.pharmacyOrderId) {
    updateData.pharmacyOrderId = input.pharmacyOrderId;
  }

  const updated = await prisma.refillRequest.update({
    where: { id: input.refillRequestId },
    data: updateData,
  });

  return { success: true, refillRequest: updated };
}

// --- Send refill to pharmacy ---

const SENDABLE_STATUSES: ReadonlySet<RefillStatus> = new Set(["validated", "queued_for_pharmacy"]);

export async function sendRefillToPharmacy(refillRequestId: string) {
  const rr = await prisma.refillRequest.findUnique({
    where: { id: refillRequestId },
  });

  if (!rr) {
    return { success: false, error: "Refill request not found" };
  }

  const currentStatus = rr.status as RefillStatus;

  // Already sent = idempotent no-op
  if (currentStatus === "sent_to_pharmacy" || currentStatus === "pharmacy_acknowledged") {
    return { success: true, refillRequest: rr, idempotent: true };
  }

  if (TERMINAL_REFILL_STATUSES.has(currentStatus)) {
    return { success: false, error: `Cannot send refill in terminal status '${currentStatus}'` };
  }

  if (!SENDABLE_STATUSES.has(currentStatus)) {
    return { success: false, error: `Cannot send refill in status '${currentStatus}', must be validated or queued` };
  }

  // Build the pharmacy payload (validates all relations exist)
  const payload = await buildPharmacyPayload(refillRequestId);

  // Transition to sent
  const updated = await prisma.refillRequest.update({
    where: { id: refillRequestId },
    data: { status: "sent_to_pharmacy", sentToPharmacyAt: new Date() },
  });

  return { success: true, refillRequest: updated, pharmacyPayload: payload };
}

export async function bulkSendRefills(refillRequestIds: string[]) {
  const results: { refillRequestId: string; success: boolean; error?: string }[] = [];
  for (const id of refillRequestIds) {
    const result = await sendRefillToPharmacy(id);
    if (result.success) {
      results.push({ refillRequestId: id, success: true });
    } else {
      results.push({ refillRequestId: id, success: false, error: result.error });
    }
  }
  return results;
}

// --- Cancel a refill request ---

export async function cancelRefillRequest(refillRequestId: string) {
  const rr = await prisma.refillRequest.findUnique({
    where: { id: refillRequestId },
  });

  if (!rr) {
    return { success: false, error: "Refill request not found" };
  }

  const currentStatus = rr.status as RefillStatus;

  // Already cancelled = idempotent no-op
  if (currentStatus === "cancelled") {
    return { success: true, refillRequest: rr, idempotent: true };
  }

  // Cannot cancel terminal statuses (filled, rejected, expired)
  if (TERMINAL_REFILL_STATUSES.has(currentStatus)) {
    return { success: false, error: `Cannot cancel refill in terminal status '${currentStatus}'` };
  }

  // Can only cancel from known cancellable statuses
  if (!CANCELLABLE_REFILL_STATUSES.has(currentStatus)) {
    return { success: false, error: `Cannot cancel refill in status '${currentStatus}'` };
  }

  const updated = await prisma.refillRequest.update({
    where: { id: refillRequestId },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  return { success: true, refillRequest: updated };
}

// --- Get refill history for a prescription ---

export async function getRefillHistory(prescriptionId: string) {
  const order = await prisma.order.findUnique({
    where: { id: prescriptionId },
    select: { id: true, refills: true, medicationName: true },
  });

  if (!order) return null;

  const refills = await prisma.refillRequest.findMany({
    where: { orderId: prescriptionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      quantity: true,
      notes: true,
      source: true,
      rejectionCode: true,
      rejectionReason: true,
      quantityDispensed: true,
      pharmacyCostCents: true,
      sellPriceCents: true,
      createdAt: true,
      validatedAt: true,
      sentToPharmacyAt: true,
      filledAt: true,
      cancelledAt: true,
    },
  });

  const filledCount = refills.filter((r) => r.status === "filled").length;
  const inFlightCount = refills.filter((r) =>
    (IN_FLIGHT_REFILL_STATUSES as readonly string[]).includes(r.status)
  ).length;

  return {
    prescriptionId,
    medicationName: order.medicationName,
    refillsAuthorized: order.refills,
    refillsFilled: filledCount,
    refillsInFlight: inFlightCount,
    refillsRemaining: Math.max(0, order.refills - filledCount - inFlightCount),
    history: refills,
  };
}
