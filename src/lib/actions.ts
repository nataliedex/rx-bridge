"use server";

import { prisma } from "./db";
import { createOrderSchema, statusUpdateSchema, type CreateOrderInput } from "./validators/order";
import { manualAdapter } from "./intake/adapters/manual";
import { normalizeIntake, normalizeOrder, computeSendReadiness } from "./transformers/normalize";
import { transformOrder } from "./transformers/pipeline";
import type { ComplianceResult } from "./transformers/types";
import type { RawIntake } from "./intake/types";
import type { OrderStatus, SendReadiness } from "./types";

export async function getDashboardStats() {
  const [draft, needsAttention, approved, queued, sentToPharmacy] = await Promise.all([
    prisma.order.count({ where: { status: "draft" } }),
    // Needs Attention: data issues OR needs_clarification status, excluding post-send
    prisma.order.count({
      where: {
        OR: [
          { sendReadiness: { in: ["missing_data", "needs_review"] } },
          { status: "needs_clarification" },
        ],
        status: { notIn: ["sent_to_pharmacy", "completed", "rejected"] },
      },
    }),
    prisma.order.count({ where: { status: "approved" } }),
    prisma.order.count({ where: { status: "queued" } }),
    prisma.order.count({ where: { status: "sent_to_pharmacy" } }),
  ]);
  return { draft, needsAttention, approved, queued, sentToPharmacy };
}

export async function getOrders(search?: string, statusFilter?: string) {
  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") where.status = statusFilter;
  if (search) {
    // Split search into words so "Michael Davis" matches firstName=Michael + lastName=Davis
    const words = search.trim().split(/\s+/).filter(Boolean);
    const conditions: Record<string, unknown>[] = [];

    for (const word of words) {
      conditions.push(
        { patient: { firstName: { contains: word } } },
        { patient: { lastName: { contains: word } } },
        { medicationName: { contains: word } },
        { id: { contains: word } },
        { brand: { name: { contains: word } } },
        { pharmacy: { name: { contains: word } } },
      );
    }

    where.OR = conditions;
  }
  return prisma.order.findMany({
    where,
    include: { brand: true, patient: true, prescriber: true, pharmacy: true },
    orderBy: { createdAt: "desc" },
  });
}

// Typeahead suggestions grouped by category
export async function searchSuggestions(query: string) {
  if (!query || query.length < 2) return [];

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { patient: { firstName: { contains: query } } },
        { patient: { lastName: { contains: query } } },
        { medicationName: { contains: query } },
        { brand: { name: { contains: query } } },
        { pharmacy: { name: { contains: query } } },
      ],
    },
    include: { patient: true, brand: true, pharmacy: true },
    take: 20,
  });

  const seen = new Set<string>();
  const suggestions: { type: string; value: string }[] = [];

  for (const o of orders) {
    const fullName = `${o.patient.firstName} ${o.patient.lastName}`;
    if (fullName.toLowerCase().includes(query.toLowerCase()) && !seen.has(`patient:${fullName}`)) {
      seen.add(`patient:${fullName}`);
      suggestions.push({ type: "Patient", value: fullName });
    }
    if (o.medicationName.toLowerCase().includes(query.toLowerCase()) && !seen.has(`med:${o.medicationName}`)) {
      seen.add(`med:${o.medicationName}`);
      suggestions.push({ type: "Medication", value: o.medicationName });
    }
    if (o.brand?.name.toLowerCase().includes(query.toLowerCase()) && !seen.has(`brand:${o.brand.name}`)) {
      seen.add(`brand:${o.brand.name}`);
      suggestions.push({ type: "Brand", value: o.brand.name });
    }
    if (o.pharmacy.name.toLowerCase().includes(query.toLowerCase()) && !seen.has(`pharm:${o.pharmacy.name}`)) {
      seen.add(`pharm:${o.pharmacy.name}`);
      suggestions.push({ type: "Pharmacy", value: o.pharmacy.name });
    }
  }

  return suggestions.slice(0, 10);
}

export async function getOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      brand: true,
      patient: true,
      prescriber: true,
      pharmacy: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
      issues: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] }, // blocking first
      transmissions: { orderBy: { sentAt: "desc" } },
    },
  });
}

export async function getPharmacies() {
  return prisma.pharmacy.findMany({ orderBy: { name: "asc" } });
}

