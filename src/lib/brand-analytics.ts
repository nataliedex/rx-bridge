// Brand analytics transformation layer.
// Pure functions that take raw order data and return chart-ready datasets.
// All money values stored as cents internally for precision.

// --- Input types (matches data from getBrandDetail) ---

export interface RawBrandOrder {
  medicationName: string;
  quantity: number | null;
  pharmacyId: string;
  pharmacyName: string;
  sellPrice: number | null;     // dollars, from medication catalog
  pharmacyCost: number | null;  // dollars, lowest active pharmacy cost
  createdAt: string;            // ISO date string
}

// --- Output types ---

export interface MedicationSummary {
  medication: string;
  orders: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
}

export interface ParetoPoint {
  medication: string;
  profitCents: number;
  cumulativeProfitPct: number;
}

export interface RevenueProfitMix {
  medication: string;
  revenueCents: number;
  profitCents: number;
}

export interface TrendPoint {
  period: string;
  orders: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
}

export type Quadrant = "scale" | "optimize" | "promote" | "deprioritize";

export interface OpportunityPoint {
  medication: string;
  orders: number;
  marginPct: number;
  profitCents: number;
  revenueCents: number;
  quadrant: Quadrant;
}

export interface PharmacyMedicationSummary {
  pharmacy: string;
  pharmacyId: string;
  medication: string;
  orders: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number | null;
}

export interface PharmacyComparison {
  pharmacy: string;
  pharmacyId: string;
  orders: number;
  marginPct: number;
  profitCents: number;
}

export interface InsightCard {
  type: "concentration" | "optimization" | "top_driver" | "warning";
  title: string;
  detail: string;
  recommendation: string;
}

export interface PharmacyCostComparison {
  medication: string;
  currentPharmacy: string;
  currentCostCents: number;
  bestPharmacy: string;
  bestCostCents: number;
  savingsCents: number;
  orders: number;
}

export interface BrandAnalytics {
  medicationSummary: MedicationSummary[];
  pareto: ParetoPoint[];
  revenueProfitMix: RevenueProfitMix[];
  trendDaily: TrendPoint[];
  trendMonthly: TrendPoint[];
  opportunityMatrix: OpportunityPoint[];
  pharmacyMedicationSummary: PharmacyMedicationSummary[];
  pharmacyCostComparisons: PharmacyCostComparison[];
  insights: InsightCard[];
}

// --- Helpers ---

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function safeMarginPct(revenueCents: number, costCents: number): number | null {
  if (revenueCents <= 0) return null;
  return (revenueCents - costCents) / revenueCents;
}

function dateKey(isoDate: string, bucket: "day" | "month"): string {
  const d = new Date(isoDate);
  if (bucket === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return d.toISOString().slice(0, 10);
}

// --- A. Medication summary ---

function buildMedicationSummary(orders: RawBrandOrder[]): MedicationSummary[] {
  const map = new Map<string, { orders: number; revenueCents: number; costCents: number }>();

  for (const o of orders) {
    if (!o.medicationName) continue;
    const qty = o.quantity ?? 1;
    const rev = toCents((o.sellPrice ?? 0) * qty);
    const cost = toCents((o.pharmacyCost ?? 0) * qty);

    const existing = map.get(o.medicationName);
    if (existing) {
      existing.orders += 1;
      existing.revenueCents += rev;
      existing.costCents += cost;
    } else {
      map.set(o.medicationName, { orders: 1, revenueCents: rev, costCents: cost });
    }
  }

  const rows: MedicationSummary[] = [];
  for (const [medication, d] of map) {
    rows.push({
      medication,
      orders: d.orders,
      revenueCents: d.revenueCents,
      costCents: d.costCents,
      profitCents: d.revenueCents - d.costCents,
      marginPct: safeMarginPct(d.revenueCents, d.costCents),
    });
  }

  rows.sort((a, b) => b.profitCents - a.profitCents);
  return rows;
}

// --- B. Profit pareto ---

function buildPareto(summary: MedicationSummary[]): ParetoPoint[] {
  const sorted = [...summary].sort((a, b) => b.profitCents - a.profitCents);
  const totalProfit = sorted.reduce((s, r) => s + Math.max(0, r.profitCents), 0);
  let running = 0;

  return sorted.map((r) => {
    running += Math.max(0, r.profitCents);
    return {
      medication: r.medication,
      profitCents: r.profitCents,
      cumulativeProfitPct: totalProfit > 0 ? running / totalProfit : 0,
    };
  });
}

// --- C. Revenue vs profit mix ---

function buildRevenueProfitMix(summary: MedicationSummary[]): RevenueProfitMix[] {
  return [...summary]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .map((r) => ({
      medication: r.medication,
      revenueCents: r.revenueCents,
      profitCents: r.profitCents,
    }));
}

// --- D. Financial trend ---

function buildTrend(orders: RawBrandOrder[], bucket: "day" | "month"): TrendPoint[] {
  const map = new Map<string, { orders: number; revenueCents: number; costCents: number }>();

  for (const o of orders) {
    const key = dateKey(o.createdAt, bucket);
    const qty = o.quantity ?? 1;
    const rev = toCents((o.sellPrice ?? 0) * qty);
    const cost = toCents((o.pharmacyCost ?? 0) * qty);

    const existing = map.get(key);
    if (existing) {
      existing.orders += 1;
      existing.revenueCents += rev;
      existing.costCents += cost;
    } else {
      map.set(key, { orders: 1, revenueCents: rev, costCents: cost });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, d]) => ({
      period,
      orders: d.orders,
      revenueCents: d.revenueCents,
      costCents: d.costCents,
      profitCents: d.revenueCents - d.costCents,
    }));
}

