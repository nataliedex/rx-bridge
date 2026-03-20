// Pricing data structure and utilities.
// Pricing is informational only — does not affect workflow or send readiness.

export interface OrderPricing {
  gpoPrice: number;
  retailEstimate: number;
  savingsAbsolute: number;
  savingsPercent: number;
}

export function parsePricing(json: string | null | undefined): OrderPricing | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed.gpoPrice !== "number") return null;
    return {
      gpoPrice: parsed.gpoPrice,
      retailEstimate: parsed.retailEstimate,
      savingsAbsolute: parsed.savingsAbsolute,
      savingsPercent: parsed.savingsPercent,
    };
  } catch {
    return null;
  }
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatPercent(pct: number): string {
  return `${Math.round(pct)}%`;
}

// Aggregate pricing for a batch of orders
export function aggregatePricing(items: (OrderPricing | null)[]): { totalGpo: number; totalRetail: number; totalSavings: number; avgSavingsPercent: number } | null {
  const valid = items.filter((p): p is OrderPricing => p !== null);
  if (valid.length === 0) return null;

  const totalGpo = valid.reduce((sum, p) => sum + p.gpoPrice, 0);
  const totalRetail = valid.reduce((sum, p) => sum + p.retailEstimate, 0);
  const totalSavings = totalRetail - totalGpo;
  const avgSavingsPercent = totalRetail > 0 ? (totalSavings / totalRetail) * 100 : 0;

  return { totalGpo, totalRetail, totalSavings, avgSavingsPercent };
}