export async function getBrands() {
  return prisma.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

// --- Brand-Pharmacy config ---

export async function getBrandPharmacyConfigs(brandId: string) {
  return prisma.brandPharmacyConfig.findMany({
    where: { brandId, isActive: true },
    include: { pharmacy: true },
    orderBy: { routingPriority: "asc" },
  });
}

async function resolveFormatPreference(brandId: string | null | undefined, pharmacyId: string): Promise<string | undefined> {
  if (!brandId) return undefined;
  const config = await prisma.brandPharmacyConfig.findUnique({
    where: { brandId_pharmacyId: { brandId, pharmacyId } },
  });
  return config?.formatPreference || undefined;
}

// --- Issue generation from compliance ---
// Creates blocking issues for missing required fields only.

async function generateSystemIssues(orderId: string, compliance: ComplianceResult) {
  const existing = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system" },
    select: { fieldPath: true },
  });
  const existingFields = new Set(existing.map((i) => i.fieldPath));

  const toCreate: { orderId: string; type: string; severity: string; source: string; fieldPath: string; title: string; message: string }[] = [];

  for (const { field, label } of compliance.missingRequiredFields) {
    if (!existingFields.has(field)) {
      toCreate.push({
        orderId, fieldPath: field,
        type: "missing_required_field",
        severity: "blocking",
        source: "system",
        title: label,
        message: `Required by pharmacy: ${label}`,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.issue.createMany({ data: toCreate });
  }
}

// --- Send readiness recomputation ---
// Derives from open issues: any open blocking → missing_data, any open warning → needs_review, else ready.

async function recomputeSendReadiness(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { patient: true, prescriber: true, pharmacy: true },
  });

  // Start from compliance baseline
  const normalized = normalizeOrder(order as any);
  let sr: SendReadiness = computeSendReadiness(normalized.compliance);

  // Open blocking issues override to missing_data
  if (sr === "ready") {
    const openBlocking = await prisma.issue.count({
      where: { orderId, status: "open", severity: "blocking" },
    });
    if (openBlocking > 0) sr = "missing_data";
  }

  // Open warning issues override to needs_review
  if (sr === "ready") {
    const openWarning = await prisma.issue.count({
      where: { orderId, status: "open", severity: "warning" },
    });
    if (openWarning > 0) sr = "needs_review";
  }

  await prisma.order.update({ where: { id: orderId }, data: { sendReadiness: sr } });
  return sr;
}

// --- Order persistence ---

async function persistIntake(intake: RawIntake) {
  const pharmacy = await prisma.pharmacy.findUniqueOrThrow({ where: { id: intake.pharmacyId } });

  const normalized = normalizeIntake(intake, pharmacy);
  const sr = computeSendReadiness(normalized.compliance);

  const prescriber = await prisma.prescriber.upsert({
    where: { npi: intake.prescriber.npi },
    update: {
      name: intake.prescriber.name, clinicName: intake.prescriber.clinicName,
      phone: intake.prescriber.phone, fax: intake.prescriber.fax,
      email: intake.prescriber.email, address: intake.prescriber.address,
    },
    create: {
      name: intake.prescriber.name, npi: intake.prescriber.npi,
      clinicName: intake.prescriber.clinicName, phone: intake.prescriber.phone,
      fax: intake.prescriber.fax, email: intake.prescriber.email,
      address: intake.prescriber.address,
    },
  });

  const patient = await prisma.patient.create({
    data: {
      firstName: intake.patient.firstName, lastName: intake.patient.lastName,
      dob: intake.patient.dob, phone: intake.patient.phone,
      email: intake.patient.email || undefined,
      address1: intake.patient.address1, address2: intake.patient.address2,
      city: intake.patient.city, state: intake.patient.state, zip: intake.patient.zip,
    },
  });

  const initialStatus = intake.source === "manual" ? "draft" : "submitted";

  const order = await prisma.order.create({
    data: {
      brandId: intake.brandId || undefined,
      patientId: patient.id, prescriberId: prescriber.id,
      pharmacyId: intake.pharmacyId,
      medicationName: intake.medication.name, strength: intake.medication.strength,
      dosageForm: intake.medication.dosageForm, route: intake.medication.route,
      directions: intake.medication.directions, quantity: intake.medication.quantity,
      refills: intake.medication.refills ?? 0, daysSupply: intake.medication.daysSupply,
      icd10: intake.medication.icd10, rxNotes: intake.medication.notes,
      orderSource: intake.source, sourceRef: intake.meta.sourceRef,
      priority: intake.meta.priority || "normal",
      internalNotes: intake.meta.internalNotes,
      status: initialStatus, sendReadiness: sr,
      rawPayload: JSON.stringify(intake),
    },
  });

  await prisma.orderStatusHistory.create({
    data: { orderId: order.id, status: initialStatus, note: `Order created via ${intake.source}` },
  });

  await generateSystemIssues(order.id, normalized.compliance);

  return order;
}

