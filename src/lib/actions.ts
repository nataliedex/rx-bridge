"use server";

import { prisma } from "./db";
import { createOrderSchema, statusUpdateSchema, type CreateOrderInput } from "./validators/order";
import { manualAdapter } from "./intake/adapters/manual";
import { normalizeIntake, normalizeOrder, computeSendReadiness, FIELD_ISSUE_TITLES, FIELD_RESOLVED_LABELS } from "./transformers/normalize";
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

export async function getOrders(search?: string, statusFilter?: string, pharmacyId?: string) {
  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  } else {
    // Default view excludes completed and rejected — active operations only
    where.status = { notIn: ["completed", "rejected"] };
  }
  if (pharmacyId) where.pharmacyId = pharmacyId;
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
    const fullName = `${o.patient.lastName}, ${o.patient.firstName}`;
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
  return prisma.pharmacy.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });
}

export async function getBrands() {
  return prisma.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function getAllBrandsForAdmin() {
  const brands = await prisma.brand.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { name: "asc" },
  });
  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    active: b.active,
    contactName: b.contactName,
    email: b.email,
    phone: b.phone,
    website: b.website,
    notes: b.notes,
    orderCount: b._count.orders,
  }));
}

export async function createBrand(data: {
  name: string; contactName?: string; email?: string; phone?: string; website?: string; notes?: string;
}) {
  if (!data.name.trim()) throw new Error("Brand name is required");
  return prisma.brand.create({
    data: {
      name: data.name.trim(),
      contactName: data.contactName?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      website: data.website?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
    },
  });
}