// --- E. Opportunity matrix ---

function buildOpportunityMatrix(summary: MedicationSummary[]): OpportunityPoint[] {
  const valid = summary.filter((r) => r.marginPct != null) as (MedicationSummary & { marginPct: number })[];
  if (valid.length === 0) return [];

  const avgOrders = valid.reduce((s, r) => s + r.orders, 0) / valid.length;
  const avgMargin = valid.reduce((s, r) => s + r.marginPct, 0) / valid.length;

  return valid.map((r) => {
    const highVolume = r.orders >= avgOrders;
    const highMargin = r.marginPct >= avgMargin;
    const quadrant: Quadrant = highVolume && highMargin ? "scale"
      : highVolume && !highMargin ? "optimize"
      : !highVolume && highMargin ? "promote"
      : "deprioritize";

    return {
      medication: r.medication,
      orders: r.orders,
      marginPct: r.marginPct,
      profitCents: r.profitCents,
      revenueCents: r.revenueCents,
      quadrant,
    };
  });
}

// --- F. Pharmacy + medication summary ---

function buildPharmacyMedicationSummary(orders: RawBrandOrder[]): PharmacyMedicationSummary[] {
  const map = new Map<string, { pharmacyId: string; pharmacy: string; medication: string; orders: number; revenueCents: number; costCents: number }>();

  for (const o of orders) {
    if (!o.pharmacyName || !o.medicationName) continue;
    const key = `${o.pharmacyId}:${o.medicationName}`;
    const qty = o.quantity ?? 1;
    const rev = toCents((o.sellPrice ?? 0) * qty);
    const cost = toCents((o.pharmacyCost ?? 0) * qty);

    const existing = map.get(key);
    if (existing) {
      existing.orders += 1;
      existing.revenueCents += rev;
      existing.costCents += cost;
    } else {
      map.set(key, { pharmacyId: o.pharmacyId, pharmacy: o.pharmacyName, medication: o.medicationName, orders: 1, revenueCents: rev, costCents: cost });
    }
  }

  return Array.from(map.values()).map((d) => ({
    ...d,
    profitCents: d.revenueCents - d.costCents,
    marginPct: safeMarginPct(d.revenueCents, d.costCents),
  }));
}

// --- G. Pharmacy margin comparison for a medication ---

export function buildPharmacyComparison(
  pharmMedSummary: PharmacyMedicationSummary[],
  medication: string,
): PharmacyComparison[] {
  return pharmMedSummary
    .filter((r) => r.medication === medication && r.marginPct != null)
    .sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0))
    .map((r) => ({
      pharmacy: r.pharmacy,
      pharmacyId: r.pharmacyId,
      orders: r.orders,
      marginPct: r.marginPct!,
      profitCents: r.profitCents,
    }));
}

// --- H. Top N with "Other" ---

export function topNWithOther<T extends { [K in V]: number }>(
  items: T[],
  valueKey: V,
  n: number,
  otherFactory: (total: number) => T,
): T[] {
  if (items.length <= n) return items;
  const top = items.slice(0, n);
  const rest = items.slice(n);
  const otherTotal = rest.reduce((s, item) => s + item[valueKey], 0);
  return [...top, otherFactory(otherTotal)];
}

// Type parameter for valueKey
type V = string & keyof any;

// --- I. Insight cards ---