export async function createOrder(input: CreateOrderInput) {
  const parsed = createOrderSchema.parse(input);
  const intake = manualAdapter.parse(parsed);
  return persistIntake(intake);
}

export async function createOrderFromIntake(intake: RawIntake) {
  return persistIntake(intake);
}

// --- Update order sections ---

export async function updatePrescription(orderId: string, data: {
  medicationName: string;
  strength: string;
  dosageForm: string;
  route: string;
  directions: string;
  quantity: number | null;
  refills: number;
  daysSupply: number | null;
  icd10: string;
  rxNotes: string;
}) {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      medicationName: data.medicationName,
      strength: data.strength || undefined,
      dosageForm: data.dosageForm || undefined,
      route: data.route || undefined,
      directions: data.directions || undefined,
      quantity: data.quantity,
      refills: data.refills,
      daysSupply: data.daysSupply,
      icd10: data.icd10 || undefined,
      rxNotes: data.rxNotes || undefined,
    },
  });

  // Re-run compliance and regenerate system issues
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { patient: true, prescriber: true, pharmacy: true },
  });
  const normalized = normalizeOrder(order as any);

  // Auto-resolve system issues whose fields are now present
  const openSystemIssues = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system", type: "missing_required_field" },
  });
  for (const issue of openSystemIssues) {
    if (issue.fieldPath) {
      const isMissing = normalized.compliance.missingRequiredFields.some((f) => f.field === issue.fieldPath);
      if (!isMissing) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: "resolved", resolvedAt: new Date(), resolutionNote: "Field data provided" },
        });
      }
    }
  }

  // Generate any new system issues that didn't exist before
  await generateSystemIssues(orderId, normalized.compliance);

  // Recompute send readiness
  await recomputeSendReadiness(orderId);

  return { success: true };
}

export async function updatePatient(orderId: string, data: {
  firstName: string; lastName: string; dob: string;
  phone: string; email: string;
  address1: string; address2: string; city: string; state: string; zip: string;
}) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  await prisma.patient.update({
    where: { id: order.patientId },
    data: {
      firstName: data.firstName, lastName: data.lastName, dob: data.dob,
      phone: data.phone || undefined, email: data.email || undefined,
      address1: data.address1 || undefined, address2: data.address2 || undefined,
      city: data.city || undefined, state: data.state || undefined, zip: data.zip || undefined,
    },
  });

  // Re-run compliance, auto-resolve system issues, recompute readiness
  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { patient: true, prescriber: true, pharmacy: true },
  });
  const normalized = normalizeOrder(updated as any);
  const openSystemIssues = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system", type: "missing_required_field" },
  });
  for (const issue of openSystemIssues) {
    if (issue.fieldPath) {
      const isMissing = normalized.compliance.missingRequiredFields.some((f) => f.field === issue.fieldPath);
      if (!isMissing) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: "resolved", resolvedAt: new Date(), resolutionNote: "Field data provided" },
        });
      }
    }
  }
  await generateSystemIssues(orderId, normalized.compliance);
  await recomputeSendReadiness(orderId);
  return { success: true };
}

export async function updatePrescriber(orderId: string, data: {
  name: string; npi: string; clinicName: string;
  phone: string; fax: string; email: string; address: string;
}) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  await prisma.prescriber.update({
    where: { id: order.prescriberId },
    data: {
      name: data.name, npi: data.npi, clinicName: data.clinicName || undefined,
      phone: data.phone || undefined, fax: data.fax || undefined,
      email: data.email || undefined, address: data.address || undefined,
    },
  });

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { patient: true, prescriber: true, pharmacy: true },
  });
  const normalized = normalizeOrder(updated as any);
  const openSystemIssues = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system", type: "missing_required_field" },
  });
  for (const issue of openSystemIssues) {
    if (issue.fieldPath) {
      const isMissing = normalized.compliance.missingRequiredFields.some((f) => f.field === issue.fieldPath);
      if (!isMissing) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: "resolved", resolvedAt: new Date(), resolutionNote: "Field data provided" },
        });
      }
    }
  }
  await generateSystemIssues(orderId, normalized.compliance);
  await recomputeSendReadiness(orderId);
  return { success: true };
}

export async function updateInternalNotes(orderId: string, notes: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { internalNotes: notes || undefined },
  });
  return { success: true };
}

