"use server";

import { prisma } from "./db";

// =============================================
// PROGRAM PRICING — SOURCE OF TRUTH
// =============================================

// Single source of truth for current program pricing.
// Do NOT use Medication.sellPrice for current pricing reads — it is legacy/compat only.

export async function getActiveProgramPrice(medicationId: string, date: Date = new Date()): Promise<number | null> {
  const record = await prisma.programPricing.findFirst({
    where: {
      medicationId,
      status: "active",
      effectiveFrom: { lte: date },
      OR: [
        { effectiveThrough: null },
        { effectiveThrough: { gte: date } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  return record?.price ?? null;
}

// Batch version: returns a Map<medicationId, price> for all active program prices.
export async function getAllActiveProgramPrices(date: Date = new Date()): Promise<Map<string, number>> {
  const records = await prisma.programPricing.findMany({
    where: {
      status: "active",
      effectiveFrom: { lte: date },
      OR: [
        { effectiveThrough: null },
        { effectiveThrough: { gte: date } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const map = new Map<string, number>();
  for (const r of records) {
    if (!map.has(r.medicationId)) map.set(r.medicationId, r.price);
  }
  return map;
}

// =============================================
// PRICING STRATEGY (Settings)
// =============================================

export type PricingMode = "manual" | "markup" | "hybrid";

export interface PricingStrategy {
  mode: PricingMode;
  enableMarkupGuidance: boolean;
  defaultMarkupPct: number; // e.g. 25 for 25%
  preventNegativeMargin: boolean;
  highlightLowMargin: boolean;
  minimumTargetFeePerScript: number | null;
  allowManualOverrides: boolean;
  freshnessMonths: number; // e.g. 12 — prices older than this are "stale"
  defaultContractTermMonths: number; // e.g. 12 — recommended contract duration
  // Legacy compat — kept for consumers that read these
  allowMedicationOverrides: boolean;
  allowMedSpaOverrides: boolean;
}

const PRICING_DEFAULTS: PricingStrategy = {
  mode: "manual",
  enableMarkupGuidance: false,
  defaultMarkupPct: 25,
  preventNegativeMargin: true,
  highlightLowMargin: true,
  minimumTargetFeePerScript: 5,
  allowManualOverrides: true,
  freshnessMonths: 12,
  defaultContractTermMonths: 12,
  allowMedicationOverrides: true,
  allowMedSpaOverrides: true,
};

export async function getPricingStrategy(): Promise<PricingStrategy> {
  const row = await prisma.appConfig.findUnique({ where: { key: "pricing_strategy" } });
  if (!row) return PRICING_DEFAULTS;
  try {
    const parsed = JSON.parse(row.value);
    // Migrate legacy mode values
    if (parsed.mode === "markup_based") { parsed.mode = "markup"; parsed.enableMarkupGuidance = true; }
    if (parsed.mode === "fixed_sell_price") { parsed.mode = "manual"; }
    return { ...PRICING_DEFAULTS, ...parsed };
  }
  catch { return PRICING_DEFAULTS; }
}

export async function savePricingStrategy(strategy: PricingStrategy) {
  await prisma.appConfig.upsert({
    where: { key: "pricing_strategy" },
    update: { value: JSON.stringify(strategy) },
    create: { key: "pricing_strategy", value: JSON.stringify(strategy) },
  });
  return strategy;
}

// Compute suggested sell price from pharmacy cost using current strategy
export async function computeSellPrice(pharmacyCost: number): Promise<{ sellPrice: number; markupPct: number; isSuggestion: boolean }> {
  const strategy = await getPricingStrategy();
  if (strategy.mode === "markup" || (strategy.mode === "hybrid" && strategy.enableMarkupGuidance)) {
    const sellPrice = Math.round(pharmacyCost * (1 + strategy.defaultMarkupPct / 100) * 100) / 100;
    return { sellPrice, markupPct: strategy.defaultMarkupPct, isSuggestion: strategy.mode === "hybrid" };
  }
  // manual mode or hybrid without guidance — no auto-calculation
  return { sellPrice: pharmacyCost, markupPct: 0, isSuggestion: false };
}

// =============================================
// DASHBOARD
// =============================================

export async function getDashboardData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    allOrders, medSpas, recentOrders, payoutIssues,
  ] = await Promise.all([
    prisma.medSpaFulfilledOrder.findMany({ where: { orderDate: { gte: monthStart } } }),
    prisma.medSpa.findMany({
      include: { _count: { select: { fulfilledOrders: true, pricingLines: true } } },
    }),
    prisma.medSpaFulfilledOrder.findMany({
      include: { medSpa: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.medSpaFulfilledOrder.findMany({
      where: { pharmacyCost: { equals: 0 } },
      include: { medSpa: { select: { id: true, name: true } } },
      take: 5,
    }),
  ]);

  // Snapshot — aligned with Ledger metrics
  const orderCount = allOrders.length;
  const pharmacySpend = Math.round(allOrders.reduce((s, o) => s + o.pharmacyCost, 0) * 100) / 100;
  const biskFees = Math.round(orderCount * 5 * 100) / 100;
  const totalCost = Math.round((pharmacySpend + biskFees) * 100) / 100;

  // Needs attention — grouped by med spa
  const attentionMap = new Map<string, { name: string; href: string; issues: string[]; priority: number }>();

  function addIssue(spaId: string, spaName: string, issue: string, priority: number) {
    const existing = attentionMap.get(spaId);
    if (existing) {
      existing.issues.push(issue);
      existing.priority = Math.min(existing.priority, priority);
    } else {
      attentionMap.set(spaId, { name: spaName, href: `/med-spas/${spaId}`, issues: [issue], priority });
    }
  }

  for (const spa of medSpas) {
    if (spa._count.pricingLines > 0 && spa._count.fulfilledOrders === 0) {
      addIssue(spa.id, spa.name, "No transactions recorded yet \u2014 start tracking activity", 1);
    }
    if ((spa.pipelineStage === "negotiating" || spa.pipelineStage === "pricing_sent") && spa._count.pricingLines > 0) {
      addIssue(spa.id, spa.name, `${spa.pipelineStage === "negotiating" ? "Negotiating" : "Proposal sent"} \u2014 follow up`, 2);
    }
  }

  for (const o of payoutIssues) {
    addIssue(o.medSpa.id, o.medSpa.name, `Treatment missing medication cost: ${o.medicationName}`, 3);
  }

  const attention = Array.from(attentionMap.values())
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);

  const recentActivity = recentOrders.slice(0, 5).map((o) => ({
    id: o.id,
    label: `${o.medSpa.name} — ${o.medicationName} (×${o.quantity})`,
    date: o.createdAt.toISOString(),
    href: `/med-spas/${o.medSpa.id}`,
  }));

  return {
    snapshot: { orderCount, pharmacySpend, biskFees, totalCost },
    attention,
    recentActivity,
    medSpaCount: medSpas.length,
  };
}

// =============================================
// BRANDS
// =============================================

export async function getAllBrandsForAdmin() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { programs: true } } },
  });
  return brands.map((b) => ({
    ...b,
    programCount: b._count.programs,
  }));
}

export async function getBrandDetail(id: string) {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      programs: {
        include: { pharmacy: true, medication: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!brand) return null;

  const fillRecords = await prisma.fillRecord.findMany({
    where: { brandId: id },
    include: { medication: true, pharmacy: true },
    orderBy: { fillDate: "desc" },
    take: 20,
  });

  return { ...brand, fillRecords };
}

export async function createBrand(data: { name: string; contactName?: string; email?: string; phone?: string; website?: string; notes?: string }) {
  return prisma.brand.create({ data });
}

export async function updateBrand(id: string, data: { name?: string; active?: boolean; contactName?: string; email?: string; phone?: string; website?: string; notes?: string }) {
  return prisma.brand.update({ where: { id }, data });
}

// =============================================
// PHARMACIES
// =============================================

export async function getAllPharmaciesForAdmin() {
  const pharmacies = await prisma.pharmacy.findMany({
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { programs: true } },
      medicationPriceHistory: { where: { endDate: null }, select: { id: true } },
    },
  });
  return pharmacies.map((p) => ({
    ...p,
    programCount: p._count.programs,
    activePriceCount: p.medicationPriceHistory.length,
  }));
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
      programs: {
        include: { brand: true, medication: true },
        orderBy: { createdAt: "desc" },
      },
      contractAuditLogs: {
        orderBy: { performedAt: "desc" },
        take: 50,
      },
    },
  });
  if (!pharmacy) return null;
  return { ...pharmacy, totalOrders: 0 };
}

export async function getNetworkPharmacies() {
  return prisma.pharmacy.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createNetworkPharmacy(data: {
  name: string; contactName?: string; phone?: string; fax?: string; email?: string;
  street?: string; city?: string; state?: string; zip?: string; serviceStates?: string;
  notes?: string;
}) {
  return prisma.pharmacy.create({ data });
}

export async function updatePharmacy(id: string, data: Record<string, unknown>) {
  return prisma.pharmacy.update({ where: { id }, data });
}

export async function updatePharmacyContact(id: string, data: { contactName?: string; phone?: string; email?: string; fax?: string }) {
  return prisma.pharmacy.update({ where: { id }, data });
}

export async function archivePharmacy(id: string) {
  return prisma.pharmacy.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function unarchivePharmacy(id: string) {
  return prisma.pharmacy.update({ where: { id }, data: { archivedAt: null } });
}

// =============================================
// MEDICATIONS
// =============================================

export async function getMedications(search?: string, pharmacyId?: string) {
  const where: Record<string, unknown> = {};
  if (search) where.name = { contains: search };
  if (pharmacyId) where.priceHistory = { some: { pharmacyId, endDate: null } };

  const [meds, totalPharmacies, programPrices] = await Promise.all([
    prisma.medication.findMany({
      where,
      include: {
        priceHistory: { where: { endDate: null }, include: { pharmacy: { select: { id: true, name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pharmacy.count({ where: { archivedAt: null } }),
    getAllActiveProgramPrices(),
  ]);

  const FRESH_DAYS = 30;
  const AGING_DAYS = 60;

  return meds.map((m) => {
    const active = pharmacyId ? m.priceHistory.filter((p) => p.pharmacyId === pharmacyId) : m.priceHistory;
    const lowestPrice = active.length > 0 ? Math.min(...active.map((p) => p.price)) : null;
    const programPrice = programPrices.get(m.id) ?? null; // Source of truth: ProgramPricing
    const bestMargin = programPrice != null && lowestPrice != null ? programPrice - lowestPrice : null;

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
      programPrice, // Active program price (not legacy sellPrice)
      bestMargin,
      staleCount,
      agingCount,
      missingCount: missingCount > 0 ? missingCount : 0,
    };
  });
}

export async function getMedication(id: string) {
  return prisma.medication.findUnique({
    where: { id },
    include: {
      priceHistory: {
        include: { pharmacy: true },
        orderBy: [{ endDate: "asc" }, { effectiveDate: "desc" }],
      },
    },
  });
}

export async function createMedication(data: { name: string; form: string; strength: string; sellPrice?: number }) {
  return prisma.medication.create({ data });
}

export async function updateSellPrice(medicationId: string, sellPrice: number) {
  return prisma.medication.update({ where: { id: medicationId }, data: { sellPrice } });
}

export async function updateMedicationPrice(medicationId: string, pharmacyId: string, newPrice: number, effectiveDate: string, notes?: string, sellPrice?: number) {
  const effDate = new Date(effectiveDate);
  // Get old price for audit diff
  const oldEntry = await prisma.medicationPriceEntry.findFirst({
    where: { medicationId, pharmacyId, endDate: null },
    include: { medication: { select: { name: true } } },
  });
  await prisma.medicationPriceEntry.updateMany({
    where: { medicationId, pharmacyId, endDate: null },
    data: { endDate: effDate },
  });
  const entry = await prisma.medicationPriceEntry.create({
    data: {
      medicationId, pharmacyId, price: newPrice, effectiveDate: effDate,
      notes: notes?.trim() || undefined,
      verifiedAt: new Date(), verificationSource: "manual_update",
    },
  });
  // Update sell price on the medication if provided
  if (sellPrice != null && sellPrice > 0) {
    await prisma.medication.update({ where: { id: medicationId }, data: { sellPrice } });
  }
  // Audit log
  const medName = oldEntry?.medication.name ?? "Unknown";
  const actionType = oldEntry ? "updated" : "created";
  const diff = oldEntry ? `${medName}: $${oldEntry.price.toFixed(2)} → $${newPrice.toFixed(2)}` : `${medName}: $${newPrice.toFixed(2)} (new)`;
  await prisma.contractAuditLog.create({
    data: {
      pharmacyId,
      actionType,
      changedFields: JSON.stringify({ medication: medName, oldPrice: oldEntry?.price ?? null, newPrice }),
      notes: diff,
    },
  });
  return entry;
}

export async function markPriceVerified(priceEntryId: string, source?: string) {
  return prisma.medicationPriceEntry.update({
    where: { id: priceEntryId },
    data: { verifiedAt: new Date(), verificationSource: source?.trim() || "manual_update" },
  });
}

export async function removeMedicationFromPharmacy(medicationId: string, pharmacyId: string) {
  const entry = await prisma.medicationPriceEntry.findFirst({
    where: { medicationId, pharmacyId, endDate: null },
    include: { medication: { select: { name: true } } },
  });
  await prisma.medicationPriceEntry.updateMany({
    where: { medicationId, pharmacyId, endDate: null },
    data: { endDate: new Date() },
  });
  if (entry) {
    await prisma.contractAuditLog.create({
      data: {
        pharmacyId,
        actionType: "deleted",
        changedFields: JSON.stringify({ medication: entry.medication.name, price: entry.price }),
        notes: `Removed ${entry.medication.name} ($${entry.price.toFixed(2)})`,
      },
    });
  }
}

// =============================================
// CONTRACT VERIFICATION & AUDIT
// =============================================

export type VerificationMethod = "confirmed" | "imported" | "estimated" | "renewal";
export type ContractAction = "created" | "updated" | "verified" | "deleted";

export async function verifyContract(pharmacyId: string, userId: string, method: VerificationMethod = "confirmed") {
  // Capture pricing snapshot at verification time
  const activePrices = await prisma.medicationPriceEntry.findMany({
    where: { pharmacyId, endDate: null },
    include: { medication: { select: { name: true, form: true } } },
    orderBy: { medication: { name: "asc" } },
  });
  const snapshot = activePrices.map((p) => ({
    medication: p.medication.name,
    form: p.medication.form,
    price: p.price,
  }));

  // Verification only — does NOT change contract term dates
  await prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: {
      contractVerifiedAt: new Date(),
      contractVerifiedBy: userId,
      contractVerificationMethod: method,
    },
  });
  await prisma.contractAuditLog.create({
    data: {
      pharmacyId,
      actionType: "verified",
      performedBy: userId,
      changedFields: JSON.stringify({ snapshot }),
      notes: `Contract verified via ${method}`,
    },
  });
}

export async function logContractAudit(pharmacyId: string, actionType: ContractAction, opts?: {
  changedFields?: string;
  performedBy?: string;
  notes?: string;
}) {
  return prisma.contractAuditLog.create({
    data: {
      pharmacyId,
      actionType,
      changedFields: opts?.changedFields,
      performedBy: opts?.performedBy,
      notes: opts?.notes,
    },
  });
}

export async function getContractAuditLog(pharmacyId: string) {
  return prisma.contractAuditLog.findMany({
    where: { pharmacyId },
    orderBy: { performedAt: "desc" },
    take: 50,
  });
}

export async function isContractVerificationRequired(
  contractVerifiedAt: Date | null,
  freshnessMonths: number,
): Promise<boolean> {
  if (!contractVerifiedAt) return true;
  const days = (Date.now() - contractVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  return days > freshnessMonths * 30;
}

// =============================================
// CONTRACT RENEWAL
// =============================================

export async function renewContract(pharmacyId: string, opts: {
  updates: { medicationId: string; newPrice: number }[];
  additions: { medicationId: string; price: number }[];
  removals: string[]; // medicationIds
  effectiveFrom: string;
  effectiveThrough: string;
  notes?: string;
}) {
  const now = new Date();
  const effFrom = new Date(opts.effectiveFrom);
  const effThrough = new Date(opts.effectiveThrough);

  // Capture BEFORE snapshot
  const beforePrices = await prisma.medicationPriceEntry.findMany({
    where: { pharmacyId, endDate: null },
    include: { medication: { select: { name: true, form: true } } },
    orderBy: { medication: { name: "asc" } },
  });
  const beforeSnapshot = beforePrices.map((p) => ({
    medicationId: p.medicationId,
    medication: p.medication.name,
    form: p.medication.form,
    price: p.price,
  }));

  // Supersede the current contract version, set new term
  await prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: {
      contractSupersededAt: now,
      contractEffectiveFrom: effFrom,
      contractEffectiveThrough: effThrough,
      contractStatus: "active",
    },
  });

  // Process price updates
  for (const u of opts.updates) {
    await updateMedicationPrice(u.medicationId, pharmacyId, u.newPrice, opts.effectiveFrom, opts.notes);
  }

  // Process additions
  for (const a of opts.additions) {
    await updateMedicationPrice(a.medicationId, pharmacyId, a.price, opts.effectiveFrom, opts.notes);
  }

  // Process removals
  for (const medId of opts.removals) {
    await removeMedicationFromPharmacy(medId, pharmacyId);
  }

  // Capture AFTER snapshot
  const afterPrices = await prisma.medicationPriceEntry.findMany({
    where: { pharmacyId, endDate: null },
    include: { medication: { select: { name: true, form: true } } },
    orderBy: { medication: { name: "asc" } },
  });
  const afterSnapshot = afterPrices.map((p) => ({
    medicationId: p.medicationId,
    medication: p.medication.name,
    form: p.medication.form,
    price: p.price,
  }));

  // Build comparison
  const beforeMap = new Map(beforeSnapshot.map((b) => [b.medicationId, b]));
  const afterMap = new Map(afterSnapshot.map((a) => [a.medicationId, a]));
  const comparison: { medication: string; form: string; previousPrice: number | null; newPrice: number | null }[] = afterSnapshot.map((a) => {
    const prev = beforeMap.get(a.medicationId);
    return { medication: a.medication, form: a.form, previousPrice: prev?.price ?? null, newPrice: a.price };
  });
  for (const b of beforeSnapshot) {
    if (!afterMap.has(b.medicationId)) {
      comparison.push({ medication: b.medication, form: b.form, previousPrice: b.price, newPrice: null });
    }
  }

  const parts: string[] = [];
  if (opts.updates.length > 0) parts.push(`${opts.updates.length} price${opts.updates.length !== 1 ? "s" : ""} updated`);
  if (opts.additions.length > 0) parts.push(`${opts.additions.length} medication${opts.additions.length !== 1 ? "s" : ""} added`);
  if (opts.removals.length > 0) parts.push(`${opts.removals.length} medication${opts.removals.length !== 1 ? "s" : ""} removed`);

  await prisma.contractAuditLog.create({
    data: {
      pharmacyId,
      actionType: "renewed",
      changedFields: JSON.stringify({
        effectiveFrom: opts.effectiveFrom,
        effectiveThrough: opts.effectiveThrough,
        comparison,
        snapshot: afterSnapshot,
      }),
      notes: `Contract renewed: ${parts.join(", ")}`,
    },
  });
}

// Scaffold — always returns true for now. Will later require verification before renewal.
export async function canRenewContract(_pharmacyId: string): Promise<boolean> {
  return true;
}

// =============================================
// PRICING AUDIT
// =============================================

export type AuditStatus = "active" | "expiring_soon" | "expired" | "unverified" | "missing";

function computeContractStatus(
  effectiveThrough: Date | null,
  verifiedAt: Date | null,
  hasPrice: boolean,
): AuditStatus {
  if (!hasPrice) return "missing";
  if (!verifiedAt) return "unverified";
  if (effectiveThrough) {
    const now = Date.now();
    const throughMs = effectiveThrough.getTime();
    if (throughMs < now) return "expired";
    const daysUntilExpiry = (throughMs - now) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry <= 60) return "expiring_soon";
  }
  return "active";
}

export async function getPricingAudit(opts?: {
  filter?: "all" | "stale" | "missing";
  search?: string;
  pharmacyId?: string;
  medicationId?: string;
}) {
  const filter = opts?.filter || "all";
  const search = opts?.search?.toLowerCase();

  const [medications, pharmacies, activePrices] = await Promise.all([
    prisma.medication.findMany({ orderBy: { name: "asc" } }),
    prisma.pharmacy.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.medicationPriceEntry.findMany({ where: { endDate: null }, include: { medication: true, pharmacy: true } }),
  ]);

  // Build pharmacy contract term lookup
  const pharmMap = new Map(pharmacies.map((p) => [p.id, p]));
  const priceMap = new Map<string, typeof activePrices[number]>();
  for (const p of activePrices) priceMap.set(`${p.medicationId}:${p.pharmacyId}`, p);

  const filteredMeds = opts?.medicationId ? medications.filter((m) => m.id === opts.medicationId) : medications;
  const filteredPharms = opts?.pharmacyId ? pharmacies.filter((p) => p.id === opts.pharmacyId) : pharmacies;

  const rows: {
    medicationId: string; medicationName: string; medicationForm: string;
    pharmacyId: string; pharmacyName: string;
    priceEntryId: string | null; price: number | null; sellPrice: number | null;
    effectiveFrom: string | null; effectiveThrough: string | null;
    verifiedAt: string | null;
    status: AuditStatus;
  }[] = [];

  for (const med of filteredMeds) {
    for (const pharm of filteredPharms) {
      if (search) {
        const combined = `${med.name} ${pharm.name}`.toLowerCase();
        if (!search.split(/\s+/).every((w) => combined.includes(w))) continue;
      }
      const entry = priceMap.get(`${med.id}:${pharm.id}`);
      const pharmacy = pharmMap.get(pharm.id);
      const effFrom = pharmacy?.contractEffectiveFrom ?? null;
      const effThrough = pharmacy?.contractEffectiveThrough ?? null;

      if (entry) {
        const status = computeContractStatus(effThrough, entry.verifiedAt, true);
        if (filter === "missing") continue;
        if (filter === "stale" && status === "active") continue;
        rows.push({
          medicationId: med.id, medicationName: med.name, medicationForm: med.form,
          pharmacyId: pharm.id, pharmacyName: pharm.name,
          priceEntryId: entry.id, price: entry.price, sellPrice: med.sellPrice,
          effectiveFrom: effFrom?.toISOString() ?? entry.effectiveDate.toISOString(),
          effectiveThrough: effThrough?.toISOString() ?? null,
          verifiedAt: entry.verifiedAt?.toISOString() ?? null,
          status,
        });
      } else {
        if (filter === "stale") continue;
        rows.push({
          medicationId: med.id, medicationName: med.name, medicationForm: med.form,
          pharmacyId: pharm.id, pharmacyName: pharm.name,
          priceEntryId: null, price: null, sellPrice: med.sellPrice,
          effectiveFrom: null, effectiveThrough: null,
          verifiedAt: null, status: "missing",
        });
      }
    }
  }

  const order: Record<AuditStatus, number> = { missing: 0, expired: 1, expiring_soon: 2, unverified: 3, active: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.medicationName.localeCompare(b.medicationName));
  return rows;
}

// =============================================
// PROGRAM PRICING (medication-first overview)
// =============================================

export type MedPricingStatus = "healthy" | "needs_renewal" | "low_margin" | "missing_price";

export interface PharmacyCostRow {
  pharmacyId: string;
  pharmacyName: string;
  cost: number;
  effectiveFrom: string | null;
  effectiveThrough: string | null;
  contractStatus: string;
}

export interface MedicationPricingRow {
  medicationId: string;
  medicationName: string;
  medicationForm: string;
  bestCost: number | null;
  bestCostPharmacy: string | null;
  costMin: number | null;
  costMax: number | null;
  programPrice: number | null;
  programPricingId: string | null;
  margin: number | null;
  marginPct: number | null;
  status: MedPricingStatus;
  pharmacyCosts: PharmacyCostRow[];
}

export async function getProgramPricingOverview(opts?: {
  search?: string;
  pharmacyId?: string;
  status?: string;
}): Promise<MedicationPricingRow[]> {
  const search = opts?.search?.toLowerCase();

  const [medications, activePrices, programPrices, pharmacies] = await Promise.all([
    prisma.medication.findMany({ orderBy: { name: "asc" } }),
    prisma.medicationPriceEntry.findMany({
      where: { endDate: null },
      include: { pharmacy: { select: { id: true, name: true, contractEffectiveFrom: true, contractEffectiveThrough: true, contractStatus: true, contractVerifiedAt: true } } },
    }),
    prisma.programPricing.findMany({ where: { status: "active" } }),
    prisma.pharmacy.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
  ]);

  const strategy = await getPricingStrategy();
  const minFee = strategy.minimumTargetFeePerScript ?? 5;

  // Index program prices by medication
  const programPriceMap = new Map<string, typeof programPrices[number]>();
  for (const pp of programPrices) {
    if (!programPriceMap.has(pp.medicationId)) programPriceMap.set(pp.medicationId, pp);
  }

  // Index pharmacy costs by medication
  const costsByMed = new Map<string, typeof activePrices>();
  for (const ap of activePrices) {
    if (!costsByMed.has(ap.medicationId)) costsByMed.set(ap.medicationId, []);
    costsByMed.get(ap.medicationId)!.push(ap);
  }

  const rows: MedicationPricingRow[] = [];

  for (const med of medications) {
    if (search && !med.name.toLowerCase().includes(search)) continue;

    const costs = costsByMed.get(med.id) ?? [];

    // Pharmacy filter
    if (opts?.pharmacyId) {
      if (!costs.some((c) => c.pharmacyId === opts.pharmacyId)) continue;
    }

    const sorted = [...costs].sort((a, b) => a.price - b.price);
    const bestCost = sorted.length > 0 ? sorted[0].price : null;
    const bestCostPharmacy = sorted.length > 0 ? sorted[0].pharmacy.name : null;
    const costMin = sorted.length > 0 ? sorted[0].price : null;
    const costMax = sorted.length > 0 ? sorted[sorted.length - 1].price : null;

    const pp = programPriceMap.get(med.id);
    const programPrice = pp?.price ?? null;
    const programPricingId = pp?.id ?? null;

    const margin = (programPrice != null && bestCost != null) ? Math.round((programPrice - bestCost) * 100) / 100 : null;
    const marginPct = (programPrice != null && bestCost != null && programPrice > 0) ? Math.round(((programPrice - bestCost) / programPrice) * 100) : null;

    // Status logic
    let status: MedPricingStatus = "healthy";
    if (programPrice == null) {
      status = "missing_price";
    } else {
      // Check if any pharmacy contract needs renewal
      const hasRenewalIssue = costs.some((c) => {
        const through = c.pharmacy.contractEffectiveThrough;
        if (!through) return false;
        return through.getTime() < Date.now();
      });
      if (hasRenewalIssue) status = "needs_renewal";

      // Check margin — use fee-per-script guardrail
      if (strategy.highlightLowMargin && margin != null && margin < minFee) {
        status = status === "healthy" ? "low_margin" : status;
      }
      // Negative margin check
      if (strategy.preventNegativeMargin && margin != null && margin < 0) {
        status = "low_margin";
      }
    }

    // Filter by status
    if (opts?.status && opts.status !== "all" && opts.status !== status) continue;

    const pharmacyCosts: PharmacyCostRow[] = sorted.map((c) => ({
      pharmacyId: c.pharmacyId,
      pharmacyName: c.pharmacy.name,
      cost: c.price,
      effectiveFrom: c.pharmacy.contractEffectiveFrom?.toISOString() ?? c.effectiveDate.toISOString(),
      effectiveThrough: c.pharmacy.contractEffectiveThrough?.toISOString() ?? null,
      contractStatus: c.pharmacy.contractStatus,
    }));

    rows.push({
      medicationId: med.id, medicationName: med.name, medicationForm: med.form,
      bestCost, bestCostPharmacy, costMin, costMax,
      programPrice, programPricingId,
      margin, marginPct, status, pharmacyCosts,
    });
  }

  const order: Record<MedPricingStatus, number> = { missing_price: 0, needs_renewal: 1, low_margin: 2, healthy: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.medicationName.localeCompare(b.medicationName));
  return rows;
}

export async function updateProgramPricing(medicationId: string, opts: {
  price: number;
  effectiveFrom: string;
  effectiveThrough?: string;
  notes?: string;
}) {
  // Supersede existing active pricing
  await prisma.programPricing.updateMany({
    where: { medicationId, status: "active" },
    data: { status: "superseded", supersededAt: new Date() },
  });
  // Create new version
  const entry = await prisma.programPricing.create({
    data: {
      medicationId,
      price: opts.price,
      effectiveFrom: new Date(opts.effectiveFrom),
      effectiveThrough: opts.effectiveThrough ? new Date(opts.effectiveThrough) : undefined,
      status: "active",
      notes: opts.notes?.trim() || undefined,
    },
  });
  // Also update legacy sellPrice for backward compatibility
  await prisma.medication.update({ where: { id: medicationId }, data: { sellPrice: opts.price } });
  return entry;
}

// =============================================
// PROGRAMS
// =============================================

export async function getPrograms(opts?: { search?: string; brandId?: string; pharmacyId?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.brandId) where.brandId = opts.brandId;
  if (opts?.pharmacyId) where.pharmacyId = opts.pharmacyId;
  if (opts?.status && opts.status !== "all") where.status = opts.status;

  const programs = await prisma.program.findMany({
    where,
    include: { brand: true, pharmacy: true, medication: true },
    orderBy: { createdAt: "desc" },
  });

  if (opts?.search) {
    const words = opts.search.toLowerCase().split(/\s+/);
    return programs.filter((p) => {
      const hay = `${p.brand.name} ${p.pharmacy.name} ${p.medication.name} ${p.referenceCode}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return programs;
}

export async function getProgram(id: string) {
  return prisma.program.findUnique({
    where: { id },
    include: { brand: true, pharmacy: true, medication: true },
  });
}

export async function createProgram(data: {
  brandId: string; pharmacyId: string; medicationId: string;
  negotiatedRate: number; effectiveStart: string; effectiveEnd?: string;
  referenceCode: string; notes?: string;
}) {
  return prisma.program.create({
    data: {
      brandId: data.brandId, pharmacyId: data.pharmacyId, medicationId: data.medicationId,
      negotiatedRate: data.negotiatedRate,
      effectiveStart: new Date(data.effectiveStart),
      effectiveEnd: data.effectiveEnd ? new Date(data.effectiveEnd) : undefined,
      referenceCode: data.referenceCode,
      notes: data.notes?.trim() || undefined,
    },
  });
}

export async function updateProgram(id: string, data: {
  negotiatedRate?: number; effectiveEnd?: string; status?: string; notes?: string;
}) {
  const update: Record<string, unknown> = {};
  if (data.negotiatedRate != null) update.negotiatedRate = data.negotiatedRate;
  if (data.effectiveEnd !== undefined) update.effectiveEnd = data.effectiveEnd ? new Date(data.effectiveEnd) : null;
  if (data.status) update.status = data.status;
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  return prisma.program.update({ where: { id }, data: update });
}

// =============================================
// REFERENCE CODES
// =============================================

export async function getReferenceCodes(search?: string) {
  const programs = await prisma.program.findMany({
    include: { brand: true, pharmacy: true, medication: true },
    orderBy: { referenceCode: "asc" },
  });
  if (!search) return programs;
  const words = search.toLowerCase().split(/\s+/);
  return programs.filter((p) => {
    const hay = `${p.referenceCode} ${p.brand.name} ${p.pharmacy.name} ${p.medication.name}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// =============================================
// RECONCILIATION (Fill Records)
// =============================================

export async function getFillRecords(opts?: { status?: string; search?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.status && opts.status !== "all") where.status = opts.status;

  const records = await prisma.fillRecord.findMany({
    where,
    include: { brand: true, pharmacy: true, medication: true },
    orderBy: { fillDate: "desc" },
  });

  if (opts?.search) {
    const words = opts.search.toLowerCase().split(/\s+/);
    return records.filter((r) => {
      const hay = `${r.referenceCode} ${r.brand.name} ${r.pharmacy.name} ${r.medication.name}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return records;
}

export async function getReconciliationSummary() {
  const [total, matches, mismatches, missing] = await Promise.all([
    prisma.fillRecord.count(),
    prisma.fillRecord.count({ where: { status: "match" } }),
    prisma.fillRecord.count({ where: { status: "mismatch" } }),
    prisma.fillRecord.count({ where: { status: "missing" } }),
  ]);

  const allRecords = await prisma.fillRecord.findMany({ select: { variance: true } });
  const totalVariance = allRecords.reduce((sum, r) => sum + Math.abs(r.variance), 0);

  return { total, matches, mismatches, missing, totalVariance };
}

export async function resolveFillRecord(id: string) {
  return prisma.fillRecord.update({
    where: { id },
    data: { status: "match", resolvedAt: new Date(), variance: 0 },
  });
}

// =============================================
// MED SPAS
// =============================================

export async function getMedSpas() {
  const spas = await prisma.medSpa.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { orders: true, pricingLines: true } } },
  });
  return spas.map((s) => ({ ...s, orderCount: s._count.orders, pricingLineCount: s._count.pricingLines }));
}

export async function createMedSpa(data: {
  name: string; city?: string; state?: string; contactName?: string;
  email?: string; phone?: string; pipelineStage?: string; currentVendor?: string;
  estMonthlyVolume?: string; nextStep?: string;
}) {
  return prisma.medSpa.create({ data });
}

export async function updateMedSpa(id: string, data: Record<string, unknown>) {
  return prisma.medSpa.update({ where: { id }, data });
}

export async function updateMedSpaField(id: string, field: string, value: string | null) {
  const allowed = ["pipelineStage", "currentVendor", "estMonthlyVolume", "nextStep", "contactName", "lastContactedAt"];
  if (!allowed.includes(field)) throw new Error("Invalid field");
  const parsed = field === "lastContactedAt" && value ? new Date(value) : value;
  return prisma.medSpa.update({ where: { id }, data: { [field]: parsed } });
}

// Pricing lines
export async function getMedSpaPricingLines(medSpaId: string) {
  return prisma.medSpaPricingLine.findMany({
    where: { medSpaId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMedSpaPricingLine(data: {
  medSpaId: string; medicationName: string; currentCost: number; unit: string;
  monthlyQty: number; currentVendor?: string; pricingSource?: string;
  confirmedAt?: string; notes?: string;
}) {
  return prisma.medSpaPricingLine.create({
    data: {
      medSpaId: data.medSpaId, medicationName: data.medicationName,
      currentCost: data.currentCost, unit: data.unit, monthlyQty: data.monthlyQty,
      currentVendor: data.currentVendor || undefined, pricingSource: data.pricingSource || undefined,
      confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : undefined,
      notes: data.notes || undefined,
    },
  });
}

export async function updateMedSpaPricingLine(id: string, data: {
  medicationName?: string; currentCost?: number; unit?: string; monthlyQty?: number;
  currentVendor?: string; pricingSource?: string; notes?: string;
}) {
  const update: Record<string, unknown> = {};
  if (data.medicationName !== undefined) update.medicationName = data.medicationName;
  if (data.currentCost !== undefined) update.currentCost = data.currentCost;
  if (data.unit !== undefined) update.unit = data.unit;
  if (data.monthlyQty !== undefined) update.monthlyQty = data.monthlyQty;
  if (data.currentVendor !== undefined) update.currentVendor = data.currentVendor || null;
  if (data.pricingSource !== undefined) update.pricingSource = data.pricingSource || null;
  if (data.notes !== undefined) update.notes = data.notes || null;
  return prisma.medSpaPricingLine.update({ where: { id }, data: update });
}

export async function deleteMedSpaPricingLine(id: string) {
  return prisma.medSpaPricingLine.delete({ where: { id } });
}

// Notes
export async function getMedSpaNotes(medSpaId: string) {
  return prisma.medSpaNote.findMany({
    where: { medSpaId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMedSpaNote(data: { medSpaId: string; note: string; type?: string }) {
  return prisma.medSpaNote.create({
    data: { medSpaId: data.medSpaId, note: data.note, type: data.type || "note" },
  });
}

// Negotiated pricing lookup for all med spas (for global order entry)
export async function getAllMedSpaPricingLookup() {
  const [medSpas, pricingLines, allMeds, rxPrices, recentOrders] = await Promise.all([
    prisma.medSpa.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.medSpaPricingLine.findMany({ orderBy: { medSpaId: "asc" } }),
    prisma.medication.findMany({ select: { id: true, name: true } }),
    prisma.medicationPriceEntry.findMany({ where: { endDate: null }, include: { pharmacy: true }, orderBy: { price: "asc" } }),
    prisma.medSpaFulfilledOrder.findMany({
      select: { medSpaId: true, medicationName: true, medSpaPaid: true, quantity: true, orderDate: true },
      orderBy: { orderDate: "desc" },
    }),
  ]);

  // Most recent per-unit client price per med spa + medication (from fulfilled orders)
  const lastTreatmentPrice = new Map<string, number>();
  for (const o of recentOrders) {
    const key = `${o.medSpaId}:${o.medicationName.toLowerCase()}`;
    if (!lastTreatmentPrice.has(key) && o.quantity > 0) {
      lastTreatmentPrice.set(key, Math.round((o.medSpaPaid / o.quantity) * 100) / 100);
    }
  }

  // Best prices per medication
  const pricesByMed = new Map<string, { pharmacyName: string; price: number }[]>();
  for (const entry of rxPrices) {
    if (!pricesByMed.has(entry.medicationId)) pricesByMed.set(entry.medicationId, []);
    pricesByMed.get(entry.medicationId)!.push({ pharmacyName: entry.pharmacy.name, price: entry.price });
  }

  // Per med spa: medications from their pricing lines matched to bisk catalog
  const lookup: Record<string, {
    medications: { name: string; unit: string; medSpaPrice: number; previousClientUnitPrice: number | null; pharmacies: { name: string; cost: number }[] }[];
  }> = {};

  for (const spa of medSpas) {
    const lines = pricingLines.filter((l) => l.medSpaId === spa.id);
    const meds = lines.map((line) => {
      const matched = allMeds.find((m) => m.name.toLowerCase() === line.medicationName.toLowerCase())
        ?? allMeds.find((m) => m.name.toLowerCase().includes(line.medicationName.toLowerCase()) || line.medicationName.toLowerCase().includes(m.name.toLowerCase()));
      const pharmacies = matched ? (pricesByMed.get(matched.id) ?? []).map((p) => ({ name: p.pharmacyName, cost: p.price })) : [];
      // Previous client price: pricing worksheet first, then most recent treatment
      const worksheetPrice = line.currentCost > 0 ? line.currentCost : null;
      const treatmentKey = `${spa.id}:${line.medicationName.toLowerCase()}`;
      const treatmentPrice = lastTreatmentPrice.get(treatmentKey) ?? null;
      const previousClientUnitPrice = worksheetPrice ?? treatmentPrice;
      return { name: line.medicationName, unit: line.unit, medSpaPrice: line.currentCost, previousClientUnitPrice, pharmacies };
    }).filter((m) => m.pharmacies.length > 0);
    lookup[spa.id] = { medications: meds };
  }

  const strategy = await getPricingStrategy();
  return { medSpas, lookup, pricingStrategy: strategy };
}

// Payouts — pharmacy payment validation from fulfilled orders
export async function getPayoutRecords(opts?: { status?: string; search?: string; period?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.period === "month") {
    const now = new Date();
    where.orderDate = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  const [orders, allPrices] = await Promise.all([
    prisma.medSpaFulfilledOrder.findMany({
      where,
      include: { medSpa: { select: { id: true, name: true } } },
      orderBy: { orderDate: "desc" },
    }),
    prisma.medicationPriceEntry.findMany({
      where: { endDate: null },
      include: { medication: true, pharmacy: true },
    }),
  ]);

  // Build expected cost lookup: medication name + pharmacy name → lowest price
  const expectedMap = new Map<string, number>();
  for (const p of allPrices) {
    const key = `${p.medication.name.toLowerCase()}:${p.pharmacy.name.toLowerCase()}`;
    const existing = expectedMap.get(key);
    if (!existing || p.price < existing) expectedMap.set(key, p.price);
  }

  const records = orders.map((o) => {
    const key = `${o.medicationName.toLowerCase()}:${o.pharmacyName.toLowerCase()}`;
    const expectedCost = expectedMap.get(key) ?? null;
    const billedCost = o.pharmacyCost;
    const difference = expectedCost != null ? billedCost - expectedCost : null;
    let status: "match" | "overcharged" | "undercharged" | "no_rate" = "no_rate";
    if (difference != null) {
      if (Math.abs(difference) < 0.01) status = "match";
      else if (difference > 0) status = "overcharged";
      else status = "undercharged";
    }
    return {
      id: o.id, orderDate: o.orderDate.toISOString(),
      medSpaId: o.medSpa.id, medSpaName: o.medSpa.name,
      medicationName: o.medicationName, pharmacyName: o.pharmacyName,
      quantity: o.quantity, expectedCost, billedCost, difference, status,
    };
  });

  // Apply search filter
  const filtered = opts?.search
    ? records.filter((r) => {
        const hay = `${r.medSpaName} ${r.medicationName} ${r.pharmacyName}`.toLowerCase();
        return opts.search!.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
      })
    : records;

  // Apply status filter
  if (opts?.status && opts.status !== "all") {
    return filtered.filter((r) => r.status === opts.status);
  }
  return filtered;
}

export async function getPayoutSummary(period?: string) {
  const records = await getPayoutRecords({ period });
  const total = records.length;
  const clean = records.filter((r) => r.status === "match").length;
  const needsReview = records.filter((r) => r.status !== "match").length;
  const totalDifference = records.reduce((s, r) => s + Math.abs(r.difference ?? 0), 0);
  return { total, clean, needsReview, totalDifference };
}

// Order Ledger — cross-account fulfilled orders
// =============================================
// UNIFIED LEDGER (Orders + Reconciliation)
// =============================================

const BISK_FEE_PER_SCRIPT = 5.00;

export type LedgerStatus = "match" | "needs_review" | "issue";

export async function getLedgerData(opts?: {
  medSpaId?: string;
  pharmacyName?: string;
  period?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (opts?.medSpaId) where.medSpaId = opts.medSpaId;
  if (opts?.pharmacyName) where.pharmacyName = opts.pharmacyName;
  if (opts?.period === "month") {
    const now = new Date();
    where.orderDate = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  const orders = await prisma.medSpaFulfilledOrder.findMany({
    where,
    include: { medSpa: { select: { id: true, name: true } } },
    orderBy: { orderDate: "desc" },
  });

  // For orders without contractPriceAtTime, try to resolve from current contracts as fallback.
  // This handles legacy orders created before contractPriceAtTime was introduced.
  const needsFallback = orders.filter((o) => o.contractPriceAtTime == null);
  let fallbackMap = new Map<string, number>();
  if (needsFallback.length > 0) {
    const allPrices = await prisma.medicationPriceEntry.findMany({
      where: { endDate: null },
      include: { medication: true, pharmacy: true },
    });
    for (const p of allPrices) {
      const key = `${p.medication.name.toLowerCase()}:${p.pharmacy.name.toLowerCase()}`;
      const existing = fallbackMap.get(key);
      if (!existing || p.price < existing) fallbackMap.set(key, p.price);
    }
  }

  // Derive display order numbers without writing to DB.
  // Format: ORD-YYYYMM-### based on position within that month's orders.
  const orderNumberMap = new Map<string, string>();
  const monthCounters = new Map<string, number>();
  // Sort by date ascending to assign sequential numbers
  const sorted = [...orders].sort((a, b) => a.orderDate.getTime() - b.orderDate.getTime());
  for (const o of sorted) {
    if (o.orderNumber) {
      orderNumberMap.set(o.id, o.orderNumber);
    } else {
      const d = o.orderDate;
      const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = (monthCounters.get(ym) ?? 0) + 1;
      monthCounters.set(ym, count);
      orderNumberMap.set(o.id, `ORD-${ym}-${String(count).padStart(3, "0")}`);
    }
  }

  const rows = orders.map((o) => {
    // Use contractPriceAtTime (persisted at order creation) as the expected cost.
    // Fall back to current contract pricing only for legacy orders.
    const key = `${o.medicationName.toLowerCase()}:${o.pharmacyName.toLowerCase()}`;
    const expectedCost = o.contractPriceAtTime ?? fallbackMap.get(key) ?? null;
    const billedCost = o.pharmacyCost;
    const difference = expectedCost != null ? Math.round((billedCost - expectedCost) * 100) / 100 : null;

    let status: LedgerStatus = "match";
    if (difference == null) status = "needs_review";
    else if (Math.abs(difference) < 0.01) status = "match";
    else if (Math.abs(difference) > billedCost * 0.1) status = "issue";
    else status = "needs_review";

    // Use persisted Bisk fee, fallback to current default for legacy orders
    const biskFee = o.biskFeeAtTime ?? BISK_FEE_PER_SCRIPT;
    const totalCost = Math.round((o.pharmacyCost + biskFee) * 100) / 100;

    return {
      id: o.id,
      orderNumber: orderNumberMap.get(o.id) ?? o.id.slice(0, 8),
      orderDate: o.orderDate.toISOString(),
      medSpaId: o.medSpa.id,
      medSpaName: o.medSpa.name,
      medicationName: o.medicationName,
      quantity: o.quantity,
      pharmacyName: o.pharmacyName,
      pharmacyCost: o.pharmacyCost,
      biskFee,
      totalCost,
      expectedCost,
      billedCost,
      difference,
      status,
    };
  });

  // Status filter
  if (opts?.status && opts.status !== "all") {
    return rows.filter((r) => r.status === opts.status);
  }
  return rows;
}

export async function getLedgerSummaryUnified(period?: string) {
  const rows = await getLedgerData({ period });
  const count = rows.length;
  const cost = Math.round(rows.reduce((s, r) => s + r.pharmacyCost, 0) * 100) / 100;
  const totalBiskFees = Math.round(rows.reduce((s, r) => s + r.biskFee, 0) * 100) / 100;
  const totalCost = Math.round((cost + totalBiskFees) * 100) / 100;
  const matchCount = rows.filter((r) => r.status === "match").length;
  const reviewCount = rows.filter((r) => r.status === "needs_review").length;
  const issueCount = rows.filter((r) => r.status === "issue").length;
  return { count, cost, totalBiskFees, totalCost, matchCount, reviewCount, issueCount };
}

// =============================================
// STATEMENTS
// =============================================

export type StatementStatus = "draft" | "sent" | "paid" | "overdue";

export async function getOrCreateStatement(medSpaId: string, month: string) {
  const existing = await prisma.medSpaStatement.findUnique({
    where: { medSpaId_month: { medSpaId, month } },
  });
  if (existing) {
    // Auto-update overdue status
    if (existing.status === "sent" && existing.dueDate && existing.dueDate.getTime() < Date.now()) {
      await prisma.medSpaStatement.update({ where: { id: existing.id }, data: { status: "overdue" } });
      return { ...existing, status: "overdue" as StatementStatus };
    }
    return existing;
  }
  // Create draft from ledger data
  const rows = await getLedgerData({ medSpaId, period: "all" });
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  const filtered = rows.filter((r) => { const d = new Date(r.orderDate); return d >= start && d < end; });
  const totalScripts = filtered.length;
  const pharmacySpend = Math.round(filtered.reduce((s, r) => s + r.pharmacyCost, 0) * 100) / 100;
  const biskFees = Math.round(totalScripts * BISK_FEE_PER_SCRIPT * 100) / 100;
  return prisma.medSpaStatement.create({
    data: { medSpaId, month, totalScripts, pharmacySpend, biskFees, totalCost: Math.round((pharmacySpend + biskFees) * 100) / 100 },
  });
}

export async function sendStatement(statementId: string) {
  const now = new Date();
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return prisma.medSpaStatement.update({
    where: { id: statementId },
    data: { status: "sent", statementDate: now, dueDate },
  });
}

export async function markStatementPaid(statementId: string) {
  return prisma.medSpaStatement.update({
    where: { id: statementId },
    data: { status: "paid" },
  });
}

export async function getStatements(opts?: { period?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.period === "month") {
    const now = new Date();
    where.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const statements = await prisma.medSpaStatement.findMany({
    where,
    include: { medSpa: { select: { id: true, name: true } } },
    orderBy: { month: "desc" },
  });
  // Auto-update overdue
  const now = Date.now();
  for (const s of statements) {
    if (s.status === "sent" && s.dueDate && s.dueDate.getTime() < now) {
      await prisma.medSpaStatement.update({ where: { id: s.id }, data: { status: "overdue" } });
      (s as typeof s & { status: string }).status = "overdue";
    }
  }
  return statements.map((s) => ({
    id: s.id, medSpaId: s.medSpa.id, medSpaName: s.medSpa.name,
    month: s.month, status: s.status as StatementStatus,
    statementDate: s.statementDate?.toISOString() ?? null,
    dueDate: s.dueDate?.toISOString() ?? null,
    totalScripts: s.totalScripts, pharmacySpend: s.pharmacySpend,
    biskFees: s.biskFees, totalCost: s.totalCost,
  }));
}

export async function getOverdueStatementsSummary() {
  const statements = await prisma.medSpaStatement.findMany({
    where: { status: "overdue" },
  });
  // Also check sent + past due
  const sentPastDue = await prisma.medSpaStatement.findMany({
    where: { status: "sent", dueDate: { lt: new Date() } },
  });
  const all = [...statements, ...sentPastDue];
  return { count: all.length, totalAmount: all.reduce((s, st) => s + st.totalCost, 0) };
}

export async function getMonthlyStatementData(medSpaId: string, month: string) {
  // month format: "YYYY-MM"
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);

  const rows = await getLedgerData({ medSpaId, period: "all" });
  const filtered = rows.filter((r) => {
    const d = new Date(r.orderDate);
    return d >= start && d < end;
  });

  const totalScripts = filtered.length;
  const pharmacySpend = filtered.reduce((s, r) => s + r.pharmacyCost, 0);
  const biskFees = totalScripts * BISK_FEE_PER_SCRIPT;
  const totalCost = Math.round((pharmacySpend + biskFees) * 100) / 100;
  const medSpaName = filtered.length > 0 ? filtered[0].medSpaName : "";

  return {
    medSpaId,
    medSpaName,
    month,
    totalScripts,
    pharmacySpend,
    biskFees,
    totalCost,
    lineItems: filtered.map((r) => ({
      orderNumber: r.orderNumber,
      date: r.orderDate,
      medication: r.medicationName,
      quantity: r.quantity,
      pharmacy: r.pharmacyName,
      pharmacyCost: r.pharmacyCost,
      biskFee: r.biskFee,
      totalCost: Math.round((r.pharmacyCost + r.biskFee) * 100) / 100,
    })),
  };
}

export async function getAllFulfilledOrders(opts?: { medSpaId?: string; pharmacyName?: string; period?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.medSpaId) where.medSpaId = opts.medSpaId;
  if (opts?.pharmacyName) where.pharmacyName = opts.pharmacyName;

  if (opts?.period === "month") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    where.orderDate = { gte: start };
  }

  const orders = await prisma.medSpaFulfilledOrder.findMany({
    where,
    include: { medSpa: { select: { id: true, name: true } } },
    orderBy: { orderDate: "desc" },
  });

  return orders.map((o) => ({
    id: o.id, orderDate: o.orderDate.toISOString(),
    medSpaId: o.medSpa.id, medSpaName: o.medSpa.name,
    medicationName: o.medicationName, quantity: o.quantity, pharmacyName: o.pharmacyName,
    medSpaPaid: o.medSpaPaid, pharmacyCost: o.pharmacyCost,
    grossProfit: o.medSpaPaid - o.pharmacyCost,
  }));
}

export async function getLedgerSummary(period?: string) {
  const where: Record<string, unknown> = {};
  if (period === "month") {
    const now = new Date();
    where.orderDate = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  const orders = await prisma.medSpaFulfilledOrder.findMany({ where });
  const count = orders.length;
  const revenue = orders.reduce((s, o) => s + o.medSpaPaid, 0);
  const cost = orders.reduce((s, o) => s + o.pharmacyCost, 0);
  return { count, revenue, cost, grossProfit: revenue - cost };
}

export async function getLedgerFilterOptions() {
  const [medSpas, pharmacyNames] = await Promise.all([
    prisma.medSpa.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.medSpaFulfilledOrder.findMany({ select: { pharmacyName: true }, distinct: ["pharmacyName"], orderBy: { pharmacyName: "asc" } }),
  ]);
  return { medSpas, pharmacies: pharmacyNames.map((p) => p.pharmacyName) };
}

// =============================================
// MED SPA PRICING AGREEMENTS
// =============================================

export type AgreementStatus = "draft" | "active" | "superseded" | "expired";

export interface AgreementLine {
  medicationId: string;
  medicationName: string;
  agreedPrice: number;
  pharmacyId?: string;
  pharmacyName?: string;
  estimatedMonthlyQty?: number;
}

export async function getActiveAgreement(medSpaId: string) {
  return prisma.medSpaPricingAgreement.findFirst({
    where: { medSpaId, status: "active" },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAgreementHistory(medSpaId: string) {
  return prisma.medSpaPricingAgreement.findMany({
    where: { medSpaId },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function activateAgreement(medSpaId: string, opts: {
  effectiveFrom: string;
  effectiveThrough: string;
  lines: AgreementLine[];
  notes?: string;
}) {
  // Supersede any existing active agreement
  await prisma.medSpaPricingAgreement.updateMany({
    where: { medSpaId, status: "active" },
    data: { status: "superseded", supersededAt: new Date() },
  });

  // Create new agreement
  const agreement = await prisma.medSpaPricingAgreement.create({
    data: {
      medSpaId,
      status: "active",
      effectiveFrom: new Date(opts.effectiveFrom),
      effectiveThrough: new Date(opts.effectiveThrough),
      notes: opts.notes?.trim() || undefined,
      lines: {
        create: opts.lines.map((l) => ({
          medicationId: l.medicationId,
          medicationName: l.medicationName,
          agreedPrice: l.agreedPrice,
          pharmacyId: l.pharmacyId || undefined,
          pharmacyName: l.pharmacyName || undefined,
          estimatedMonthlyQty: l.estimatedMonthlyQty || undefined,
        })),
      },
    },
    include: { lines: true },
  });

  return agreement;
}

export async function renewAgreement(medSpaId: string, opts: {
  effectiveFrom: string;
  effectiveThrough: string;
  lines: AgreementLine[];
  notes?: string;
}) {
  // Same as activate — creates new version, supersedes old
  return activateAgreement(medSpaId, opts);
}

// Get agreed price for a specific medication from active agreement
export async function getAgreedPrice(medSpaId: string, medicationName: string): Promise<number | null> {
  const agreement = await getActiveAgreement(medSpaId);
  if (!agreement) return null;
  const line = agreement.lines.find((l) => l.medicationName.toLowerCase() === medicationName.toLowerCase());
  return line?.agreedPrice ?? null;
}

// =============================================
// PROPOSALS
// =============================================

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted";

export async function sendProposal(medSpaId: string, opts: {
  recipientEmail: string;
  message?: string;
  monthlySavings: number;
  monthlyProfit: number;
  pricingSnapshot: string; // JSON
}) {
  return prisma.medSpaProposal.create({
    data: {
      medSpaId,
      status: "sent",
      recipientEmail: opts.recipientEmail,
      message: opts.message?.trim() || undefined,
      sentAt: new Date(),
      monthlySavings: opts.monthlySavings,
      monthlyProfit: opts.monthlyProfit,
      pricingSnapshot: opts.pricingSnapshot,
    },
  });
}

export async function markProposalViewed(proposalId: string) {
  const proposal = await prisma.medSpaProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.viewedAt) return proposal;
  return prisma.medSpaProposal.update({
    where: { id: proposalId },
    data: { viewedAt: new Date(), status: proposal.status === "sent" ? "viewed" : proposal.status },
  });
}

export async function acceptProposal(proposalId: string) {
  return prisma.medSpaProposal.update({
    where: { id: proposalId },
    data: { acceptedAt: new Date(), status: "accepted" },
  });
}

export async function getLatestProposal(medSpaId: string) {
  return prisma.medSpaProposal.findFirst({
    where: { medSpaId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProposalById(proposalId: string) {
  return prisma.medSpaProposal.findUnique({
    where: { id: proposalId },
    include: { medSpa: { select: { id: true, name: true, city: true, state: true, contactName: true } } },
  });
}

// Fulfilled orders
export async function createFulfilledOrder(data: {
  medSpaId: string; orderDate: string; medicationName: string; quantity: number;
  pharmacyName: string; medSpaPaid: number; pharmacyCost: number; notes?: string;
}) {
  // Look up contract price at order time: find the active contract price for this
  // medication + pharmacy combination as of the order date.
  const orderDate = new Date(data.orderDate);
  const contractEntry = await prisma.medicationPriceEntry.findFirst({
    where: {
      pharmacy: { name: data.pharmacyName },
      medication: { name: data.medicationName },
      effectiveDate: { lte: orderDate },
      OR: [
        { endDate: null },
        { endDate: { gte: orderDate } },
      ],
    },
    orderBy: { effectiveDate: "desc" },
  });

  return prisma.medSpaFulfilledOrder.create({
    data: {
      medSpaId: data.medSpaId, orderDate,
      medicationName: data.medicationName, quantity: data.quantity,
      pharmacyName: data.pharmacyName, medSpaPaid: data.medSpaPaid,
      pharmacyCost: data.pharmacyCost,
      contractPriceAtTime: contractEntry?.price ?? null,
      biskFeeAtTime: BISK_FEE_PER_SCRIPT,
      notes: data.notes?.trim() || undefined,
    },
  });
}

export async function getMedSpaDetail(id: string) {
  const spa = await prisma.medSpa.findUnique({ where: { id } });
  if (!spa) return null;

  const [pricingLines, notes, orders, fulfilledOrders] = await Promise.all([
    prisma.medSpaPricingLine.findMany({ where: { medSpaId: id }, orderBy: { createdAt: "desc" } }),
    prisma.medSpaNote.findMany({ where: { medSpaId: id }, orderBy: { createdAt: "desc" } }),
    prisma.medSpaOrder.findMany({
      where: { medSpaId: id },
      include: { medication: true, pharmacy: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.medSpaFulfilledOrder.findMany({ where: { medSpaId: id }, orderBy: { orderDate: "desc" } }),
  ]);

  // Pricing comparison — derived from user-entered pricing lines + Bisk network prices
  // Match pricing lines to medications by name (fuzzy: case-insensitive contains)
  const [allMeds, programPriceMap] = await Promise.all([
    prisma.medication.findMany({ select: { id: true, name: true, form: true } }),
    getAllActiveProgramPrices(),
  ]);
  const rxBridgePrices = await prisma.medicationPriceEntry.findMany({
    where: { endDate: null },
    include: { pharmacy: true },
    orderBy: { price: "asc" },
  });

  // Build all available prices per medication (sorted cheapest first)
  const allPricesMap = new Map<string, { pharmacyId: string; pharmacyName: string; price: number }[]>();
  for (const entry of rxBridgePrices) {
    if (!allPricesMap.has(entry.medicationId)) allPricesMap.set(entry.medicationId, []);
    allPricesMap.get(entry.medicationId)!.push({
      pharmacyId: entry.pharmacyId, pharmacyName: entry.pharmacy.name, price: entry.price,
    });
  }

  const pricingComparison = pricingLines.map((line) => {
    const matchedMed = allMeds.find((m) => m.name.toLowerCase() === line.medicationName.toLowerCase())
      ?? allMeds.find((m) => m.name.toLowerCase().includes(line.medicationName.toLowerCase()) || line.medicationName.toLowerCase().includes(m.name.toLowerCase()));

    const pharmacyOptions = matchedMed ? (allPricesMap.get(matchedMed.id) ?? []) : [];
    const lowest = pharmacyOptions.length > 0 ? pharmacyOptions[0] : null;

    return {
      lineId: line.id, medicationName: line.medicationName, unit: line.unit,
      medicationId: matchedMed?.id ?? null,
      currentCost: line.currentCost, monthlyQty: line.monthlyQty,
      programPrice: matchedMed ? (programPriceMap.get(matchedMed.id) ?? null) : null,
      pharmacyOptions,
      lowestPharmacy: lowest ? { name: lowest.pharmacyName, price: lowest.price } : null,
    };
  });

  const monthlySpend = pricingLines.reduce((sum, l) => sum + l.currentCost * l.monthlyQty, 0);

  return {
    ...spa,
    pricingLines: pricingLines.map((l) => ({
      ...l,
      confirmedAt: l.confirmedAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    notes: notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    orders: orders.map((o) => ({
      id: o.id, date: o.createdAt, medicationName: o.medication.name,
      quantity: o.quantity, pharmacyName: o.pharmacy.name, unitCost: o.unitCost,
      totalCost: o.unitCost * o.quantity,
    })),
    pricingComparison,
    monthlySpend,
    uniqueMedications: pricingLines.length,
    fulfilledOrders: fulfilledOrders.map((o) => ({
      id: o.id, orderDate: o.orderDate.toISOString(), medicationName: o.medicationName,
      quantity: o.quantity, pharmacyName: o.pharmacyName,
      medSpaPaid: o.medSpaPaid, pharmacyCost: o.pharmacyCost,
      grossProfit: o.medSpaPaid - o.pharmacyCost, notes: o.notes,
    })),
    // Catalog options for fulfilled order entry
    catalogMedications: [...new Set(allMeds.map((m) => m.name))].sort(),
    catalogPharmacies: [...new Set(rxBridgePrices.map((p) => p.pharmacy.name))].sort(),
    pricingStrategy: await getPricingStrategy(),
    // Active pricing agreement
    activeAgreement: await (async () => {
      const agr = await getActiveAgreement(id);
      if (!agr) return null;
      return {
        id: agr.id,
        status: agr.status,
        effectiveFrom: agr.effectiveFrom.toISOString(),
        effectiveThrough: agr.effectiveThrough.toISOString(),
        notes: agr.notes,
        createdAt: agr.createdAt.toISOString(),
        lines: agr.lines.map((l) => ({
          id: l.id,
          medicationId: l.medicationId,
          medicationName: l.medicationName,
          agreedPrice: l.agreedPrice,
          pharmacyId: l.pharmacyId,
          pharmacyName: l.pharmacyName,
          estimatedMonthlyQty: l.estimatedMonthlyQty,
        })),
      };
    })(),
    // Agreement history
    agreementHistory: await (async () => {
      const history = await getAgreementHistory(id);
      return history.map((a) => ({
        id: a.id,
        status: a.status,
        effectiveFrom: a.effectiveFrom.toISOString(),
        effectiveThrough: a.effectiveThrough.toISOString(),
        notes: a.notes,
        createdAt: a.createdAt.toISOString(),
        lineCount: a.lines.length,
      }));
    })(),
    // Latest proposal
    latestProposal: await (async () => {
      const p = await getLatestProposal(id);
      if (!p) return null;
      return {
        id: p.id, status: p.status as ProposalStatus,
        recipientEmail: p.recipientEmail,
        sentAt: p.sentAt?.toISOString() ?? null,
        viewedAt: p.viewedAt?.toISOString() ?? null,
        acceptedAt: p.acceptedAt?.toISOString() ?? null,
        monthlySavings: p.monthlySavings,
        monthlyProfit: p.monthlyProfit,
      };
    })(),
  };
}
