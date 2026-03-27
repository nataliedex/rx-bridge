import { prisma } from "@/lib/db";
import { formatCurrency, formatPercent } from "@/lib/pricing";
import { computeSummary, computeQualitySummary, groupBy, assessQuality, type Transaction } from "@/lib/revenue-analytics";
import { AnalyticsTimeFilter } from "@/components/analytics-time-filter";
import { TransactionsTable } from "@/components/transactions-table";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ period?: string }>;
}

function getDateCutoff(period: string): Date | null {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const period = params.period || "all";
  const cutoff = getDateCutoff(period);

  const orderWhere: Record<string, unknown> = { status: "completed" };
  if (cutoff) {
    orderWhere.OR = [
      { completedAt: { gte: cutoff } },
      { completedAt: null, createdAt: { gte: cutoff } },
    ];
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true, medicationName: true, quantity: true,
      pharmacyId: true, brandId: true, createdAt: true, completedAt: true,
      patient: { select: { firstName: true, lastName: true } },
      pharmacy: { select: { name: true } },
      brand: { select: { name: true } },
    },
  });

  const refillWhere: Record<string, unknown> = { status: "filled" };
  if (cutoff) refillWhere.filledAt = { gte: cutoff };

  const refills = await prisma.refillRequest.findMany({
    where: refillWhere,
    select: {
      id: true, medicationName: true, quantity: true,
      pharmacyId: true, brandId: true, filledAt: true,
      sellPriceCents: true, pharmacyCostCents: true,
      patient: { select: { firstName: true, lastName: true } },
      pharmacy: { select: { name: true } },
      brand: { select: { name: true } },
    },
  });

  const medNames = [...new Set([...orders.map((o) => o.medicationName), ...refills.map((r) => r.medicationName)])];
  const medications = medNames.length > 0
    ? await prisma.medication.findMany({
        where: { name: { in: medNames } },
        include: { priceHistory: { where: { endDate: null }, orderBy: { price: "asc" } } },
      })
    : [];

  const medIdMap = new Map(medications.map((m) => [m.name, m.id]));
  const sellPriceMap = new Map(medications.filter((m) => m.sellPrice != null).map((m) => [m.name, m.sellPrice!]));
  const pharmCostMap = new Map<string, number>();
  for (const m of medications) {
    for (const p of m.priceHistory) {
      const key = `${m.name}:${p.pharmacyId}`;
      if (!pharmCostMap.has(key)) pharmCostMap.set(key, p.price);
    }
  }

  const transactions: Transaction[] = [];

  for (const o of orders) {
    const sell = sellPriceMap.get(o.medicationName);
    const cost = pharmCostMap.get(`${o.medicationName}:${o.pharmacyId}`);
    const qty = o.quantity ?? 1;
    const revenueCents = sell != null ? Math.round(sell * qty * 100) : 0;
    const costCents = cost != null ? Math.round(cost * qty * 100) : 0;
    const profitCents = revenueCents - costCents;

    const hasRealCompletedAt = o.completedAt != null;
    const quality = assessQuality({
      type: "order",
      revenueCents, costCents,
      sellPriceSource: sell != null ? "catalog" : "missing",
      costSource: cost != null ? "catalog" : "missing",
      dateSource: hasRealCompletedAt ? "actual" : "approximate",
    });

    transactions.push({
      type: "order", id: o.id, medicationId: medIdMap.get(o.medicationName) ?? null,
      medicationName: o.medicationName, quantity: qty,
      patientName: `${o.patient.lastName}, ${o.patient.firstName}`,
      pharmacyId: o.pharmacyId, pharmacyName: o.pharmacy.name,
      brandId: o.brandId, brandName: o.brand?.name ?? null,
      revenueCents, costCents, profitCents,
      marginPct: revenueCents > 0 ? profitCents / revenueCents : null,
      completedAt: o.completedAt ?? o.createdAt,
      quality,
    });
  }

  for (const r of refills) {
    const revenueCents = r.sellPriceCents ?? 0;
    const costCents = r.pharmacyCostCents ?? 0;
    const profitCents = revenueCents - costCents;

    const quality = assessQuality({
      type: "refill",
      revenueCents, costCents,
      sellPriceSource: r.sellPriceCents != null ? "actual" : "missing",
      costSource: r.pharmacyCostCents != null ? "actual" : "missing",
      dateSource: r.filledAt != null ? "actual" : "approximate",
    });

    transactions.push({
      type: "refill", id: r.id, medicationId: medIdMap.get(r.medicationName) ?? null,
      medicationName: r.medicationName, quantity: r.quantity ?? 1,
      patientName: `${r.patient.lastName}, ${r.patient.firstName}`,
      pharmacyId: r.pharmacyId, pharmacyName: r.pharmacy.name,
      brandId: r.brandId, brandName: r.brand?.name ?? null,
      revenueCents, costCents, profitCents,
      marginPct: revenueCents > 0 ? profitCents / revenueCents : null,
      completedAt: r.filledAt ?? new Date(),
      quality,
    });
  }

  transactions.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const summary = computeSummary(transactions);
  const qualitySummary = computeQualitySummary(transactions);
  const byBrand = groupBy(transactions, "brand");
  const byPharmacy = groupBy(transactions, "pharmacy");

  function centsToDisplay(cents: number): string {
    return formatCurrency(cents / 100);
  }

  const serializedTransactions = transactions.map((t) => ({
    ...t,
    completedAt: t.completedAt instanceof Date ? t.completedAt.toISOString() : t.completedAt,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Revenue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {summary.transactionCount} transaction{summary.transactionCount !== 1 ? "s" : ""}
            {" "}({summary.orderCount} order{summary.orderCount !== 1 ? "s" : ""}, {summary.refillCount} refill{summary.refillCount !== 1 ? "s" : ""})
          </p>
        </div>
        <AnalyticsTimeFilter currentPeriod={period} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalRevenueCents > 0 ? centsToDisplay(summary.totalRevenueCents) : <span className="text-gray-300">—</span>}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalCostCents > 0 ? centsToDisplay(summary.totalCostCents) : <span className="text-gray-300">—</span>}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Profit</p>
          <p className={`text-2xl font-bold mt-1 ${summary.totalProfitCents >= 0 ? "text-green-700" : "text-red-600"}`}>{summary.transactionCount > 0 ? centsToDisplay(summary.totalProfitCents) : <span className="text-gray-300">—</span>}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Avg Margin</p>
          <p className={`text-2xl font-bold mt-1 ${summary.avgMarginPct != null && summary.avgMarginPct > 0 ? "text-green-700" : summary.avgMarginPct != null ? "text-red-600" : "text-gray-300"}`}>{summary.avgMarginPct != null ? formatPercent(summary.avgMarginPct) : "—"}</p>
        </div>
      </div>

      {/* Order vs Refill breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Orders</p>
            <p className="text-lg font-bold text-gray-900">{summary.orderCount}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Refills</p>
            <p className="text-lg font-bold text-gray-900">{summary.refillCount}</p>
          </div>
        </div>
      </div>

      <TransactionsTable
        transactions={serializedTransactions}
        byBrand={byBrand}
        byPharmacy={byPharmacy}
        qualitySummary={qualitySummary}
      />

      {transactions.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center mt-6">
          <p className="text-gray-400">No completed transactions in this period.</p>
          <p className="text-xs text-gray-400 mt-1">Revenue appears here after orders are completed or refills are filled.</p>
        </div>
      )}
    </div>
  );
}