// When status changes to needs_clarification with a note, auto-create a human issue.
export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string) {
  const parsed = statusUpdateSchema.parse({ orderId, status, note });
  const [order] = await Promise.all([
    prisma.order.update({ where: { id: parsed.orderId }, data: { status: parsed.status } }),
    prisma.orderStatusHistory.create({
      data: { orderId: parsed.orderId, status: parsed.status, note: parsed.note || undefined },
    }),
  ]);

  if (parsed.status === "needs_clarification" && parsed.note) {
    await prisma.issue.create({
      data: {
        orderId: parsed.orderId,
        type: "clarification_request",
        severity: "blocking",
        source: "rx_bridge_user",
        title: "Clarification needed",
        message: parsed.note,
      },
    });
    await recomputeSendReadiness(parsed.orderId);
  }

  return order;
}

// --- Approval ---

export async function approveOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "approved" || order.status === "queued") return order;
  if (order.status === "sent_to_pharmacy" || order.status === "completed") {
    throw new Error("Cannot approve an order that has already been sent or completed.");
  }
  const [updated] = await Promise.all([
    prisma.order.update({ where: { id: orderId }, data: { status: "approved" } }),
    prisma.orderStatusHistory.create({
      data: { orderId, status: "approved", note: "Order approved for pharmacy" },
    }),
  ]);
  return updated;
}

// --- Queue ---

export async function addToQueue(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "queued") return order;
  if (order.status !== "approved") {
    throw new Error(`Order must be approved before adding to queue (current: ${order.status}).`);
  }
  const [updated] = await Promise.all([
    prisma.order.update({ where: { id: orderId }, data: { status: "queued" } }),
    prisma.orderStatusHistory.create({
      data: { orderId, status: "queued", note: "Added to send queue" },
    }),
  ]);
  return updated;
}

// --- Issue actions ---

export async function resolveIssue(issueId: string, resolutionNote?: string) {
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { status: "resolved", resolvedAt: new Date(), resolutionNote: resolutionNote || undefined },
  });
  await recomputeSendReadiness(issue.orderId);
  return issue;
}

export async function dismissIssue(issueId: string, resolutionNote?: string) {
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { status: "dismissed", resolvedAt: new Date(), resolutionNote: resolutionNote || undefined },
  });
  await recomputeSendReadiness(issue.orderId);
  return issue;
}

export async function reopenIssue(issueId: string) {
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: { status: "open", resolvedAt: null, resolutionNote: null },
  });
  await recomputeSendReadiness(issue.orderId);
  return issue;
}

// --- Send to Pharmacy ---

export async function sendToPharmacy(orderId: string, override = false) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { patient: true, prescriber: true, pharmacy: true },
  });

  if (order.status !== "approved" && order.status !== "queued" && !override) {
    throw new Error(`Order must be approved or queued before sending (current: ${order.status}).`);
  }
  if (order.sendReadiness !== "ready" && !override) {
    throw new Error(`Order has unresolved issues (send readiness: ${order.sendReadiness}).`);
  }

  const formatOverride = await resolveFormatPreference(order.brandId, order.pharmacyId);
  const { packet } = transformOrder(order as any, formatOverride);

  const transmission = await prisma.orderTransmission.create({
    data: {
      orderId: order.id, pharmacyId: order.pharmacyId, method: "manual",
      payloadSnapshot: JSON.stringify(packet), overrideUsed: override,
    },
  });

  await Promise.all([
    prisma.order.update({ where: { id: orderId }, data: { status: "sent_to_pharmacy" } }),
    prisma.orderStatusHistory.create({
      data: {
        orderId, status: "sent_to_pharmacy",
        note: override
          ? `Sent to ${order.pharmacy.name} (override — unresolved issues)`
          : `Sent to ${order.pharmacy.name}`,
      },
    }),
  ]);

  return transmission;
}

export async function bulkSendToPharmacy(orderIds: string[]) {
  const results: { orderId: string; success: boolean; error?: string }[] = [];
  for (const orderId of orderIds) {
    try {
      await sendToPharmacy(orderId, false);
      results.push({ orderId, success: true });
    } catch (err) {
      results.push({ orderId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return results;
}

export async function getReadyQueue() {
  return prisma.order.findMany({
    where: { sendReadiness: "ready", status: "queued" },
    include: { brand: true, patient: true, prescriber: true, pharmacy: true },
    orderBy: [{ pharmacy: { name: "asc" } }, { priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function getRecentOrders(limit = 5) {
  return prisma.order.findMany({
    include: { brand: true, patient: true, pharmacy: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