function buildInsights(summary: MedicationSummary[]): InsightCard[] {
  const insights: InsightCard[] = [];
  if (summary.length === 0) return insights;

  const totalProfit = summary.reduce((s, r) => s + Math.max(0, r.profitCents), 0);

  // Profit concentration
  if (totalProfit > 0) {
    let running = 0;
    let count = 0;
    const sorted = [...summary].sort((a, b) => b.profitCents - a.profitCents);
    for (const r of sorted) {
      running += Math.max(0, r.profitCents);
      count++;
      if (running >= totalProfit * 0.8) break;
    }
    if (count <= summary.length * 0.5) {
      insights.push({
        type: "concentration",
        title: "Profit concentration risk",
        detail: `${count} of ${summary.length} medications drive 80% of profit.`,
        recommendation: "Diversify volume across more medications to reduce dependency on a few high-performers.",
      });
    }
  }

  // Optimization opportunity
  const validMargin = summary.filter((r) => r.marginPct != null);
  const lowMarginHighVolume = validMargin.filter((r) => r.marginPct! < 0.20 && r.orders >= 2);
  if (lowMarginHighVolume.length > 0) {
    const names = lowMarginHighVolume.slice(0, 3).map((r) => r.medication);
    insights.push({
      type: "optimization",
      title: "Low-margin, high-volume medications",
      detail: `${lowMarginHighVolume.length} medication${lowMarginHighVolume.length !== 1 ? "s" : ""} with margin below 20%: ${names.join(", ")}${lowMarginHighVolume.length > 3 ? "..." : ""}.`,
      recommendation: "Renegotiate pharmacy costs or review sell pricing for these medications to improve margin.",
    });
  }

  // Top profit driver
  const top = summary[0];
  if (top && top.profitCents > 0) {
    insights.push({
      type: "top_driver",
      title: "Top profit driver",
      detail: `${top.medication} generates the most profit at ${Math.round((top.profitCents / totalProfit) * 100)}% of total.`,
      recommendation: "Ensure reliable supply and competitive pricing for this medication.",
    });
  }

  // Negative margin warning
  const negative = summary.filter((r) => r.marginPct != null && r.marginPct < 0);
  if (negative.length > 0) {
    const names = negative.slice(0, 3).map((r) => r.medication);
    insights.push({
      type: "warning",
      title: "Negative margin detected",
      detail: `${negative.length} medication${negative.length !== 1 ? "s are" : " is"} costing more than revenue: ${names.join(", ")}${negative.length > 3 ? "..." : ""}.`,
      recommendation: "Review pharmacy cost and sell price immediately — these medications lose money on every fill.",
    });
  }

  return insights;
}

// --- J. Pharmacy cost comparison (current vs best available) ---

function buildPharmacyCostComparisons(pharmMedSummary: PharmacyMedicationSummary[]): PharmacyCostComparison[] {
  // Group by medication to find which pharmacy is cheapest
  const byMed = new Map<string, PharmacyMedicationSummary[]>();
  for (const r of pharmMedSummary) {
    if (!byMed.has(r.medication)) byMed.set(r.medication, []);
    byMed.get(r.medication)!.push(r);
  }

  const comparisons: PharmacyCostComparison[] = [];

  for (const [medication, pharmacies] of byMed) {
    if (pharmacies.length < 2) continue; // need at least 2 pharmacies to compare

    // Find the one with the most orders (current) and the one with lowest cost (best)
    const byOrders = [...pharmacies].sort((a, b) => b.orders - a.orders);
    const byCost = [...pharmacies].filter((p) => p.costCents > 0).sort((a, b) => {
      const aPerUnit = a.costCents / a.orders;
      const bPerUnit = b.costCents / b.orders;
      return aPerUnit - bPerUnit;
    });

    const current = byOrders[0];
    const best = byCost[0];
    if (!current || !best || current.costCents <= 0) continue;

    const currentPerUnit = Math.round(current.costCents / current.orders);
    const bestPerUnit = Math.round(best.costCents / best.orders);

    if (bestPerUnit < currentPerUnit && current.pharmacyId !== best.pharmacyId) {
      comparisons.push({
        medication,
        currentPharmacy: current.pharmacy,
        currentCostCents: currentPerUnit,
        bestPharmacy: best.pharmacy,
        bestCostCents: bestPerUnit,
        savingsCents: currentPerUnit - bestPerUnit,
        orders: current.orders,
      });
    }
  }

  return comparisons.sort((a, b) => b.savingsCents * b.orders - a.savingsCents * a.orders);
}

// --- Main builder ---

export function buildBrandAnalytics(orders: RawBrandOrder[]): BrandAnalytics {
  const medicationSummary = buildMedicationSummary(orders);
  const pareto = buildPareto(medicationSummary);
  const revenueProfitMix = buildRevenueProfitMix(medicationSummary);
  const trendDaily = buildTrend(orders, "day");
  const trendMonthly = buildTrend(orders, "month");
  const opportunityMatrix = buildOpportunityMatrix(medicationSummary);
  const pharmacyMedicationSummary = buildPharmacyMedicationSummary(orders);
  const pharmacyCostComparisons = buildPharmacyCostComparisons(pharmacyMedicationSummary);
  const insights = buildInsights(medicationSummary);

  return {
    medicationSummary,
    pareto,
    revenueProfitMix,
    trendDaily,
    trendMonthly,
    opportunityMatrix,
    pharmacyMedicationSummary,
    pharmacyCostComparisons,
    insights,
  };
}
