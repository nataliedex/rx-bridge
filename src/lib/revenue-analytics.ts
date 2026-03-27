// Revenue analytics — unifies completed orders and filled refills into a single transaction dataset.
// Includes data quality assessment for trust and auditability.

// --- Quality metadata ---

export type ConfidenceLevel = "high" | "medium" | "low";

export interface DataQuality {
  missingCost: boolean;
  missingRevenue: boolean;
  estimatedPricing: boolean;   // order uses catalog lookup instead of actual fill data
  approximateDate: boolean;    // order uses createdAt instead of true completedAt
  confidence: ConfidenceLevel;
  flags: string[];             // human-readable flag labels for display
}

export interface DataQualitySummary {
  totalTransactions: number;
  cleanTransactions: number;
  missingCostCount: number;
  missingRevenueCount: number;
  estimatedPricingCount: number;
  approximateDateCount: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
}

// --- Transaction ---

export interface Transaction {
  type: "order" | "refill";
  id: string;
  medicationId: string | null;
  medicationName: string;
  quantity: number;
  patientName: string;
  pharmacyId: string;
  pharmacyName: string;
  brandId: string | null;
  brandName: string | null;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
  completedAt: Date;
  quality: DataQuality;
}

// --- Quality assessment ---

export function assessQuality(t: {
  type: "order" | "refill";
  revenueCents: number;
  costCents: number;
  sellPriceSource: "catalog" | "actual" | "missing";
  costSource: "catalog" | "actual" | "missing";
  dateSource: "actual" | "approximate";
}): DataQuality {
  const missingCost = t.costSource === "missing";
  const missingRevenue = t.sellPriceSource === "missing";
  const estimatedPricing = t.type === "order" && (t.sellPriceSource === "catalog" || t.costSource === "catalog");
  const approximateDate = t.dateSource === "approximate";

  const flags: string[] = [];
  if (missingCost) flags.push("No pharmacy cost set");
  if (missingRevenue) flags.push("No sell price set");
  if (estimatedPricing) flags.push("Using fallback pricing");
  if (approximateDate) flags.push("Using estimated date");

  let confidence: ConfidenceLevel = "high";
  if (missingCost || missingRevenue) confidence = "low";
  else if (estimatedPricing || approximateDate) confidence = "medium";

  return { missingCost, missingRevenue, estimatedPricing, approximateDate, confidence, flags };
}

export function computeQualitySummary(transactions: Transaction[]): DataQualitySummary {
  let missingCostCount = 0;
  let missingRevenueCount = 0;
  let estimatedPricingCount = 0;
  let approximateDateCount = 0;
  let highConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let lowConfidenceCount = 0;

  for (const t of transactions) {
    if (t.quality.missingCost) missingCostCount++;
    if (t.quality.missingRevenue) missingRevenueCount++;
    if (t.quality.estimatedPricing) estimatedPricingCount++;
    if (t.quality.approximateDate) approximateDateCount++;
    if (t.quality.confidence === "high") highConfidenceCount++;
    else if (t.quality.confidence === "medium") mediumConfidenceCount++;
    else lowConfidenceCount++;
  }

  const cleanTransactions = transactions.filter((t) => t.quality.flags.length === 0).length;

  return {
    totalTransactions: transactions.length,
    cleanTransactions,
    missingCostCount,
    missingRevenueCount,
    estimatedPricingCount,
    approximateDateCount,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
  };
}

// --- Revenue summary ---

export interface RevenueSummary {
  totalRevenueCents: number;
  totalCostCents: number;
  totalProfitCents: number;
  avgMarginPct: number | null;
  orderCount: number;
  refillCount: number;
  transactionCount: number;
}

export interface GroupedRevenue {
  key: string;
  label: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  count: number;
}

export function computeSummary(transactions: Transaction[]): RevenueSummary {
  let totalRevenueCents = 0;
  let totalCostCents = 0;
  let orderCount = 0;
  let refillCount = 0;
  const margins: number[] = [];

  for (const t of transactions) {
    totalRevenueCents += t.revenueCents;
    totalCostCents += t.costCents;
    if (t.type === "order") orderCount++;
    else refillCount++;
    if (t.marginPct != null) margins.push(t.marginPct);
  }

  return {
    totalRevenueCents,
    totalCostCents,
    totalProfitCents: totalRevenueCents - totalCostCents,
    avgMarginPct: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    orderCount,
    refillCount,
    transactionCount: transactions.length,
  };
}

export function groupBy(transactions: Transaction[], field: "brand" | "pharmacy"): GroupedRevenue[] {
  const map = new Map<string, { label: string; revenueCents: number; costCents: number; count: number }>();

  for (const t of transactions) {
    const key = field === "brand" ? (t.brandId ?? "none") : t.pharmacyId;
    const label = field === "brand" ? (t.brandName ?? "No brand") : t.pharmacyName;

    const existing = map.get(key);
    if (existing) {
      existing.revenueCents += t.revenueCents;
      existing.costCents += t.costCents;
      existing.count++;
    } else {
      map.set(key, { label, revenueCents: t.revenueCents, costCents: t.costCents, count: 1 });
    }
  }

  return Array.from(map.entries())
    .map(([key, d]) => ({
      key,
      label: d.label,
      revenueCents: d.revenueCents,
      costCents: d.costCents,
      profitCents: d.revenueCents - d.costCents,
      count: d.count,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
}