export async function updateBrand(id: string, data: {
  contactName?: string; email?: string; phone?: string; website?: string; notes?: string;
}) {
  return prisma.brand.update({
    where: { id },
    data: {
      contactName: data.contactName?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
}

export async function updatePharmacyContact(id: string, data: {
  contactName?: string; phone?: string; email?: string; fax?: string;
}) {
  return prisma.pharmacy.update({
    where: { id },
    data: {
      contactName: data.contactName?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      fax: data.fax?.trim() || null,
    },
  });
}

export async function getBrandDetail(id: string) {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      _count: { select: { orders: true } },
    },
  });
  if (!brand) return null;

  // Top medications by order volume
  const medGroups = await prisma.order.groupBy({
    by: ["medicationName"],
    where: { brandId: id },
    _count: true,
    orderBy: { _count: { medicationName: "desc" } },
    take: 10,
  });

  // Pharmacy distribution
  const pharmGroups = await prisma.order.groupBy({
    by: ["pharmacyId"],
    where: { brandId: id },
    _count: true,
    orderBy: { _count: { pharmacyId: "desc" } },
  });
  const pharmIds = pharmGroups.map((g) => g.pharmacyId);
  const pharmacies = pharmIds.length > 0
    ? await prisma.pharmacy.findMany({ where: { id: { in: pharmIds } }, select: { id: true, name: true } })
    : [];
  const pharmMap = new Map(pharmacies.map((p) => [p.id, p.name]));

  // Fetch orders with fields needed for analytics
  const orders = await prisma.order.findMany({
    where: { brandId: id },
    select: { medicationName: true, quantity: true, pharmacyId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const medNames = [...new Set(orders.map((o) => o.medicationName))];
  const meds = medNames.length > 0
    ? await prisma.medication.findMany({ where: { name: { in: medNames } }, select: { name: true, sellPrice: true } })
    : [];
  const sellPriceMap = new Map(meds.filter((m) => m.sellPrice != null).map((m) => [m.name, m.sellPrice!]));

  // Also get lowest pharmacy costs for margin calc
  const medPrices = medNames.length > 0
    ? await prisma.medication.findMany({
        where: { name: { in: medNames } },
        include: { priceHistory: { where: { endDate: null }, orderBy: { price: "asc" }, take: 1 } },
      })
    : [];
  const lowestCostMap = new Map(
    medPrices.filter((m) => m.priceHistory.length > 0).map((m) => [m.name, m.priceHistory[0].price])
  );

  let totalRevenue = 0;
  let totalCost = 0;
  let validOrderCount = 0;
  let missingCostCount = 0;
  const marginPcts: number[] = [];

  for (const o of orders) {
    const sp = sellPriceMap.get(o.medicationName);
    const cost = lowestCostMap.get(o.medicationName);
    const qty = o.quantity ?? 1;
    if (sp != null) totalRevenue += sp * qty;
    if (sp != null && cost != null) {
      totalCost += cost * qty;
      validOrderCount++;
      marginPcts.push((sp - cost) / sp);
    } else if (sp != null && cost == null) {
      missingCostCount++;
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const avgMarginPct = marginPcts.length > 0
    ? marginPcts.reduce((a, b) => a + b, 0) / marginPcts.length
    : null;

  // Per-medication economics
  const medEconomics = medGroups.map((g) => {
    const sp = sellPriceMap.get(g.medicationName);
    const cost = lowestCostMap.get(g.medicationName);
    const revenue = sp != null ? sp * g._count : null;
    const medCost = cost != null ? cost * g._count : null;
    const profit = revenue != null && medCost != null ? revenue - medCost : null;
    const marginPct = sp != null && cost != null && sp > 0 ? (sp - cost) / sp : null;
    return {
      name: g.medicationName,
      count: g._count,
      sellPrice: sp ?? null,
      pharmacyCost: cost ?? null,
      revenue,
      cost: medCost,
      profit,
      marginPct,
    };
  });

  // Raw order data for analytics transformations
  const rawOrders = orders.map((o) => ({
    medicationName: o.medicationName,
    quantity: o.quantity,
    pharmacyId: o.pharmacyId,
    pharmacyName: pharmMap.get(o.pharmacyId) ?? "Unknown",
    sellPrice: sellPriceMap.get(o.medicationName) ?? null,
    pharmacyCost: lowestCostMap.get(o.medicationName) ?? null,
    createdAt: o.createdAt.toISOString(),
  }));

  // Recent activity: last 10 orders + filled refills
  const recentOrders = await prisma.order.findMany({
    where: { brandId: id },
    select: { id: true, medicationName: true, status: true, createdAt: true, patient: { select: { firstName: true, lastName: true } }, pharmacy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const recentRefills = await prisma.refillRequest.findMany({
    where: { brandId: id, status: "filled" },
    select: { id: true, medicationName: true, status: true, filledAt: true, patient: { select: { firstName: true, lastName: true } }, pharmacy: { select: { name: true } } },
    orderBy: { filledAt: "desc" },
    take: 10,
  });

  const recentActivity = [
    ...recentOrders.map((o) => ({ type: "order" as const, id: o.id, medication: o.medicationName, patient: `${o.patient.lastName}, ${o.patient.firstName}`, pharmacy: o.pharmacy.name, status: o.status, date: o.createdAt.toISOString() })),
    ...recentRefills.map((r) => ({ type: "refill" as const, id: r.id, medication: r.medicationName, patient: `${r.patient.lastName}, ${r.patient.firstName}`, pharmacy: r.pharmacy.name, status: r.status, date: (r.filledAt ?? new Date()).toISOString() })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  return {
    ...brand,
    totalOrders: brand._count.orders,
    totalRevenue,
    totalCost,
    totalProfit,
    avgMarginPct,
    validOrderCount,
    missingCostCount,
    topMedications: medEconomics,
    pharmacyDistribution: pharmGroups.map((g) => ({
      pharmacyId: g.pharmacyId,
      pharmacyName: pharmMap.get(g.pharmacyId) ?? "Unknown",
      count: g._count,
    })),
    rawOrders,
    recentActivity,
  };
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
        title: FIELD_ISSUE_TITLES[field] || `${label} missing`,
        message: "Required to send",
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

export async function createOrder(input: CreateOrderInput, routing?: { method: string; json: string }) {
  const parsed = createOrderSchema.parse(input);
  const intake = manualAdapter.parse(parsed);
  const order = await persistIntake(intake);

  // Store routing metadata if provided
  if (routing) {
    await prisma.order.update({
      where: { id: order.id },
      data: { routingMethod: routing.method, routingJson: routing.json },
    });
  }

  return order;
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
  const autoResolved: string[] = [];
  const openSystemIssues = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system", type: "missing_required_field" },
  });
  for (const issue of openSystemIssues) {
    if (issue.fieldPath) {
      const isMissing = normalized.compliance.missingRequiredFields.some((f) => f.field === issue.fieldPath);
      if (!isMissing) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });
        autoResolved.push(FIELD_RESOLVED_LABELS[issue.fieldPath!] || issue.title.replace("missing", "added"));
      }
    }
  }

  await generateSystemIssues(orderId, normalized.compliance);
  await recomputeSendReadiness(orderId);

  // Count remaining open human issues for this section
  const remainingHuman = await prisma.issue.count({
    where: { orderId, status: "open", source: { not: "system" } },
  });

  return { success: true, autoResolved, remainingHumanIssues: remainingHuman };
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

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { patient: true, prescriber: true, pharmacy: true },
  });
  const normalized = normalizeOrder(updated as any);
  const autoResolved: string[] = [];
  const openSystemIssues = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system", type: "missing_required_field" },
  });
  for (const issue of openSystemIssues) {
    if (issue.fieldPath) {
      const isMissing = normalized.compliance.missingRequiredFields.some((f) => f.field === issue.fieldPath);
      if (!isMissing) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });
        autoResolved.push(FIELD_RESOLVED_LABELS[issue.fieldPath!] || issue.title.replace("missing", "added"));
      }
    }
  }
  await generateSystemIssues(orderId, normalized.compliance);
  await recomputeSendReadiness(orderId);
  const remainingHuman = await prisma.issue.count({ where: { orderId, status: "open", source: { not: "system" } } });
  return { success: true, autoResolved, remainingHumanIssues: remainingHuman };
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
  const autoResolved: string[] = [];
  const openSystemIssues = await prisma.issue.findMany({
    where: { orderId, status: "open", source: "system", type: "missing_required_field" },
  });
  for (const issue of openSystemIssues) {
    if (issue.fieldPath) {
      const isMissing = normalized.compliance.missingRequiredFields.some((f) => f.field === issue.fieldPath);
      if (!isMissing) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });
        autoResolved.push(FIELD_RESOLVED_LABELS[issue.fieldPath!] || issue.title.replace("missing", "added"));
      }
    }
  }
  await generateSystemIssues(orderId, normalized.compliance);
  await recomputeSendReadiness(orderId);
  const remainingHuman = await prisma.issue.count({ where: { orderId, status: "open", source: { not: "system" } } });
  return { success: true, autoResolved, remainingHumanIssues: remainingHuman };
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
  const updateData: Record<string, unknown> = { status: parsed.status };
  // Set completedAt when entering completed status (only if not already set)
  if (parsed.status === "completed") {
    const existing = await prisma.order.findUnique({ where: { id: parsed.orderId }, select: { completedAt: true } });
    if (!existing?.completedAt) updateData.completedAt = new Date();
  }
  const [order] = await Promise.all([
    prisma.order.update({ where: { id: parsed.orderId }, data: updateData }),
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

export async function bulkAddToQueue(orderIds: string[]) {
  const results: { orderId: string; success: boolean; error?: string }[] = [];
  for (const orderId of orderIds) {
    try {
      await addToQueue(orderId);
      results.push({ orderId, success: true });
    } catch (err) {
      results.push({ orderId, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return results;
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

// --- Lifefile Export ---

export async function exportLifefileCSV(orderIds: string[], pharmacyId: string) {
  const { normalizeOrder } = await import("./transformers/normalize");
  const { toLifefileCSV, validateForLifefile } = await import("./transformers/formatters/lifefile");

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { patient: true, prescriber: true, pharmacy: true },
  });

  const normalized = orders.map((o) => normalizeOrder(o as any));

  const validation = normalized.map((n, i) => ({
    orderId: orders[i].id,
    ...validateForLifefile(n),
  }));

  const notReady = validation.filter((v) => !v.isReady);
  if (notReady.length > 0) {
    return {
      success: false as const,
      csv: null,
      fileName: null,
      errors: notReady.map((v) => ({ orderId: v.orderId, missingFields: v.missingFields })),
    };
  }

  const csv = toLifefileCSV(normalized);
  const pharmacy = await prisma.pharmacy.findUniqueOrThrow({ where: { id: pharmacyId } });
  const fileName = `lifefile-${pharmacy.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;

  // Create batch record
  const batch = await prisma.exportBatch.create({
    data: {
      pharmacyId,
      method: "lifefile_csv",
      fileName,
      orderCount: orders.length,
    },
  });

  // Log per-order transmissions linked to batch
  for (const order of orders) {
    await prisma.orderTransmission.create({
      data: {
        orderId: order.id,
        pharmacyId: order.pharmacyId,
        method: "lifefile_csv",
        payloadSnapshot: fileName, // store filename, not full CSV (it's the same for all)
        overrideUsed: false,
        batchId: batch.id,
      },
    });
  }

  return { success: true as const, csv, fileName, errors: null };
}

export async function getRecentExports(pharmacyId: string, limit = 5) {
  return prisma.exportBatch.findMany({
    where: { pharmacyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
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

// --- Network / Pricing ---

export async function getMedications(search?: string, pharmacyId?: string) {
  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search };
  }
  if (pharmacyId) {
    where.priceHistory = { some: { pharmacyId, endDate: null } };
  }

  const [meds, totalPharmacies] = await Promise.all([
    prisma.medication.findMany({
      where,
      include: {
        priceHistory: {
          where: { endDate: null },
          include: { pharmacy: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pharmacy.count({ where: { archivedAt: null } }),
  ]);

  const FRESH_DAYS = 30;
  const AGING_DAYS = 60;

  return meds.map((m) => {
    const active = pharmacyId ? m.priceHistory.filter((p) => p.pharmacyId === pharmacyId) : m.priceHistory;
    const lowestPrice = active.length > 0 ? Math.min(...active.map((p) => p.price)) : null;
    const bestMargin = m.sellPrice != null && lowestPrice != null ? m.sellPrice - lowestPrice : null;

    // Pricing health
    let staleCount = 0;
    let agingCount = 0;
    for (const p of m.priceHistory) {
      if (!p.verifiedAt) { staleCount++; continue; }
      const days = (Date.now() - p.verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (days > AGING_DAYS) staleCount++;
      else if (days > FRESH_DAYS) agingCount++;
    }
    const missingCount = totalPharmacies - m.priceHistory.length;

    return {
      ...m,
      pharmacyCount: m.priceHistory.length,
      lowestPrice,
      sellPrice: m.sellPrice,
      bestMargin,
      staleCount,
      agingCount,
      missingCount: missingCount > 0 ? missingCount : 0,
    };
  });
}

export async function networkSearchSuggestions(query: string) {
  if (!query || query.length < 2) return [];

  const [medications, pharmacies] = await Promise.all([
    prisma.medication.findMany({
      where: { name: { contains: query } },
      select: { name: true },
      take: 8,
    }),
    prisma.pharmacy.findMany({
      where: { name: { contains: query }, archivedAt: null },
      select: { name: true },
      take: 5,
    }),
  ]);

  const seen = new Set<string>();
  const results: { type: string; value: string }[] = [];

  for (const m of medications) {
    if (!seen.has(m.name)) { seen.add(m.name); results.push({ type: "Medication", value: m.name }); }
  }
  for (const p of pharmacies) {
    if (!seen.has(p.name)) { seen.add(p.name); results.push({ type: "Pharmacy", value: p.name }); }
  }

  return results;
}

export async function getNetworkPharmacies() {
  return prisma.pharmacy.findMany({
    where: { archivedAt: null, medicationPriceHistory: { some: { endDate: null } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getAllPharmaciesForAdmin() {
  const pharmacies = await prisma.pharmacy.findMany({
    include: {
      _count: { select: { orders: true } },
      medicationPriceHistory: { where: { endDate: null }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  return pharmacies.map((p) => ({
    id: p.id,
    name: p.name,
    contactName: p.contactName,
    phone: p.phone,
    email: p.email,
    street: p.street,
    city: p.city,
    state: p.state,
    zip: p.zip,
    serviceStates: p.serviceStates,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    activePriceCount: p.medicationPriceHistory.length,
    orderCount: p._count.orders,
  }));
}

export async function updatePharmacy(id: string, data: {
  name: string; street: string; city: string; state: string; zip: string;
  serviceStates: string[];
  email?: string; phone?: string; contactName?: string;
}) {
  if (!data.name.trim()) throw new Error("Pharmacy name is required");
  if (!data.street.trim()) throw new Error("Street address is required");
  if (!data.city.trim()) throw new Error("City is required");
  if (!data.state.trim()) throw new Error("State is required");
  if (!data.zip.trim()) throw new Error("ZIP code is required");
  if (!data.serviceStates.length) throw new Error("At least one service state is required");
  return prisma.pharmacy.update({
    where: { id },
    data: {
      name: data.name.trim(),
      street: data.street.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      zip: data.zip.trim(),
      serviceStates: JSON.stringify(data.serviceStates),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      contactName: data.contactName?.trim() || null,
    },
  });
}

export async function createMedication(data: { name: string; form: string; strength: string }) {
  if (!data.name.trim()) throw new Error("Medication name is required");
  return prisma.medication.create({
    data: { name: data.name.trim(), form: data.form.trim(), strength: data.strength.trim() },
  });
}

export async function createNetworkPharmacy(data: {
  name: string; street: string; city: string; state: string; zip: string;
  serviceStates: string[];
  email?: string; phone?: string; notes?: string;
}) {
  if (!data.name.trim()) throw new Error("Pharmacy name is required");
  if (!data.street.trim()) throw new Error("Street address is required");
  if (!data.city.trim()) throw new Error("City is required");
  if (!data.state.trim()) throw new Error("State is required");
  if (!data.zip.trim()) throw new Error("ZIP code is required");
  if (!data.serviceStates.length) throw new Error("At least one service state is required");
  return prisma.pharmacy.create({
    data: {
      name: data.name.trim(),
      street: data.street.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      zip: data.zip.trim(),
      serviceStates: JSON.stringify(data.serviceStates),
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      contactName: data.notes?.trim() || undefined,
    },
  });
}

export async function getMedication(id: string) {
  return prisma.medication.findUnique({
    where: { id },
    include: {
      priceHistory: {
        include: { pharmacy: true },
        orderBy: [{ endDate: "asc" }, { effectiveDate: "desc" }], // active (endDate=null) first, then newest
      },
    },
  });
}

// Update price: closes old active entry and creates new one
export async function updateMedicationPrice(medicationId: string, pharmacyId: string, newPrice: number, effectiveDate: string, notes?: string) {
  const effDate = new Date(effectiveDate);

  // Close the current active entry for this medication+pharmacy
  await prisma.medicationPriceEntry.updateMany({
    where: { medicationId, pharmacyId, endDate: null },
    data: { endDate: effDate },
  });

  // Create new active entry — mark as verified since the user just confirmed the price
  return prisma.medicationPriceEntry.create({
    data: {
      medicationId,
      pharmacyId,
      price: newPrice,
      effectiveDate: effDate,
      notes: notes?.trim() || undefined,
      verifiedAt: new Date(),
      verificationSource: "manual_update",
    },
  });
}

// --- Pricing Audit ---

export type AuditStatus = "fresh" | "aging" | "stale" | "missing" | "missing_sell_price";

interface AuditRow {
  medicationId: string;
  medicationName: string;
  medicationForm: string;
  pharmacyId: string;
  pharmacyName: string;
  priceEntryId: string | null;
  price: number | null;
  sellPrice: number | null;
  effectiveDate: string | null;
  verifiedAt: string | null;
  verificationSource: string | null;
  status: AuditStatus;
}

function computeAuditStatus(verifiedAt: Date | null): AuditStatus {
  if (!verifiedAt) return "stale";
  const days = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return "fresh";
  if (days <= 60) return "aging";
  return "stale";
}

export async function getPricingAudit(opts?: {
  filter?: "all" | "stale" | "missing";
  search?: string;
  pharmacyId?: string;
  medicationId?: string;
}): Promise<AuditRow[]> {
  const filter = opts?.filter || "all";
  const search = opts?.search?.toLowerCase();

  const [medications, pharmacies, activePrices] = await Promise.all([
    prisma.medication.findMany({ orderBy: { name: "asc" } }),
    prisma.pharmacy.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.medicationPriceEntry.findMany({
      where: { endDate: null },
      include: { medication: true, pharmacy: true },
    }),
  ]);

  // Index active prices by "medId:pharmId"
  const priceMap = new Map<string, typeof activePrices[number]>();
  for (const p of activePrices) {
    priceMap.set(`${p.medicationId}:${p.pharmacyId}`, p);
  }

  const filteredMeds = opts?.medicationId ? medications.filter((m) => m.id === opts.medicationId) : medications;
  const filteredPharms = opts?.pharmacyId ? pharmacies.filter((p) => p.id === opts.pharmacyId) : pharmacies;

  const rows: AuditRow[] = [];

  for (const med of filteredMeds) {
    for (const pharm of filteredPharms) {
      // Text search across both names
      if (search) {
        const words = search.split(/\s+/).filter(Boolean);
        const combined = `${med.name} ${pharm.name}`.toLowerCase();
        if (!words.every((w) => combined.includes(w))) continue;
      }

      const entry = priceMap.get(`${med.id}:${pharm.id}`);
      if (entry) {
        const freshness = computeAuditStatus(entry.verifiedAt);
        const status: AuditStatus = med.sellPrice == null ? "missing_sell_price" : freshness;
        if (filter === "missing") continue;
        if (filter === "stale" && freshness === "fresh" && status !== "missing_sell_price") continue;
        rows.push({
          medicationId: med.id,
          medicationName: med.name,
          medicationForm: med.form,
          pharmacyId: pharm.id,
          pharmacyName: pharm.name,
          priceEntryId: entry.id,
          price: entry.price,
          sellPrice: med.sellPrice,
          effectiveDate: entry.effectiveDate.toISOString(),
          verifiedAt: entry.verifiedAt?.toISOString() ?? null,
          verificationSource: entry.verificationSource ?? null,
          status,
        });
      } else {
        if (filter === "stale") continue;
        rows.push({
          medicationId: med.id,
          medicationName: med.name,
          medicationForm: med.form,
          pharmacyId: pharm.id,
          pharmacyName: pharm.name,
          priceEntryId: null,
          price: null,
          sellPrice: med.sellPrice,
          effectiveDate: null,
          verifiedAt: null,
          verificationSource: null,
          status: "missing",
        });
      }
    }
  }

  // Sort: stale/missing first, then aging, then fresh
  const order: Record<AuditStatus, number> = { missing: 0, missing_sell_price: 1, stale: 2, aging: 3, fresh: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.medicationName.localeCompare(b.medicationName));

  return rows;
}

export async function markPriceVerified(priceEntryId: string, source?: string) {
  return prisma.medicationPriceEntry.update({
    where: { id: priceEntryId },
    data: {
      verifiedAt: new Date(),
      verificationSource: source?.trim() || "manual_update",
    },
  });
}

// --- Pharmacy Routing ---

export async function getPharmacyRouting(
  medicationName: string,
  patientState: string | null,
  brandId: string | null,
  medicationId?: string | null,
) {
  const { computePharmacyRouting } = await import("./routing");
  const { getRoutingPolicy } = await import("./routing-config");
  type PharmacyCandidate = import("./routing").PharmacyCandidate;

  const policy = await getRoutingPolicy();

  // Prefer normalized medication ID when available, fall back to name match
  let medIds: string[];
  if (medicationId) {
    medIds = [medicationId];
  } else {
    const medications = await prisma.medication.findMany({
      where: { name: { contains: medicationName } },
      select: { id: true },
    });
    if (medications.length === 0) {
      return computePharmacyRouting([], patientState, policy);
    }
    medIds = medications.map((m) => m.id);
  }

  // Get all active prices for these medications at active pharmacies
  const prices = await prisma.medicationPriceEntry.findMany({
    where: {
      medicationId: { in: medIds },
      endDate: null,
      pharmacy: { archivedAt: null },
    },
    include: { pharmacy: true },
  });

  // Get brand-pharmacy configs if brand is specified
  let brandConfigs: { pharmacyId: string; isDefault: boolean; routingPriority: number }[] = [];
  if (brandId) {
    brandConfigs = await prisma.brandPharmacyConfig.findMany({
      where: { brandId, isActive: true },
      select: { pharmacyId: true, isDefault: true, routingPriority: true },
    });
  }
  const brandConfigMap = new Map(brandConfigs.map((c) => [c.pharmacyId, c]));

  // Build candidates
  const candidates: PharmacyCandidate[] = prices.map((p) => {
    const config = brandConfigMap.get(p.pharmacyId);
    let serviceStates: string[] = [];
    if (p.pharmacy.serviceStates) {
      try { serviceStates = JSON.parse(p.pharmacy.serviceStates); } catch {}
    }
    return {
      pharmacyId: p.pharmacyId,
      pharmacyName: p.pharmacy.name,
      medicationId: p.medicationId,
      price: p.price,
      effectiveDate: p.effectiveDate,
      verifiedAt: p.verifiedAt,
      serviceStates,
      isBrandDefault: config?.isDefault ?? false,
      brandRoutingPriority: config?.routingPriority ?? 999,
    };
  });

  return computePharmacyRouting(candidates, patientState, policy);
}

// --- Correction Requests ---

export async function createCorrectionRequest(orderId: string, data: {
  reason: string;
  requestedFrom: string;
  message?: string;
}) {
  if (!data.reason.trim()) throw new Error("Reason is required");
  if (!data.requestedFrom.trim()) throw new Error("Recipient is required");

  const request = await prisma.correctionRequest.create({
    data: {
      orderId,
      reason: data.reason.trim(),
      requestedFrom: data.requestedFrom,
      message: data.message?.trim() || undefined,
    },
  });

  // Update order status to correction_requested
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "correction_requested" },
  });

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: "correction_requested",
      note: `Correction requested from ${data.requestedFrom}: ${data.reason}`,
    },
  });

  return request;
}

export async function resolveCorrectionRequest(requestId: string, note?: string) {
  const request = await prisma.correctionRequest.update({
    where: { id: requestId },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      resolutionNote: note?.trim() || undefined,
    },
  });

  // Check if there are other open correction requests
  const openRequests = await prisma.correctionRequest.count({
    where: { orderId: request.orderId, status: "open" },
  });

  // If no more open requests, move order back to under_review
  if (openRequests === 0) {
    await prisma.order.update({
      where: { id: request.orderId },
      data: { status: "under_review" },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId: request.orderId,
        status: "under_review",
        note: "Correction received — returned to review",
      },
    });
  }

  return request;
}

export async function getCorrectionRequests(orderId: string) {
  return prisma.correctionRequest.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
}

// --- Sell Price ---

export async function updateSellPrice(medicationId: string, sellPrice: number) {
  if (sellPrice <= 0) throw new Error("Sell price must be positive");
  return prisma.medication.update({
    where: { id: medicationId },
    data: { sellPrice },
  });
}

export async function getSellPriceForMedication(medicationName: string) {
  const med = await prisma.medication.findFirst({
    where: { name: { contains: medicationName }, sellPrice: { not: null } },
    select: { sellPrice: true },
  });
  return med?.sellPrice ?? null;
}

// --- Routing Policy ---

export async function getRoutingPolicyAction() {
  const { getRoutingPolicy, DEFAULT_ROUTING_POLICY } = await import("./routing-config");
  const policy = await getRoutingPolicy();
  return { policy, defaults: DEFAULT_ROUTING_POLICY };
}

export async function updateRoutingPolicyAction(updates: Record<string, unknown>) {
  const { updateRoutingPolicy } = await import("./routing-config");
  return updateRoutingPolicy(updates as any);
}

export async function getPharmacyDetail(id: string) {
  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id },
    include: {
      medicationPriceHistory: {
        where: { endDate: null },
        include: { medication: true },
        orderBy: { medication: { name: "asc" } },
      },
      _count: { select: { orders: true } },
    },
  });
  if (!pharmacy) return null;

  // Order volume by brand
  const ordersByBrand = await prisma.order.groupBy({
    by: ["brandId"],
    where: { pharmacyId: id },
    _count: true,
  });
  const brandIds = ordersByBrand.map((o) => o.brandId).filter(Boolean) as string[];
  const brands = brandIds.length > 0 ? await prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true } }) : [];
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));

  return {
    ...pharmacy,
    totalOrders: pharmacy._count.orders,
    ordersByBrand: ordersByBrand.map((o) => ({
      brandId: o.brandId,
      brandName: o.brandId ? brandMap.get(o.brandId) ?? "Unknown" : "No brand",
      count: o._count,
    })),
  };
}

// --- Deactivation / Archival ---

export async function removeMedicationFromPharmacy(medicationId: string, pharmacyId: string) {
  // Close all active price entries — preserves history
  const result = await prisma.medicationPriceEntry.updateMany({
    where: { medicationId, pharmacyId, endDate: null },
    data: { endDate: new Date() },
  });
  if (result.count === 0) throw new Error("No active pricing to remove");
  return result;
}

export async function archivePharmacy(pharmacyId: string) {
  const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
  if (!pharmacy) throw new Error("Pharmacy not found");
  if (pharmacy.archivedAt) throw new Error("Pharmacy is already archived");

  // Close all active price entries for this pharmacy
  await prisma.medicationPriceEntry.updateMany({
    where: { pharmacyId, endDate: null },
    data: { endDate: new Date() },
  });

  // Mark pharmacy as archived
  return prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: { archivedAt: new Date() },
  });
}

export async function unarchivePharmacy(pharmacyId: string) {
  return prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: { archivedAt: null },
  });
}
